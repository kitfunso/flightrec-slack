/**
 * flightrec MCP tool handlers — pure functions bound to one DB handle, so they
 * are directly unit-testable against a real database (no stdio, no mocks). The
 * stdio server (server.ts) is a thin wrapper that registers these as MCP tools.
 *
 * Every write goes through flightrec's `appendEvent` — the redaction + hash
 * boundary — so recording over MCP keeps the same tamper-evidence + scrubbing
 * guarantees as recording in-process.
 *
 * @module handlers
 */
import {
  appendEvent,
  verifyRun,
  buildRunModel,
  renderAuditMarkdown,
  listRuns,
  EVENT_KINDS,
} from "flightrec";
import type { DatabaseSync } from "node:sqlite";

const AUDIT_LIMIT = 100_000;

export interface RecordArgs {
  readonly runId: string;
  readonly kind: string;
  readonly payload?: unknown;
  readonly source?: string;
}
export interface RunIdArgs {
  readonly runId: string;
}

export interface FlightrecHandlers {
  record(args: RecordArgs): Record<string, unknown>;
  verify(args: RunIdArgs): Record<string, unknown>;
  audit(args: RunIdArgs): Record<string, unknown>;
  listRuns(): ReadonlyArray<Record<string, unknown>>;
}

export function createHandlers(db: DatabaseSync): FlightrecHandlers {
  return {
    record({ runId, kind, payload, source }) {
      if (!(EVENT_KINDS as readonly string[]).includes(kind)) {
        return { error: `invalid kind '${kind}'; must be one of: ${EVENT_KINDS.join(", ")}` };
      }
      try {
        const r = appendEvent(db, {
          runId,
          kind: kind as (typeof EVENT_KINDS)[number],
          payloadJson: JSON.stringify(payload ?? {}),
          source: source ?? "mcp",
        });
        return { seq: r.seq, hash: r.hash, truncated: r.truncated };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },

    verify({ runId }) {
      const v = verifyRun(db, runId);
      if (v.notFound === true) {
        return { error: `run not found: ${runId}` };
      }
      return { ok: v.ok, events: v.events, firstBroken: v.firstBroken, headHash: v.headHash };
    },

    audit({ runId }) {
      const model = buildRunModel(db, runId, process.env, { limit: AUDIT_LIMIT });
      if (model === null) {
        return { error: `run not found: ${runId}` };
      }
      const v = verifyRun(db, runId);
      return {
        intact: v.ok,
        events: v.events,
        firstBroken: v.firstBroken,
        markdown: renderAuditMarkdown(model),
      };
    },

    listRuns() {
      return listRuns(db, { limit: AUDIT_LIMIT }).map((r) => ({
        runId: r.runId,
        source: r.source,
        headSeq: r.headSeq,
        closedAt: r.closedAt,
      }));
    },
  };
}
