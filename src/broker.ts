/**
 * The broker — orchestrates one privileged-action run and records every step
 * into the flightrec black box.
 *
 * Flow: structured request -> record run_meta -> LLM reasons (advisory,
 * recorded as llm_call) -> deterministic gate decides (authoritative, recorded
 * as decision) -> action executed or denied (recorded as tool_call) -> cost ->
 * close. The action's RESULT is carried in the tool_call payload.
 *
 * Security invariants:
 * - `handle` accepts ONLY a typed {@link GrantRequest}; there is no free-text
 *   field that becomes an instruction (command/data-channel separation).
 * - The gate verdict is authoritative; the reasoner's `proposedOutcome` is
 *   recorded for the audit but never executes anything on its own.
 *
 * @module broker
 */
import { runIdFor, type AuditStore } from "./recorder.js";
import type { GrantRequest, EntitlementStore } from "./entitlements.js";
import { evaluateGate } from "./gate.js";
import type { Reasoner } from "./reasoner.js";
import { MockAccessSystem, type GrantRecord } from "./access_system.js";

/** Outcome of handling one request (for the Slack layer to render). */
export interface BrokerResult {
  readonly runId: string;
  readonly outcome: "grant" | "deny";
  readonly reason: string;
  /** The issued grant, present only when `outcome === "grant"`. */
  readonly grant?: GrantRecord;
  /** What the LLM proposed — surfaced so "LLM proposed grant, gate denied" is visible. */
  readonly llmProposed: "grant" | "deny";
}

/** Handles privileged-action requests, recording each into its own run. */
export class Broker {
  constructor(
    private readonly audit: AuditStore,
    private readonly entitlements: EntitlementStore,
    private readonly access: MockAccessSystem,
    private readonly reasoner: Reasoner,
  ) {}

  /**
   * Handle one structured grant request end to end. `nowMs` is injected for
   * deterministic tests; defaults to wall-clock in production.
   */
  async handle(req: GrantRequest, nowMs: number = Date.now()): Promise<BrokerResult> {
    const runId = runIdFor(req.teamId, req.channel, req.threadTs);
    const rec = this.audit.forRun(runId);

    rec.recordRequest({
      requester: req.requester,
      channel: req.channel,
      threadTs: req.threadTs,
      action: "grant",
      targetUser: req.targetUser,
      resource: req.resource,
      scope: req.scope,
      durationSeconds: req.durationSeconds,
    });

    // The LLM reasons about the request (advisory). It never gates.
    const reasoned = await this.reasoner.reason(req);
    rec.recordLlmCall({
      model: reasoned.model,
      purpose: "reason about access request",
      inputTokens: reasoned.inputTokens,
      outputTokens: reasoned.outputTokens,
    });

    // The deterministic gate decides (authoritative).
    const verdict = evaluateGate(req, this.entitlements);
    const outcome: "grant" | "deny" = verdict.verdict === "allow" ? "grant" : "deny";
    rec.recordDecision({
      outcome,
      gateVerdict: verdict.verdict,
      reason: verdict.reason,
    });

    let grant: GrantRecord | undefined;
    if (verdict.verdict === "allow") {
      grant = this.access.grant(req.targetUser, req.resource, req.scope, req.durationSeconds, nowMs);
      rec.recordAction({
        action: "grant",
        targetUser: req.targetUser,
        resource: req.resource,
        scope: req.scope,
        executed: true,
        result:
          `granted '${req.scope}' on '${req.resource}' to ${req.targetUser} ` +
          `(grant ${grant.id}, expires ${new Date(grant.expiresAtMs).toISOString()})`,
      });
    } else {
      rec.recordAction({
        action: "grant",
        targetUser: req.targetUser,
        resource: req.resource,
        scope: req.scope,
        executed: false,
        result: `denied by policy gate: ${verdict.reason}`,
      });
    }

    rec.recordCost({
      model: reasoned.model,
      inputTokens: reasoned.inputTokens,
      outputTokens: reasoned.outputTokens,
    });
    rec.close();

    return { runId, outcome, reason: verdict.reason, grant, llmProposed: reasoned.proposedOutcome };
  }
}
