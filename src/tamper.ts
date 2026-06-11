/**
 * DEMO-ONLY tamper simulation.
 *
 * Simulates an attacker with raw database access: it drops flightrec's
 * append-only triggers and rewrites a recorded event for a run out-of-band
 * (bypassing the append path entirely), then PUTS THE TRIGGERS BACK so the app
 * keeps recording safely afterwards. The point is to prove the black box
 * catches it — the next audit of that run reports BROKEN.
 *
 * Gated behind FLIGHTREC_DEMO=1 in the app; a real deployment never exposes it.
 * It does not weaken flightrec's guarantees — it IS the external attack the
 * hash chain is designed to detect.
 *
 * @module tamper
 */
import { DatabaseSync } from "node:sqlite";
import { buildTriggersDdl, buildSealsTriggersDdl } from "flightrec";

export interface TamperResult {
  readonly tampered: boolean;
  readonly detail: string;
}

/**
 * Rewrite one recorded event for `runId` via a raw connection, after dropping
 * the append-only triggers (as an attacker would), then restore the triggers.
 * Prefers the recorded action (`tool_call`); falls back to the `decision` event.
 */
export function simulateTamper(dbPath: string, runId: string): TamperResult {
  const db = new DatabaseSync(dbPath);
  try {
    const triggers = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
      .all() as unknown as ReadonlyArray<{ name: string }>;
    for (const trigger of triggers) {
      db.exec(`DROP TRIGGER IF EXISTS "${trigger.name}"`);
    }

    const pick = (kind: string): { seq: number; payload: string } | undefined =>
      db
        .prepare("SELECT seq, payload FROM events WHERE run_id = ? AND kind = ? ORDER BY seq LIMIT 1")
        .get(runId, kind) as unknown as { seq: number; payload: string } | undefined;

    const target = pick("tool_call") ?? pick("decision");
    let result: TamperResult;
    if (target === undefined) {
      result = { tampered: false, detail: `no tamperable event found for run ${runId}` };
    } else {
      let original: Record<string, unknown>;
      try {
        original = JSON.parse(target.payload) as Record<string, unknown>;
      } catch {
        original = {};
      }
      const mutated = JSON.stringify({
        ...original,
        _TAMPERED: "scope secretly escalated to admin on prod-secrets after the fact",
      });
      db.prepare("UPDATE events SET payload = ? WHERE run_id = ? AND seq = ?").run(
        mutated,
        runId,
        target.seq,
      );
      result = { tampered: true, detail: `rewrote a recorded event at seq ${target.seq}` };
    }

    // Restore append-only protection: the tamper to THIS run persists (its
    // chain stays broken), but future appends are guarded again.
    db.exec(buildTriggersDdl());
    db.exec(buildSealsTriggersDdl());
    return result;
  } finally {
    db.close();
  }
}
