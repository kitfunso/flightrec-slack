import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openAuditStore, runIdFor, type Recorder } from "../src/recorder.js";

// Project law (inherited from flightrec): tests run against real file-backed
// SQLite in temp dirs, never mocks.
const dirs: string[] = [];
function freshDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "flightrec-slack-"));
  dirs.push(dir);
  return join(dir, "audit.db");
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/** Record a complete, well-formed grant run and return its run id. */
function recordGrantRun(dbPath: string, runId: string): void {
  const store = openAuditStore(dbPath);
  const rec: Recorder = store.forRun(runId);
  rec.recordRequest({
    requester: "U_ADMIN",
    channel: "C_OPS",
    threadTs: "1700000000.0001",
    action: "grant",
    targetUser: "U_JANE",
    resource: "prod-analytics",
    scope: "read",
    durationSeconds: 86_400,
  });
  rec.recordLlmCall({
    model: "claude-opus-4-8",
    purpose: "evaluate access request",
    inputTokens: 1200,
    outputTokens: 180,
  });
  rec.recordDecision({
    outcome: "grant",
    gateVerdict: "allow",
    reason: "requester U_ADMIN is entitled to grant read on prod-analytics",
  });
  rec.recordAction({
    action: "grant",
    targetUser: "U_JANE",
    resource: "prod-analytics",
    scope: "read",
    executed: true,
    result: "granted 24h read on prod-analytics",
  });
  rec.recordCost({ model: "claude-opus-4-8", inputTokens: 1200, outputTokens: 180 });
  rec.close();
  store.close();
}

describe("runIdFor", () => {
  it("uses the thread root ts, not a per-message ts", () => {
    expect(runIdFor("T1", "C1", "1700000000.0001")).toBe("T1.C1.1700000000.0001");
  });
});

describe("Recorder", () => {
  it("records a full grant run that verifies intact with an OK attestation", () => {
    const dbPath = freshDbPath();
    const runId = runIdFor("T1", "C_OPS", "1700000000.0001");
    recordGrantRun(dbPath, runId);

    const store = openAuditStore(dbPath);
    const rec = store.forRun(runId);

    const v = rec.verify();
    expect(v.ok).toBe(true);
    expect(v.events).toBe(5); // run_meta, llm_call, decision, tool_call, cost

    const audit = rec.audit();
    expect(audit.intact).toBe(true);
    expect(audit.firstBroken).toBeUndefined();
    expect(audit.markdown).toContain("# flightrec audit report");
    expect(audit.markdown).toContain("verdict: OK");
    // The recorded resource appears in the deterministic event appendix.
    expect(audit.markdown).toContain("prod-analytics");

    store.close();
  });

  it("tamper-evidence: an out-of-band UPDATE flips the audit to BROKEN", () => {
    const dbPath = freshDbPath();
    const runId = runIdFor("T1", "C_OPS", "1700000000.0002");
    recordGrantRun(dbPath, runId);

    // Simulate an attacker with raw DB access: the append-only triggers would
    // block a bare UPDATE, so a real attacker first removes them. Even then,
    // the hash chain must catch the edit. This is NOT the sanctioned
    // redaction/seal path — it bypasses appendEvent entirely.
    const raw = new DatabaseSync(dbPath);
    const triggers = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
      .all() as ReadonlyArray<{ name: string }>;
    for (const trigger of triggers) {
      raw.exec(`DROP TRIGGER IF EXISTS "${trigger.name}"`);
    }
    // Escalate the recorded grant from read/prod-analytics to admin/prod-secrets.
    raw
      .prepare("UPDATE events SET payload = ? WHERE run_id = ? AND kind = 'tool_call'")
      .run(
        JSON.stringify({
          action: "grant",
          targetUser: "U_JANE",
          resource: "prod-secrets",
          scope: "admin",
          executed: true,
          result: "granted admin on prod-secrets",
        }),
        runId,
      );
    raw.close();

    const store = openAuditStore(dbPath);
    const rec = store.forRun(runId);

    const v = rec.verify();
    expect(v.ok).toBe(false);
    expect(v.firstBroken).toBeGreaterThan(0);

    const audit = rec.audit();
    expect(audit.intact).toBe(false);
    expect(audit.firstBroken).toBeGreaterThan(0);
    expect(audit.markdown).toContain("verdict: BROKEN");

    store.close();
  });
});
