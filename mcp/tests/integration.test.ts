/**
 * Integration test: drive the BUILT MCP server over a real stdio transport,
 * exactly as Claude Desktop / Cursor / any MCP client would. Proves (a) the
 * stdio wiring works end to end, and (b) a SECOND process (this test) sees what
 * the server child wrote — the WAL-backed shared-black-box claim. Requires the
 * server to be built; `pretest` builds it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { openDb, verifyRun } from "flightrec";

const dirs: string[] = [];
function freshDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "flightrec-mcp-int-"));
  dirs.push(dir);
  return join(dir, "audit.db");
}
afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) {
      // retry: the just-killed server child may briefly hold the DB file on Windows.
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
});

function textOf(result: unknown): string {
  const r = result as { content?: ReadonlyArray<{ type: string; text?: string }> };
  return r.content?.[0]?.text ?? "";
}

describe("flightrec MCP server over stdio (integration)", () => {
  it("an external client records + audits, and a second process sees it (WAL share)", async () => {
    const dbPath = freshDbPath();
    const transport = new StdioClientTransport({
      command: "node",
      args: ["dist/server.js"],
      env: { ...process.env, FLIGHTREC_DB: dbPath } as Record<string, string>,
    });
    const client = new Client({ name: "flightrec-int-test", version: "1.0.0" });
    await client.connect(transport);

    const rec = await client.callTool({
      name: "flightrec_record",
      arguments: { runId: "RX", kind: "run_meta", payload: { requester: "claude-desktop", resource: "prod" } },
    });
    expect(textOf(rec)).toContain('"seq": 1');

    await client.callTool({
      name: "flightrec_record",
      arguments: { runId: "RX", kind: "decision", payload: { outcome: "grant" } },
    });

    const audit = await client.callTool({ name: "flightrec_audit", arguments: { runId: "RX" } });
    expect(textOf(audit)).toContain('"intact": true');

    await client.close();

    // A SECOND process (this test) opens the SAME file the server child wrote.
    const db = openDb(dbPath);
    const v = verifyRun(db, "RX");
    expect(v.ok).toBe(true);
    expect(v.events).toBe(2);
    db.close();
  });
});
