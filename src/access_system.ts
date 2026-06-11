/**
 * Mock internal access system — the privileged-action target for the MVP demo.
 *
 * Deterministic and in-memory: it represents "the system that actually grants
 * access" (an IdP, a DB ACL, a repo permission) without touching anything real.
 * A real integration would implement the same shape behind an interface. The
 * audit trail of WHAT was granted is the product; this is just the effect.
 *
 * @module access_system
 */

/** A grant the access system has issued. */
export interface GrantRecord {
  readonly id: string;
  readonly targetUser: string;
  readonly resource: string;
  readonly scope: string;
  readonly grantedAtMs: number;
  readonly expiresAtMs: number;
}

/** In-memory access system. `nowMs` is injected so behavior is deterministic. */
export class MockAccessSystem {
  private readonly grants: GrantRecord[] = [];
  private counter = 0;

  /** Issue a time-boxed grant and return its record. */
  grant(
    targetUser: string,
    resource: string,
    scope: string,
    durationSeconds: number,
    nowMs: number,
  ): GrantRecord {
    this.counter += 1;
    const record: GrantRecord = {
      id: `grant-${this.counter}`,
      targetUser,
      resource,
      scope,
      grantedAtMs: nowMs,
      expiresAtMs: nowMs + durationSeconds * 1000,
    };
    this.grants.push(record);
    return record;
  }

  /** Grants not yet expired as of `nowMs`. */
  activeGrants(nowMs: number): readonly GrantRecord[] {
    return this.grants.filter((g) => g.expiresAtMs > nowMs);
  }
}
