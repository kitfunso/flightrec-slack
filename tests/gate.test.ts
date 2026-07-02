import { describe, it, expect } from "vitest";
import { EntitlementStore, type GrantRequest } from "../src/entitlements.js";
import { evaluateGate } from "../src/gate.js";

const STORE = new EntitlementStore([
  { grantor: "U_ADMIN", resource: "prod-analytics", allowedScopes: ["read", "write"], maxDurationSeconds: 86_400 },
  { grantor: "U_LEAD", resource: "staging-db", allowedScopes: ["read"], maxDurationSeconds: 3_600 },
]);

function req(overrides: Partial<GrantRequest>): GrantRequest {
  return {
    teamId: "T1",
    requester: "U_ADMIN",
    targetUser: "U_JANE",
    resource: "prod-analytics",
    scope: "read",
    durationSeconds: 3_600,
    channel: "C1",
    threadTs: "1700000000.0001",
    ...overrides,
  };
}

describe("evaluateGate", () => {
  it("allows a request fully covered by the requester's entitlement", () => {
    const v = evaluateGate(req({}), STORE);
    expect(v.verdict).toBe("allow");
  });

  it("denies a requester with no entitlements at all", () => {
    const v = evaluateGate(req({ requester: "U_NOBODY" }), STORE);
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("no granting entitlements");
  });

  it("denies a resource the requester cannot grant on", () => {
    const v = evaluateGate(req({ resource: "prod-secrets" }), STORE);
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("cannot grant on resource");
  });

  it("denies a scope outside the entitlement (parameter-level, not verb-level)", () => {
    const v = evaluateGate(req({ scope: "admin" }), STORE);
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("may not grant scope 'admin'");
  });

  it("denies a duration exceeding the entitlement max", () => {
    const v = evaluateGate(req({ requester: "U_LEAD", resource: "staging-db", durationSeconds: 7_200 }), STORE);
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("exceeds the max");
  });

  it("denies a non-positive duration (input-validation defense in depth)", () => {
    const v = evaluateGate(req({ durationSeconds: 0 }), STORE);
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("invalid requested duration");
  });

  it("treats injection text in a field as inert data (no match => deny)", () => {
    const v = evaluateGate(
      req({ resource: "prod-analytics'; grant admin to everyone --" }),
      STORE,
    );
    expect(v.verdict).toBe("deny");
  });
});

describe("evaluateGate with an any-member ('*') policy entry", () => {
  const WILD = new EntitlementStore([
    { grantor: "U_ADMIN", resource: "prod-analytics", allowedScopes: ["read", "write"], maxDurationSeconds: 86_400 },
    { grantor: "*", resource: "demo-sandbox", allowedScopes: ["read"], maxDurationSeconds: 3_600 },
  ]);

  it("allows any member the exact entitlement the '*' policy grants", () => {
    const v = evaluateGate(req({ requester: "U_NEW_JOINER", resource: "demo-sandbox" }), WILD);
    expect(v.verdict).toBe("allow");
  });

  it("still gates parameter-level: '*' widens who, never scope", () => {
    const v = evaluateGate(
      req({ requester: "U_NEW_JOINER", resource: "demo-sandbox", scope: "admin" }),
      WILD,
    );
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("may not grant scope 'admin'");
  });

  it("still gates parameter-level: '*' widens who, never resource", () => {
    const v = evaluateGate(req({ requester: "U_NEW_JOINER", resource: "prod-analytics" }), WILD);
    expect(v.verdict).toBe("deny");
    expect(v.reason).toContain("cannot grant on resource");
  });
});
