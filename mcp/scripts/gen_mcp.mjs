// Records a run into the SAME demo DB from a real MCP stdio client (exactly
// what Claude Desktop does), audits it over the wire, then assembles the final
// video/artifacts.js from artifacts-base.json + this MCP section.
// Run from the repo root AFTER video/gen_artifacts.mjs:
//   node mcp/scripts/gen_mcp.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync, writeFileSync } from "node:fs";

const DB = "video/demo-audit.db";
const RUN = "claude-desktop.deploy.model-cta-v5";

const transport = new StdioClientTransport({
  command: "node",
  args: ["mcp/dist/server.js"],
  env: { ...process.env, FLIGHTREC_DB: DB },
});
const client = new Client({ name: "claude-desktop-demo", version: "1.0.0" });
await client.connect(transport);

const text = (r) => r.content?.[0]?.text ?? "";
const call = async (name, args) => JSON.parse(text(await client.callTool({ name, arguments: args })));

const recorded = [];
recorded.push(
  await call("flightrec_record", {
    runId: RUN,
    kind: "run_meta",
    payload: { requester: "claude-desktop", action: "deploy", detail: "push cta-v5 model to prod" },
    source: "claude-desktop",
  }),
);
recorded.push(
  await call("flightrec_record", {
    runId: RUN,
    kind: "tool_call",
    payload: { phase: "pre", tool_name: "deploy.push", tool_use_id: "cd1", input: { model: "cta-v5", target: "prod" } },
    source: "claude-desktop",
  }),
);
recorded.push(
  await call("flightrec_record", {
    runId: RUN,
    kind: "tool_call",
    payload: { phase: "post", tool_name: "deploy.push", tool_use_id: "cd1", output: { ok: true, release: "r-2026-07-03" } },
    source: "claude-desktop",
  }),
);
recorded.push(
  await call("flightrec_record", {
    runId: RUN,
    kind: "decision",
    payload: { outcome: "deployed", note: "recorded by Claude Desktop via flightrec-mcp" },
    source: "claude-desktop",
  }),
);

const audit = await call("flightrec_audit", { runId: RUN });
// the audit tool omits headHash (verify's field); the reel's card wants it
const verify = await call("flightrec_verify", { runId: RUN });
audit.headHash = verify.headHash;
await client.close();

console.log(`mcp run ${RUN}: ${recorded.length} events, audit intact=${audit.intact}, head ${verify.headHash.slice(0, 12)}`);
if (audit.intact !== true) throw new Error("mcp run audit not intact; artifacts invalid");

const baseArtifacts = JSON.parse(readFileSync("video/artifacts-base.json", "utf8"));
const artifacts = { ...baseArtifacts, mcp: { runId: RUN, recorded, audit } };
writeFileSync("video/artifacts.js", "window.ARTIFACTS = " + JSON.stringify(artifacts, null, 2) + ";\n");
console.log("wrote video/artifacts.js");
