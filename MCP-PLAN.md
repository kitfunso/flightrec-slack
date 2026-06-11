# MCP integration plan — flightrec as an MCP governance server

**Date:** 2026-06-11 · **Why:** the Slack Agent Challenge judges *Technological
Implementation* (25%, equally weighted) partly on whether the project
"leverage[s] at least one of: Slack AI capabilities, **MCP server integration**,
or real-time search API." The current build uses none. This closes that gap AND
upgrades the pitch from "a bot with an audit log" to **"a reusable governance
layer any MCP agent plugs into"** (lifts *Quality of Idea* + *Potential Impact*
too). It is also the original wedge.

## Thesis

flightrec stops being a library buried inside one Slack bot and becomes a
**standalone MCP server**: any MCP client (the Slack agent, Claude Desktop,
Cursor, a CI agent) records its actions into the same tamper-evident black box
and can pull a verifiable audit. The Slack agent becomes *one client among many*.

## Architecture (revised after plan-review)

```
flightrec            (core; ZERO runtime deps — unchanged; PUBLISHED to npm)
  ^ depends on
flightrec-mcp        (NEW subpackage in this repo; deps @modelcontextprotocol/sdk + zod + flightrec)
  - McpServer over StdioServerTransport
  - tools: flightrec_record / flightrec_verify / flightrec_audit / flightrec_list_runs
  - ALL writes go through flightrec's appendEvent (redaction + hash boundary)
  - points at the SAME audit DB file as everything else
  ^ runs as a standalone MCP server, used by:
flightrec-slack      (UNCHANGED — keeps recording + /audit via the flightrec library)
Claude Desktop / any MCP client   (the reusability demo: a DIFFERENT agent records
                                    into the SAME black box, audited from Slack)
```

The shared black box = **many agents -> one WAL-backed SQLite DB**. flightrec
already sets `journal_mode=WAL` + `busy_timeout=5000` (db.ts), so multiple
processes (the Slack app's flightrec connection, the MCP server, a
Claude-Desktop-spawned server) safely share one DB file. That multi-process WAL
story IS the mechanism that makes flightrec a credible shared governance layer —
NOT a single-owner process.

- **flightrec stays zero-dep** (its product law). The MCP SDK + zod are runtime
  deps of `flightrec-mcp` ONLY.
- Append-only + hash chain means exposing `record` over MCP is safe: a hostile
  client can append garbage but cannot forge a clean chain or alter history;
  `verify` still catches it. Every tool write goes through `appendEvent`, so
  redaction (E5) still runs. `verify`/`audit`/`list` are read-only.

## MCP tools (stdio)

- `flightrec_record` — `{ runId, kind (EVENT_KINDS), payload (object), source? }` → `{ seq, hash, truncated }`
- `flightrec_verify` — `{ runId }` → `{ ok, events, firstBroken?, headHash }`
- `flightrec_audit` — `{ runId }` → `{ intact, events, firstBroken?, markdown }`
- `flightrec_list_runs` — `{}` → `[{ runId, source, headSeq, closedAt }]`

## Design (revised — no Slack-app rewire)

- The Slack app is **untouched** (it keeps recording + /audit via the flightrec
  library). No RecorderBackend interface, no broker rewire — the existing 16
  tests and the security spine stay exactly as they are.
- `flightrec-mcp` is a self-contained server. It gets its OWN real-DB tests
  (call each tool handler against a temp DB) + one stdio integration test (spawn
  the server, record -> verify -> audit round-trip over the wire).
- "The Slack agent itself uses MCP" is OPTIONAL and read-only: if N1+N3 land with
  runway to spare, route `/audit` through the server's `flightrec_audit` tool.
  Never the write path (that was the rejected N2).

## Milestones — TARGET is N1 + N3 (timebox ~1-2 days)

- **N1 — flightrec-mcp server (subpackage).** McpServer + 4 tools + stdio entry;
  all writes via `appendEvent`; real-DB handler tests + one stdio integration
  test. (Publish `flightrec` to npm as a SEPARATE confirmed step so this + the
  app share a clean dep; build N1 on a local dep until then.)
  *Verify:* a stdio MCP client records -> verifies -> audits a run.
- **N3 — reusability demo (the wow).** Claude Desktop config pointing flightrec-mcp
  at the shared DB; record a run from Claude Desktop, then `/audit <runId>` it in
  Slack. *Verify:* a Claude-Desktop-sourced run audits intact in Slack, and a
  tampered one flips to BROKEN — the same black box, two different agents.
- **N4 — pitch.** README architecture diagram + the "any agent, one black box"
  beat for the video.
- **N2 (DEFERRED / optional) — Slack broker records *through* MCP.** Rejected as
  the spine by plan-review (contrived, risky, invisible to judges). Revisit only
  post-submission if there's a reason.

**Runway discipline:** MCP is ~1-2 days and buys ONE criterion + the
differentiation. After N1+N3, STOP and spend remaining runway on the other 75%
of the score — UX/Design polish, the <=3-min video, and the REQUIRED Marketplace
submission. Do not let MCP eat the runway.

## Decisions (resolved by plan-review)

1. **flightrec distribution: PUBLISH to npm** — but as a SEPARATE, explicitly
   confirmed step (public release is irreversible; needs Keith's npm auth).
   Clean `npm i flightrec` for the subpackage + app; no zero-dep violation
   (publishing is not a runtime dep). Verify `npm pack` ships only `dist`, no
   DB/fixtures. Build N1 on a local dep meanwhile. Resolves the open M4 question.
2. **Placement: SUBPACKAGE inside flightrec-slack** (`mcp/`). One clone, one
   submission repo; judges see everything. The reusable story rides on the
   published npm `flightrec` + the README diagram, not repo count.
3. **Submission depth: N1 + N3.** A shipped, demonstrated MCP server + a real
   second client (Claude Desktop) credibly satisfies "leverages MCP server
   integration" and is more legible than the in-process N2 rewire. N2 deferred.
4. **MCP SDK specifics — confirm FIRST at N1 (still open):** exact published
   package name + import paths (`@modelcontextprotocol/sdk/server/mcp.js` vs
   `@modelcontextprotocol/server`) and the zod version the SDK expects. Pin
   before building the tools out (fail-fast on the framework unknown).

## Risks

- **SDK API/version drift** — confirm package + imports + zod at N1 before
  building out (framework-heavy; preload narrowest docs).
- **Subprocess lifecycle** — largely MOOT now: the Slack app spawns nothing (N2
  deferred); Claude Desktop manages its own server child (N3). The only
  lifecycle we own is the MCP server's clean stdio shutdown.
- **Multi-process WAL on one file** — confirm the shared-DB demo works with the
  Slack app's flightrec connection + a Claude-Desktop-spawned server on the same
  absolute DB path (same machine). WAL + busy_timeout cover it; verify at N3.
- **Scope creep** — NO remote transport, NO auth layer, NO multi-tenant. stdio +
  local is the demo. Stop after N1+N3.
- **Don't touch flightrec's zero-dep guarantee** — the SDK lives in flightrec-mcp.

## Changelog
- 2026-06-11: applied consolidated plan-review revisions (1 CRIT single-writer
  claim, 2 HIGH spine + runway, 1 MED placement, 2 LOW). Target reshaped to
  N1+N3; N2 deferred; WAL multi-process model; subpackage; publish flightrec as
  a separate confirmed step.
