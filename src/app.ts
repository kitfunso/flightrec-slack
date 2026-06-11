/**
 * flightrec-slack broker app (Bolt, Socket Mode).
 *
 * `/grant` opens a modal of STRUCTURED fields (the command channel — no
 * free-text instructions). On submit, the broker reasons (LLM, advisory),
 * gates (deterministic, authoritative), executes or denies, records the whole
 * run into the flightrec black box, and posts the decision + integrity
 * attestation. `/audit <runId>` renders the tamper-evident report.
 *
 * @module app
 */
import boltPkg from "@slack/bolt";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "./config.js";
import { openAuditStore } from "./recorder.js";
import { MockAccessSystem } from "./access_system.js";
import { ClaudeReasoner } from "./claude_reasoner.js";
import { StubReasoner, type Reasoner } from "./reasoner.js";
import { Broker } from "./broker.js";
import type { GrantRequest } from "./entitlements.js";

const { App } = boltPkg;

const config = loadConfig();
const audit = openAuditStore(config.dbPath);
const access = new MockAccessSystem();

const reasoner: Reasoner =
  process.env.ANTHROPIC_API_KEY !== undefined && process.env.ANTHROPIC_API_KEY !== ""
    ? new ClaudeReasoner(new Anthropic(), config.model)
    : (console.error("[app] no ANTHROPIC_API_KEY; using StubReasoner (the gate still enforces policy)"),
      new StubReasoner());

const broker = new Broker(audit, config.entitlements, access, reasoner);

const app = new App({
  token: config.botToken,
  socketMode: true,
  appToken: config.appToken,
});

const SCOPE_OPTIONS = ["read", "write", "admin"] as const;
const DURATION_OPTIONS: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
  { label: "1 hour", value: "3600" },
  { label: "24 hours", value: "86400" },
  { label: "7 days", value: "604800" },
];

/** Loose view of a modal's submitted state (Bolt's element union is too wide to index). */
type StateValues = Record<
  string,
  Record<
    string,
    {
      readonly value?: string;
      readonly selected_user?: string;
      readonly selected_option?: { readonly value?: string };
    }
  >
>;

app.command("/grant", async ({ ack, body, client, logger }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "grant_modal",
        private_metadata: JSON.stringify({ channel: body.channel_id, responseUrl: body.response_url }),
        title: { type: "plain_text", text: "Request access" },
        submit: { type: "plain_text", text: "Request" },
        close: { type: "plain_text", text: "Cancel" },
        blocks: [
          {
            type: "input",
            block_id: "target_user_block",
            label: { type: "plain_text", text: "Grant access to" },
            element: { type: "users_select", action_id: "target_user" },
          },
          {
            type: "input",
            block_id: "resource_block",
            label: { type: "plain_text", text: "Resource" },
            element: {
              type: "plain_text_input",
              action_id: "resource",
              placeholder: { type: "plain_text", text: "e.g. prod-analytics" },
            },
          },
          {
            type: "input",
            block_id: "scope_block",
            label: { type: "plain_text", text: "Scope" },
            element: {
              type: "static_select",
              action_id: "scope",
              options: SCOPE_OPTIONS.map((s) => ({ text: { type: "plain_text" as const, text: s }, value: s })),
            },
          },
          {
            type: "input",
            block_id: "duration_block",
            label: { type: "plain_text", text: "Duration" },
            element: {
              type: "static_select",
              action_id: "duration",
              options: DURATION_OPTIONS.map((d) => ({
                text: { type: "plain_text" as const, text: d.label },
                value: d.value,
              })),
            },
          },
        ],
      },
    });
  } catch (error) {
    logger.error(error);
  }
});

app.view("grant_modal", async ({ ack, body, view, logger }) => {
  await ack();
  try {
    const meta = JSON.parse(view.private_metadata.length > 0 ? view.private_metadata : "{}") as {
      channel?: string;
      responseUrl?: string;
    };
    const channel = meta.channel ?? "";
    const values = view.state.values as StateValues;

    const req: GrantRequest = {
      teamId: body.team?.id ?? "unknown",
      requester: body.user.id,
      targetUser: values["target_user_block"]?.["target_user"]?.selected_user ?? "",
      resource: (values["resource_block"]?.["resource"]?.value ?? "").trim(),
      scope: values["scope_block"]?.["scope"]?.selected_option?.value ?? "",
      durationSeconds: Number(values["duration_block"]?.["duration"]?.selected_option?.value ?? "0"),
      channel,
      threadTs: view.id, // unique run key for a command-initiated flow
    };

    const result = await broker.handle(req);
    const report = audit.forRun(result.runId).audit();

    const headline =
      result.outcome === "grant" ? ":white_check_mark: Access granted" : ":no_entry: Access denied";
    const attest = report.intact
      ? `:lock: audit verified OK (${report.events} events)`
      : `:rotating_light: audit BROKEN (first break seq ${report.firstBroken ?? "?"})`;

    // Deliver via the command's response_url, which posts to the invoking
    // channel WITHOUT requiring the bot to be a member (chat.postMessage would
    // fail with not_in_channel). response_type "in_channel" makes it visible.
    const message = {
      response_type: "in_channel",
      text: `${headline}: ${result.reason}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `${headline}\n` +
              `*Requester:* <@${req.requester}>  *Target:* <@${req.targetUser}>\n` +
              `*Resource:* \`${req.resource}\`  *Scope:* \`${req.scope}\`  *Duration:* ${req.durationSeconds}s\n` +
              `*Gate:* ${result.reason}\n` +
              `*LLM proposed:* ${result.llmProposed} _(advisory; the gate decided)_\n` +
              `${attest}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `run \`${result.runId}\`  •  full report: \`/audit ${result.runId}\``,
            },
          ],
        },
      ],
    };
    if (meta.responseUrl !== undefined && meta.responseUrl.length > 0) {
      await fetch(meta.responseUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
      });
    } else {
      logger.error("no response_url in modal metadata; cannot deliver result");
    }
  } catch (error) {
    logger.error(error);
  }
});

app.command("/audit", async ({ ack, command, respond, logger }) => {
  await ack();
  const runId = command.text.trim();
  if (runId.length === 0) {
    await respond("Usage: `/audit <runId>`");
    return;
  }
  try {
    const report = audit.forRun(runId).audit();
    const body =
      report.markdown.length > 2800 ? `${report.markdown.slice(0, 2800)}\n... (truncated)` : report.markdown;
    // respond() uses the command's response_url — no channel membership needed.
    await respond({
      response_type: "in_channel",
      text: `Audit for ${runId}`,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "```" + body + "```" } }],
    });
  } catch (error) {
    logger.error(error);
    await respond(`No audit found for \`${runId}\`.`);
  }
});

(async () => {
  await app.start();
  app.logger.info("flightrec-slack broker running (Socket Mode)");
})();
