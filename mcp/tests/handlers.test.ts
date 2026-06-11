import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDb } from "flightrec";
import { createHandlers } from "../src/handlers.js";

const dirs: string[] = [];
function freshDb(): { db: DatabaseSync; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "flightrec-mcp-"));
  dirs.push(dir);
  const path = join(dir, "audit.db");
  return { db: openDb(path), path };
}
afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d !== undefined) {
      rmSync(d, { recursive: true, force: true });
    }
  }
});

describe("flightrec MCP handlers", () => {
  it("records events and verifies/audits a run intact", () => {
    const { db } = freshDb();
    const h = createHandlers(db);
    expect(
      h.record({ runId: "R1", kind: "run_meta", payload: { requester: "U1", resource: "prod-analytics" } }),
    ).toMatchObject({ seq: 1 });
    h.record({ runId: "R1", kind: "decision", payload: { outcome: "grant" } });

    expect(h.verify({ runId: "R1" })).toMatchObject({ ok: true, events: 2 });
    const a = h.audit({ runId: "R1" });
    expect(a).toMatchObject({ intact: true });
    expect(String((a as { markdown?: string }).markdown)).toContain("verdict: OK");
    db.close();
  });

  it("rejects an invalid event kind", () => {
    const { db } = freshDb();
    expect(createHandlers(db).record({ runId: "R1", kind: "not_a_kind", payload: {} })).toHaveProperty("error");
    db.close();
  });

  it("reports not-found for unknown runs", () => {
    const { db } = freshDb();
    const h = createHandlers(db);
    expect(h.verify({ runId: "nope" })).toHaveProperty("error");
    expect(h.audit({ runId: "nope" })).toHaveProperty("error");
    db.close();
  });

  it("lists recorded runs", () => {
    const { db } = freshDb();
    const h = createHandlers(db);
    h.record({ runId: "R1", kind: "run_meta", payload: {} });
    h.record({ runId: "R2", kind: "run_meta", payload: {} });
    expect(h.listRuns()).toHaveLength(2);
    db.close();
  });

  it("audit flips to BROKEN after an out-of-band edit (MCP surfaces flightrec's tamper-evidence)", () => {
    const { db, path } = freshDb();
    const h = createHandlers(db);
    h.record({ runId: "R1", kind: "run_meta", payload: { a: 1 } });
    h.record({ runId: "R1", kind: "decision", payload: { outcome: "grant" } });
    expect(h.audit({ runId: "R1" })).toMatchObject({ intact: true });
    db.close();

    const raw = new DatabaseSync(path);
    for (const t of raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
      .all() as Array<{ name: string }>) {
      raw.exec(`DROP TRIGGER IF EXISTS "${t.name}"`);
    }
    raw
      .prepare("UPDATE events SET payload = ? WHERE run_id = ? AND kind = 'decision'")
      .run(JSON.stringify({ outcome: "flipped" }), "R1");
    raw.close();

    const db2 = openDb(path);
    expect(createHandlers(db2).audit({ runId: "R1" })).toMatchObject({ intact: false });
    db2.close();
  });
});
