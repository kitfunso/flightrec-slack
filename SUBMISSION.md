# Devpost submission package — Slack Agent Builder Challenge

Everything below is ready to paste into the Devpost form. Deadline: **Jul 13, 2026,
5:00pm PDT**. Submit early; do not fight the video upload on deadline day.

## Form fields

**Project name:** flightrec

**Track:** New Slack Agent

**Elevator pitch (tagline):**
Every action this Slack agent takes is recorded in a tamper-evident black box. Edit
the record and the audit catches you at the exact altered step.

**Qualifying technology:** MCP server integration. flightrec ships as a standalone
MCP server (`mcp/`, four tools: record / verify / audit / list_runs) over the same
audit store the Slack agent writes to, so any MCP client (Claude Desktop, Cursor, a
CI agent) records into the same black box that `/audit` verifies from Slack.

**Built with:** typescript, node.js, slack-bolt, anthropic-claude, mcp,
model-context-protocol, sqlite, zod, vitest

**Demo video:** `<YouTube link — record per VIDEO-SCRIPT.md, keep under 3:00>`

**Architecture diagram:** upload `docs/architecture.svg` (or a PNG export of it)

**Repository:** https://github.com/kitfunso/flightrec-slack
(library: https://github.com/kitfunso/flightrec)

**Slack developer sandbox URL:** `<slack-hack workspace URL, e.g. https://<workspace>.slack.com>`

**Sandbox access:** invite `slackhack@salesforce.com` and `testing@devpost.com` to
the workspace (Invite people → email). The bot must be running during judging:
`FLIGHTREC_DEMO=1 node --env-file=.env dist/app.js`.

## Text description (features and functionality)

AI agents that take real actions are blocked in most serious organizations for one
reason: nobody can prove afterward what the agent actually did. Transcripts are
editable, logs are editable, and "trust the vendor dashboard" is not an audit. Model
risk management frameworks (SR 11-7, the EU AI Act) all reduce to the same demand:
if you cannot audit it, you cannot ship it.

flightrec is a Slack agent built around that demand. It is a privileged-action
broker: type `/grant` and a structured form opens (target user, resource, scope,
duration). Claude reasons about the request and its opinion is recorded, but it is
advisory only. A deterministic, parameter-level entitlement gate decides: is THIS
requester entitled to grant THIS scope on THIS resource for THIS duration? The model
proposes; the gate disposes. The model can be wrong or jailbroken; the gate cannot
be talked out of policy.

Every step of every run — the request, the model's rationale and lean, the gate's
verdict, the executed (or refused) action, the token spend — is appended to a
flightrec black box: append-only SQLite where each event is SHA-256 hash-chained to
the previous one. `/audit` renders the attestation card in Slack: AUDIT VERIFIED
with the full replay, or INTEGRITY VIOLATION pointing at the exact sequence number
where the record was altered. The demo command `/audit tamper` plays the attack
live: it simulates an insider with raw database access rewriting one recorded
event, and the next audit flips to a violation. A log you can edit is worthless;
this one makes every edit undeniable.

Two security decisions carry the design. First, command/data-channel separation:
actions are triggered only by the structured modal, and free-text messages are
never instructions, which closes the prompt-injection path by construction. Second,
the parameter-level gate binds to the requester's own entitlements rather than a
verb allow-list, so an injection string in any field is inert data that can only
fail to match. The test suite proves the ordering: a stub reasoner that always
proposes "grant" still gets denied on every over-reach.

flightrec is also not just this bot. The repo ships flightrec-mcp, an MCP server
exposing the black box as four tools (record, verify, audit, list_runs) over the
same WAL-backed database. Claude Desktop, Cursor, or any MCP client records its own
actions into the same audit store, and you can `/audit` those runs from Slack: many
agents, one black box. All writes go through flightrec's append + redaction + hash
boundary, so a hostile client can append junk but can never forge a clean chain or
rewrite history.

The build is TypeScript on Node 22 (built-in `node:sqlite`), Bolt for Slack, the
Anthropic SDK for reasoning, and the MCP SDK for the server. 26 tests run against
real SQLite databases, no store mocks, covering the gate, the broker, the recorder
contract, tamper detection, and an MCP stdio round-trip.

## Testing instructions for judges

1. Join the workspace via the invite, open the `#demo` channel.
2. Run `/grant`: pick any target user, resource `demo-sandbox`, scope `read`,
   duration 1 hour → **GRANTED** (workspace policy entitles every member to grant
   read on the demo resource). Note the card shows what the LLM proposed vs what
   the gate decided.
3. Run `/grant` again with scope `admin` (or resource `prod-analytics`) →
   **DENIED**: you hold no entitlement for it, whatever the model thinks.
4. Click **View audit** on either card → the tamper-evident report:
   request, model rationale, gate verdict, action, token spend, hash-chained.
5. Run `/audit tamper` → a simulated insider edits the stored record out-of-band;
   the attestation flips to INTEGRITY VIOLATION at the exact altered step.

## Pre-submission checklist

- [ ] Record the demo video (VIDEO-SCRIPT.md), upload to YouTube (unlisted is fine)
- [ ] Export `docs/architecture.svg` to PNG if Devpost rejects SVG upload
- [ ] Push latest master to GitHub; confirm repo is public
- [ ] Invite `slackhack@salesforce.com` + `testing@devpost.com` to the workspace
- [ ] Confirm the bot is running with `FLIGHTREC_DEMO=1` and stays running through
      the judging window (leave the PC on, or park it on a small always-on VM;
      Socket Mode needs no public endpoint)
- [ ] Run the judge steps above once yourself as a rehearsal
- [ ] Submit the Devpost form; verify the video plays on the submission page
