import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openAuditStore } from "../src/recorder.js";
import { Broker } from "../src/broker.js";
import { EntitlementStore, type GrantRequest } from "../src/entitlements.js";
import { MockAccessSystem } from "../src/access_system.js";
import { StubReasoner } from "../src/reasoner.js";

const dirs: string[] = [];
function freshDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "flightrec-slack-broker-"));
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

const ENTITLEMENTS = new EntitlementStore([
  { grantor: "U_ADMIN", resource: "prod-analytics", allowedScopes: ["read", "write"], maxDurationSeconds: 86_400 },
]);

function buildBroker(dbPath: string): { broker: Broker; store: ReturnType<typeof openAuditStore> } {
  const store = openAuditStore(dbPath);
  // StubReasoner always proposes "grant" — so any deny proves the gate, not the LLM, decided.
  const broker = new Broker(store, ENTITLEMENTS, new MockAccessSystem(), new StubReasoner());
  return { broker, store };
}

function baseReq(overrides: Partial<GrantRequest>): GrantRequest {
  return {
    teamId: "T1",
    requester: "U_ADMIN",
    targetUser: "U_JANE",
    resource: "prod-analytics",
    scope: "read",
    durationSeconds: 3_600,
    channel: "C_OPS",
    threadTs: "1700000000.0001",
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe("Broker", () => {
  it("grants an entitled request and records an intact 5-event run", async () => {
    const dbPath = freshDbPath();
    const { broker, store } = buildBroker(dbPath);

    const result = await broker.handle(baseReq({}), NOW);
    expect(result.outcome).toBe("grant");
    expect(result.grant).toBeDefined();

    const audit = store.forRun(result.runId).audit();
    expect(audit.intact).toBe(true);
    expect(audit.events).toBe(5); // run_meta, llm_call, decision, tool_call, cost
    expect(audit.markdown).toContain("verdict: OK");
    store.close();
  });

  it("gate overrides the LLM: reasoner proposes grant, gate denies the over-reach", async () => {
    const dbPath = freshDbPath();
    const { broker, store } = buildBroker(dbPath);

    // Requester is entitled to read/write on prod-analytics but NOT admin.
    const result = await broker.handle(baseReq({ scope: "admin" }), NOW);

    expect(result.llmProposed).toBe("grant"); // the LLM wanted to grant
    expect(result.outcome).toBe("deny"); // the gate refused anyway
    expect(result.grant).toBeUndefined();
    expect(result.reason).toContain("may not grant scope 'admin'");

    // The denial is still recorded, and the run still verifies intact.
    const audit = store.forRun(result.runId).audit();
    expect(audit.intact).toBe(true);
    expect(audit.events).toBe(5);
    expect(audit.markdown).toContain("denied by policy gate");
    store.close();
  });

  it("denies an unentitled requester even though the LLM proposes grant", async () => {
    const dbPath = freshDbPath();
    const { broker, store } = buildBroker(dbPath);

    const result = await broker.handle(baseReq({ requester: "U_INTRUDER", threadTs: "1700000000.0002" }), NOW);
    expect(result.llmProposed).toBe("grant");
    expect(result.outcome).toBe("deny");
    expect(result.grant).toBeUndefined();
    store.close();
  });

  it("issues a time-boxed grant reflected in the access system", async () => {
    const dbPath = freshDbPath();
    const store = openAuditStore(dbPath);
    const access = new MockAccessSystem();
    const broker = new Broker(store, ENTITLEMENTS, access, new StubReasoner());

    const result = await broker.handle(baseReq({ durationSeconds: 60, threadTs: "1700000000.0003" }), NOW);
    expect(result.outcome).toBe("grant");
    expect(access.activeGrants(NOW)).toHaveLength(1);
    // Expired by the time it lapses.
    expect(access.activeGrants(NOW + 61_000)).toHaveLength(0);
    store.close();
  });
});
