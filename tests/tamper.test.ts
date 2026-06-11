import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openAuditStore } from "../src/recorder.js";
import { simulateTamper } from "../src/tamper.js";

const dirs: string[] = [];
function freshDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "flightrec-slack-tamper-"));
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

function recordGrantRun(dbPath: string, runId: string): void {
  const store = openAuditStore(dbPath);
  const rec = store.forRun(runId);
  rec.recordRequest({
    requester: "U1",
    channel: "C1",
    threadTs: "1",
    action: "grant",
    targetUser: "U2",
    resource: "prod-analytics",
    scope: "read",
    durationSeconds: 3600,
  });
  rec.recordLlmCall({ model: "stub", purpose: "x", proposedOutcome: "grant", rationale: "ok", inputTokens: 1, outputTokens: 1 });
  rec.recordDecision({ outcome: "grant", gateVerdict: "allow", reason: "entitled" });
  rec.recordToolCallPre({ toolName: "access.grant", toolUseId: "t1", input: { resource: "prod-analytics" } });
  rec.recordToolCallPost({ toolName: "access.grant", toolUseId: "t1", output: { executed: true } });
  rec.recordCost({ messageId: "m1", model: "stub", inputTokens: 1, outputTokens: 1 });
  rec.close();
  store.close();
}

describe("simulateTamper", () => {
  it("breaks a recorded run's chain so the audit reports BROKEN", () => {
    const dbPath = freshDbPath();
    const runId = "T.C.tamper1";
    recordGrantRun(dbPath, runId);

    const before = openAuditStore(dbPath);
    expect(before.forRun(runId).audit().intact).toBe(true);
    before.close();

    const result = simulateTamper(dbPath, runId);
    expect(result.tampered).toBe(true);

    const after = openAuditStore(dbPath);
    const audit = after.forRun(runId).audit();
    expect(audit.intact).toBe(false);
    expect(audit.firstBroken).toBeGreaterThan(0);
    expect(audit.markdown).toContain("verdict: BROKEN");
    after.close();
  });

  it("restores the append-only triggers after tampering", () => {
    const dbPath = freshDbPath();
    const runId = "T.C.tamper2";
    recordGrantRun(dbPath, runId);

    simulateTamper(dbPath, runId);

    const raw = new DatabaseSync(dbPath);
    const { n } = raw
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'")
      .get() as { n: number };
    raw.close();
    expect(n).toBeGreaterThan(0);
  });
});
