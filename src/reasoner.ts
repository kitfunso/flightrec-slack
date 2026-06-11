/**
 * The LLM reasoner — the "agent" half of the broker.
 *
 * It produces a human rationale and an ADVISORY proposed outcome for a request.
 * It is deliberately NOT authoritative: the deterministic {@link evaluateGate}
 * decides, so a prompt-injected or mistaken reasoner can never escalate access.
 * Behind an interface so the live Claude implementation and the test stub are
 * interchangeable.
 *
 * @module reasoner
 */
import type { GrantRequest } from "./entitlements.js";

/** A reasoner's advisory output for one request. */
export interface ReasonResult {
  readonly rationale: string;
  /** Advisory only — the gate, not this, decides what executes. */
  readonly proposedOutcome: "grant" | "deny";
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Reasons about an access request. Never gates. */
export interface Reasoner {
  reason(req: GrantRequest): Promise<ReasonResult>;
}

/**
 * Deterministic reasoner for tests and offline development. It always proposes
 * `grant` precisely so tests can prove the gate overrides the LLM: when the
 * requester lacks entitlement, the broker must still deny despite this "grant".
 */
export class StubReasoner implements Reasoner {
  async reason(req: GrantRequest): Promise<ReasonResult> {
    return {
      rationale:
        `${req.requester} requests '${req.scope}' on '${req.resource}' for ` +
        `${req.targetUser} (${req.durationSeconds}s).`,
      proposedOutcome: "grant",
      model: "stub",
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
