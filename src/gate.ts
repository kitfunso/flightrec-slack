/**
 * The deterministic policy gate — the security spine of the broker.
 *
 * Pure function, no LLM, no I/O: given a structured {@link GrantRequest} and the
 * {@link EntitlementStore}, it returns allow/deny with a specific reason. The
 * broker treats this verdict as AUTHORITATIVE — the LLM reasoner may propose
 * "grant", but only an `allow` here executes an action. Reasons are specific so
 * the audit trail records exactly why a grant was permitted or refused.
 *
 * @module gate
 */
import type { GrantRequest, EntitlementStore } from "./entitlements.js";

/** The gate's authoritative verdict on one request. */
export interface GateVerdict {
  readonly verdict: "allow" | "deny";
  readonly reason: string;
}

/**
 * Evaluate a request against the requester's own entitlements at the parameter
 * level (resource + scope + duration). Field VALUES are inert data here: an
 * injection string in `resource`/`targetUser` can only fail to match an
 * entitlement, never grant authority.
 */
export function evaluateGate(req: GrantRequest, store: EntitlementStore): GateVerdict {
  if (!Number.isFinite(req.durationSeconds) || req.durationSeconds <= 0) {
    return { verdict: "deny", reason: `invalid requested duration: ${req.durationSeconds}` };
  }

  const held = store.forGrantor(req.requester);
  if (held.length === 0) {
    return {
      verdict: "deny",
      reason: `requester ${req.requester} holds no granting entitlements`,
    };
  }

  const onResource = held.filter((e) => e.resource === req.resource);
  if (onResource.length === 0) {
    return {
      verdict: "deny",
      reason: `requester ${req.requester} cannot grant on resource '${req.resource}'`,
    };
  }

  const scopeOk = onResource.filter((e) => e.allowedScopes.includes(req.scope));
  if (scopeOk.length === 0) {
    const permitted = [...new Set(onResource.flatMap((e) => e.allowedScopes))].sort();
    return {
      verdict: "deny",
      reason:
        `requester ${req.requester} may not grant scope '${req.scope}' on ` +
        `'${req.resource}' (permitted: ${permitted.join(", ")})`,
    };
  }

  const durationOk = scopeOk.some((e) => e.maxDurationSeconds >= req.durationSeconds);
  if (!durationOk) {
    const maxAllowed = Math.max(...scopeOk.map((e) => e.maxDurationSeconds));
    return {
      verdict: "deny",
      reason:
        `requested duration ${req.durationSeconds}s exceeds the max ${maxAllowed}s ` +
        `for ${req.requester} on '${req.resource}'`,
    };
  }

  return {
    verdict: "allow",
    reason:
      `requester ${req.requester} is entitled to grant '${req.scope}' on ` +
      `'${req.resource}' for up to ${req.durationSeconds}s`,
  };
}
