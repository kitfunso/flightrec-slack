// End-to-end test of the broker pipeline with the LIVE Claude reasoner.
// Drives broker.handle directly (the one piece it can't exercise is the Slack
// modal UI click). Run: node --env-file=.env scripts/demo_run.mjs
import { openAuditStore } from "../dist/recorder.js";
import { Broker } from "../dist/broker.js";
import { EntitlementStore } from "../dist/entitlements.js";
import { MockAccessSystem } from "../dist/access_system.js";
import { ClaudeReasoner } from "../dist/claude_reasoner.js";
import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import { rmSync } from "node:fs";

const ME = "U0B9DTWT9DZ";
const DB = "data/demo-audit.db";
for (const suffix of ["", "-wal", "-shm"]) rmSync(DB + suffix, { force: true });

const entitlements = new EntitlementStore([
  { grantor: ME, resource: "prod-analytics", allowedScopes: ["read", "write"], maxDurationSeconds: 86400 },
  { grantor: ME, resource: "staging-db", allowedScopes: ["read"], maxDurationSeconds: 3600 },
]);
const store = openAuditStore(DB);
const access = new MockAccessSystem();
const model = process.env.FLIGHTREC_SLACK_MODEL ?? "claude-haiku-4-5-20251001";
const reasoner = new ClaudeReasoner(new Anthropic(), model);
const broker = new Broker(store, entitlements, access, reasoner);
console.log(`live reasoner model: ${model}\n`);

const NOW = 1_700_000_000_000;
const base = {
  teamId: "T_DEMO",
  requester: ME,
  targetUser: "U_JANE",
  resource: "prod-analytics",
  scope: "read",
  durationSeconds: 3600,
  channel: "C_DEMO",
  threadTs: "x",
};

const scenarios = [
  { name: "GRANT  read on prod-analytics (entitled)", req: { ...base, threadTs: "100", scope: "read" } },
  { name: "DENY   admin on prod-analytics (scope over-reach)", req: { ...base, threadTs: "200", scope: "admin" } },
  { name: "DENY   read on prod-secrets (no entitlement on resource)", req: { ...base, threadTs: "300", resource: "prod-secrets" } },
  { name: "DENY   7-day on staging-db (duration > 1h max)", req: { ...base, threadTs: "400", resource: "staging-db", durationSeconds: 604800 } },
];

const results = [];
for (const s of scenarios) {
  const r = await broker.handle(s.req, NOW);
  const a = store.forRun(r.runId).audit();
  results.push({ name: s.name, r });
  console.log(`=== ${s.name} ===`);
  console.log(`  outcome : ${r.outcome.toUpperCase()}   (live Claude proposed: ${r.llmProposed})`);
  console.log(`  gate    : ${r.reason}`);
  console.log(`  run     : ${r.runId}   audit: ${a.intact ? "OK" : "BROKEN"} (${a.events} events)`);
  if (r.grant) console.log(`  grant   : ${r.grant.id}, expires ${new Date(r.grant.expiresAtMs).toISOString()}`);
  console.log("");
}

// Show the CLEAN grant run's report first (tool inventory should pair).
const grantRun = results[0].r.runId;
console.log(`\n========== FULL AUDIT REPORT (clean grant run ${grantRun}) ==========\n`);
console.log(store.forRun(grantRun).audit().markdown);

// Tamper demo on the GRANT run: an attacker with raw DB access drops the
// append-only triggers and rewrites the recorded action. The hash chain catches it.
store.close();
const raw = new DatabaseSync(DB);
for (const t of raw.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()) {
  raw.exec(`DROP TRIGGER IF EXISTS "${t.name}"`);
}
raw
  .prepare("UPDATE events SET payload = ? WHERE run_id = ? AND kind = 'tool_call'")
  .run(
    JSON.stringify({
      action: "grant",
      targetUser: "U_JANE",
      resource: "prod-secrets",
      scope: "admin",
      executed: true,
      result: "secretly escalated to admin on prod-secrets",
    }),
    grantRun,
  );
raw.close();

const store2 = openAuditStore(DB);
const tampered = store2.forRun(grantRun).audit();
console.log(`=== TAMPER DEMO on ${grantRun} ===`);
console.log(`  after out-of-band UPDATE -> audit: ${tampered.intact ? "OK" : "BROKEN"} (first broken seq ${tampered.firstBroken})`);

console.log(`\n========== FULL AUDIT REPORT (the grant run, now tampered) ==========\n`);
console.log(tampered.markdown);
store2.close();
