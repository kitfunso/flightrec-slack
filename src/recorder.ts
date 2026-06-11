/**
 * Recorder — the boundary between the Slack privileged-action broker and the
 * flightrec black box. flightrec stays dependency-free (its product law), so
 * this module is the ONLY place that touches the audit store; the Slack runtime
 * deps live elsewhere.
 *
 * Event kinds are flightrec's real `EVENT_KINDS` — `run_meta`, `llm_call`,
 * `decision`, `tool_call`, `cost` — recorded in that order, then `closeRun()`
 * (a separate call, NOT an event kind). The action's RESULT is carried in the
 * `tool_call` payload (there is no `tool_result` kind).
 *
 * Concurrency: every flightrec store op is synchronous (`node:sqlite`
 * `DatabaseSync`), each `appendEvent` runs in its own `BEGIN IMMEDIATE`
 * transaction, and Node's single event loop cannot interleave two synchronous
 * appends — so within one process, ordering is guaranteed without a lock. Run
 * isolation is by run id: one Slack thread = one run (see {@link runIdFor}).
 * Cross-process writers are serialized by SQLite's WAL + `busy_timeout`.
 *
 * @module recorder
 */
import {
  openDb,
  appendEvent,
  verifyRun,
  closeRun,
  buildRunModel,
  renderAuditMarkdown,
} from "flightrec";
import type { VerifyResult } from "flightrec";
import type { DatabaseSync } from "node:sqlite";

/** Provenance label stamped on every event this broker records. */
export const SLACK_SOURCE = "slack-broker";

/** Defensive upper bound on events read when rendering an audit. */
const AUDIT_EVENT_LIMIT = 100_000;

/** The flightrec event kinds this broker emits (subset of `EVENT_KINDS`). */
type BrokerEventKind = "run_meta" | "llm_call" | "decision" | "tool_call" | "cost";

/**
 * Derive a flightrec run id from Slack thread coordinates. One thread = one run
 * = one conversation/black box. Uses `threadTs` (the thread ROOT), never the
 * per-message ts, so every turn in a thread appends to the same run and two
 * messages in one thread never split into separate runs.
 */
export function runIdFor(teamId: string, channelId: string, threadTs: string): string {
  return `${teamId}.${channelId}.${threadTs}`;
}

/** Structured request context — recorded as the run's `run_meta` event. */
export interface RequestMeta {
  /** Authenticated Slack user id of the requester (from the command, not free text). */
  readonly requester: string;
  readonly channel: string;
  readonly threadTs: string;
  /** Structured fields parsed from the slash command / modal (the command channel). */
  readonly action: string;
  readonly targetUser: string;
  readonly resource: string;
  readonly scope: string;
  readonly durationSeconds: number;
}

/** An LLM turn — recorded as an `llm_call` event. Carries the model's advisory
 *  output so the audit reconstructs what the AI reasoned, not just its cost. */
export interface LlmCall {
  readonly model: string;
  readonly purpose: string;
  readonly proposedOutcome: "grant" | "deny";
  readonly rationale: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** The agent's grant/deny choice plus the deterministic gate's verdict. */
export interface Decision {
  readonly outcome: "grant" | "deny";
  /** The deterministic entitlement gate's verdict — code, not LLM prose. */
  readonly gateVerdict: "allow" | "deny";
  readonly reason: string;
}

/** A tool invocation, recorded as a `tool_call` event with `phase: "pre"`.
 *  flightrec pairs it with the matching post by `toolUseId` for the inventory. */
export interface ToolCallPre {
  readonly toolName: string;
  readonly toolUseId: string;
  readonly input: unknown;
}

/** A tool result, recorded as a `tool_call` event with `phase: "post"`. */
export interface ToolCallPost {
  readonly toolName: string;
  readonly toolUseId: string;
  readonly output: unknown;
}

/** Token/cost accounting for the run. `messageId` is the dedup key flightrec
 *  uses to avoid double-counting; it must be unique per cost event. */
export interface Cost {
  readonly messageId: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Audit artifact: the rendered markdown plus the integrity verdict. */
export interface AuditArtifact {
  readonly markdown: string;
  /** True only when the chain verifies (dense, linked, recomputes, head matches). */
  readonly intact: boolean;
  /** 1-based seq of the first broken event when not intact (drives the FAIL card). */
  readonly firstBroken?: number;
  readonly events: number;
}

/**
 * Records one privileged-action run into a flightrec black box. Bind one
 * Recorder per run id (via {@link AuditStore.forRun}); all methods are
 * synchronous.
 */
export class Recorder {
  constructor(
    private readonly db: DatabaseSync,
    readonly runId: string,
  ) {}

  private append(kind: BrokerEventKind, payload: unknown): void {
    appendEvent(this.db, {
      runId: this.runId,
      kind,
      payloadJson: JSON.stringify(payload),
      source: SLACK_SOURCE,
    });
  }

  /** First event: who asked for what (structured request context). */
  recordRequest(meta: RequestMeta): void {
    this.append("run_meta", meta);
  }

  /** A Claude turn. */
  recordLlmCall(call: LlmCall): void {
    this.append("llm_call", call);
  }

  /** The grant/deny choice and the gate verdict that drove it. */
  recordDecision(decision: Decision): void {
    this.append("decision", decision);
  }

  /** A tool invocation (`tool_call` phase "pre"), with the flightrec-expected
   *  `tool_name` + `tool_use_id` so the audit's tool inventory pairs it. */
  recordToolCallPre(pre: ToolCallPre): void {
    this.append("tool_call", {
      phase: "pre",
      tool_name: pre.toolName,
      tool_use_id: pre.toolUseId,
      input: pre.input,
    });
  }

  /** A tool result (`tool_call` phase "post"), paired by `tool_use_id`. */
  recordToolCallPost(post: ToolCallPost): void {
    this.append("tool_call", {
      phase: "post",
      tool_name: post.toolName,
      tool_use_id: post.toolUseId,
      output: post.output,
    });
  }

  /** Token spend, in flightrec's expected `cost` shape (messageId + usage). */
  recordCost(cost: Cost): void {
    this.append("cost", {
      messageId: cost.messageId,
      model: cost.model,
      usage: {
        input_tokens: cost.inputTokens,
        output_tokens: cost.outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    });
  }

  /** Mark the run closed (a separate flightrec call, not an event kind). */
  close(): void {
    closeRun(this.db, this.runId);
  }

  /** Verify the chain. Never trusts the stored head hash; always recomputes. */
  verify(): VerifyResult {
    return verifyRun(this.db, this.runId);
  }

  /**
   * Render the compliance audit artifact for this run: the deterministic
   * markdown report plus the integrity verdict (verbatim from {@link verify}).
   *
   * @throws if the run does not exist.
   */
  audit(): AuditArtifact {
    const model = buildRunModel(this.db, this.runId, process.env, {
      limit: AUDIT_EVENT_LIMIT,
    });
    if (model === null) {
      throw new Error(`flightrec run not found: ${this.runId}`);
    }
    const v = this.verify();
    return {
      markdown: renderAuditMarkdown(model),
      intact: v.ok,
      firstBroken: v.firstBroken,
      events: v.events,
    };
  }
}

/**
 * The audit store: opens the flightrec database once (migrated on open) and
 * hands out a {@link Recorder} per run. The Slack app holds one store for the
 * process and creates a Recorder per privileged-action thread.
 */
export class AuditStore {
  constructor(private readonly db: DatabaseSync) {}

  /** A recorder bound to one run id, sharing this store's database handle. */
  forRun(runId: string): Recorder {
    return new Recorder(this.db, runId);
  }

  /** Close the underlying database handle (releases the file lock). */
  close(): void {
    this.db.close();
  }
}

/**
 * Open (or create) the audit database at `dbPath` and return an
 * {@link AuditStore}. The database is migrated to the current schema on open.
 */
export function openAuditStore(dbPath: string): AuditStore {
  return new AuditStore(openDb(dbPath));
}
