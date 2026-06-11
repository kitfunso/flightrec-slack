/**
 * Entitlements — the data the parameter-level policy gate binds to.
 *
 * The gate does NOT ask "are grants allowed"; it asks "is THIS requester
 * entitled to grant THIS scope on THIS resource for THIS duration." That
 * question is answered against {@link Entitlement} records, never against the
 * LLM's judgment. A verb-level allow-list would pass "grant attacker admin on
 * prod" whenever attacker + prod were each individually allowed; binding to the
 * requester's own entitlements closes that hole.
 *
 * @module entitlements
 */

/** A structured privileged-action request — produced ONLY from a slash command
 * / modal (the command channel), never parsed from free-text thread content. */
export interface GrantRequest {
  readonly teamId: string;
  /** Authenticated Slack user id of the requester. */
  readonly requester: string;
  readonly targetUser: string;
  readonly resource: string;
  /** e.g. "read", "write", "admin". */
  readonly scope: string;
  readonly durationSeconds: number;
  readonly channel: string;
  readonly threadTs: string;
}

/** One grantor's authority to grant scopes on a resource, up to a max duration. */
export interface Entitlement {
  /** Slack user id of the grantor who holds this entitlement. */
  readonly grantor: string;
  readonly resource: string;
  readonly allowedScopes: readonly string[];
  readonly maxDurationSeconds: number;
}

/** A read-only store of who may grant what. Config-driven for the MVP. */
export class EntitlementStore {
  constructor(private readonly entitlements: readonly Entitlement[]) {}

  /** All entitlements held by one grantor. */
  forGrantor(grantor: string): readonly Entitlement[] {
    return this.entitlements.filter((e) => e.grantor === grantor);
  }
}
