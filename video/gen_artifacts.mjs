// Generates REAL pipeline artifacts for the demo-video reel. Every card the
// reel renders comes from this run: live Claude rationales, real gate reasons,
// real hashes, real audit markdown, a real out-of-band tamper.
// Run from the repo root: node --env-file=.env video/gen_artifacts.mjs
import { openAuditStore } from "../dist/recorder.js";
import { Broker } from "../dist/broker.js";
import { EntitlementStore } from "../dist/entitlements.js";
import { MockAccessSystem } from "../dist/access_system.js";
import { ClaudeReasoner } from "../dist/claude_reasoner.js";
import { simulateTamper } from "../dist/tamper.js";
import Anthropic from "@anthropic-ai/sdk";
import { rmSync, writeFileSync } from "node:fs";

const ME = "U0BA01UT7KN"; // requester (Keith, slack-hack workspace)
const TEAM = "T0B9Q29RXNX";
const CHANNEL = "C0B9UC35P1U";
const DB = "video/demo-audit.db";
const NOW = 1_751_500_800_000;

for (const suffix of ["", "-wal", "-shm"]) rmSync(DB + suffix, { force: true });

const entitlements = new EntitlementStore([
  { grantor: ME, resource: "prod-analytics", allowedScopes: ["read", "write"], maxDurationSeconds: 86400 },
  { grantor: "*", resource: "demo-sandbox", allowedScopes: ["read"], maxDurationSeconds: 3600 },
]);
const store = openAuditStore(DB);
const model = process.env.FLIGHTREC_SLACK_MODEL ?? "claude-haiku-4-5-20251001";
const broker = new Broker(store, entitlements, new MockAccessSystem(), new ClaudeReasoner(new Anthropic(), model));

const base = {
  teamId: TEAM,
  requester: ME,
  targetUser: "U_JANE",
  resource: "prod-analytics",
  scope: "read",
  durationSeconds: 3600,
  channel: CHANNEL,
};

console.log(`live reasoner model: ${model}`);

// Scene: the happy path (GRANT read, entitled)
const grantRes = await broker.handle({ ...base, threadTs: "V0DEMO100" }, NOW);
const grantAudit = store.forRun(grantRes.runId).audit();
console.log(`grant : ${grantRes.outcome} (LLM proposed ${grantRes.llmProposed}) audit ${grantAudit.intact ? "OK" : "BROKEN"} ${grantAudit.events} events`);

// Scene: the over-reach (DENY admin, gate refuses whatever the LLM thinks)
const denyRes = await broker.handle({ ...base, threadTs: "V0DEMO200", scope: "admin" }, NOW);
console.log(`deny  : ${denyRes.outcome} (LLM proposed ${denyRes.llmProposed})`);

store.close();

// Scene: the attack. Raw-DB tamper on the grant run, then re-audit.
const t = simulateTamper(DB, grantRes.runId);
const store2 = openAuditStore(DB);
const tamperedAudit = store2.forRun(grantRes.runId).audit();
console.log(`tamper: ${t.detail} -> audit ${tamperedAudit.intact ? "OK (BUG!)" : `BROKEN @ seq ${tamperedAudit.firstBroken}`}`);
store2.close();

if (tamperedAudit.intact) throw new Error("tamper not detected; artifacts invalid");

writeFileSync(
  "video/artifacts-base.json",
  JSON.stringify(
    {
      model,
      now: NOW,
      grant: { req: { ...base, threadTs: "V0DEMO100" }, res: grantRes, audit: grantAudit },
      deny: { req: { ...base, threadTs: "V0DEMO200", scope: "admin" }, res: denyRes },
      tampered: { detail: t.detail, audit: tamperedAudit },
    },
    null,
    2,
  ),
);
console.log("wrote video/artifacts-base.json");
