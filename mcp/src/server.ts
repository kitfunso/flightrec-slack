/**
 * flightrec MCP server — exposes the tamper-evident black box as MCP tools so
 * ANY agent (Claude Desktop, Cursor, the flightrec-slack bot) records its
 * actions into one shared, WAL-backed audit DB and can pull a verifiable report.
 *
 * stdio transport; DB path from FLIGHTREC_DB (default ./data/audit.db). The tool
 * logic lives in handlers.ts (unit-tested against a real DB); this file is the
 * thin MCP/stdio wrapper.
 *
 * @module server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openDb, EVENT_KINDS } from "flightrec";
import { createHandlers, type RecordArgs, type RunIdArgs } from "./handlers.js";

function jsonContent(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

async function main(): Promise<void> {
  const dbPath = process.env.FLIGHTREC_DB ?? "data/audit.db";
  const db = openDb(dbPath);
  const h = createHandlers(db);

  const server = new McpServer({ name: "flightrec", version: "0.1.0" });

  server.registerTool(
    "flightrec_record",
    {
      title: "Record an agent event",
      description:
        "Append one event to a run's tamper-evident chain. Writes go through flightrec's redaction + hash boundary; any later edit becomes detectable by flightrec_verify.",
      inputSchema: {
        runId: z.string().describe("the run/conversation id this event belongs to"),
        kind: z.string().describe(`event kind, one of: ${EVENT_KINDS.join(", ")}`),
        payload: z.unknown().describe("the event payload (any JSON value)"),
        source: z.string().optional().describe("provenance label (defaults to 'mcp')"),
      },
    },
    async (args) => jsonContent(h.record(args as RecordArgs)),
  );

  server.registerTool(
    "flightrec_verify",
    {
      title: "Verify a run's integrity",
      description: "Recompute the hash chain for a run and report whether it is intact.",
      inputSchema: { runId: z.string().describe("the run id to verify") },
    },
    async (args) => jsonContent(h.verify(args as RunIdArgs)),
  );

  server.registerTool(
    "flightrec_audit",
    {
      title: "Audit report for a run",
      description: "Return the tamper-evident audit report (integrity verdict + markdown) for a run.",
      inputSchema: { runId: z.string().describe("the run id to audit") },
    },
    async (args) => jsonContent(h.audit(args as RunIdArgs)),
  );

  server.registerTool(
    "flightrec_list_runs",
    {
      title: "List recorded runs",
      description: "List all runs in the shared audit store.",
      inputSchema: {},
    },
    async () => jsonContent(h.listRuns()),
  );

  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
