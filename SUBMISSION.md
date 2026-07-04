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

**Demo video:** `<YouTube link>` (source: `video/flightrec-demo-voiced.mp4`, 2:57,
voiced + verified 2026-07-04)

**Architecture diagram:** upload `docs/architecture.png` (2x PNG export of
`docs/architecture.svg`; Devpost accepts only pdf/png/jpg)

**Repository:** https://github.com/kitfunso/flightrec-slack
(library: https://github.com/kitfunso/flightrec)

**Slack developer sandbox URL:** https://slack-hacktalk.slack.com/
(team "slack-hack"; verified live via auth.test 2026-07-04)

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

## Devpost story sections

### Inspiration

I build trading systems for a living. In that world nobody argues about whether
an action happened: every order leaves a replayable trail. AI agents are the
opposite. They are getting arms and legs, and the evidence story has not kept
up. A transcript in a database row is not evidence, because anyone with access
can rewrite it after the fact. Meanwhile every serious compliance framework
(SR 11-7, the EU AI Act) reduces to the same demand: if you cannot prove what
the system did, you cannot ship it.

Aviation solved this decades ago with the flight recorder. Crashes still
happen; arguments about what happened do not. flightrec brings the same physics
to Slack agents: make the record itself trustworthy, instead of asking anyone
to trust the agent.

### What it does

flightrec is a privileged-action broker for Slack. `/grant` opens a structured
modal (target user, resource, scope, duration). Claude reasons about the
request and its opinion is recorded, but it is advisory only. A deterministic,
parameter-level entitlement gate decides: is THIS requester entitled to grant
THIS scope on THIS resource for THIS duration? The model proposes; the gate
disposes.

Every step of every run (the request, the model's rationale and lean, the
gate's verdict, the executed or refused action, the token spend) is appended to
a black box: append-only SQLite where each event is SHA-256 hash-chained to the
previous one. `/audit` renders the attestation in Slack: AUDIT VERIFIED with a
full replay, or INTEGRITY VIOLATION pointing at the exact sequence number that
was altered. The verdict is recomputed from the chain every time, never read
from a stored flag.

`/audit tamper` (demo mode only) stages the attack live: a simulated insider
with raw database access rewrites one recorded event, and the next audit flips
to a violation at that exact step.

And flightrec is not just this bot. The repo ships flightrec-mcp, an MCP server
exposing the same black box as four tools (record / verify / audit /
list_runs). Claude Desktop or any MCP client records its own runs into the same
store, and you can `/audit` those runs from Slack. Many agents, one audit
trail.

### How we built it

TypeScript on Node 22 with the built-in `node:sqlite` (no external database),
Bolt over Socket Mode, the Anthropic SDK with Claude Haiku 4.5 as the reasoner,
the MCP SDK for the server, zod for schemas, vitest for tests. The core
flightrec library is zero-dependency; every write goes through one append +
redaction + hash boundary. Append-only is enforced with SQLite triggers, and
the MCP server shares the database with the Slack app through WAL mode, which
we proved cross-process: one process records over stdio, a second opens the
same file and verifies the chain.

26 tests run against real SQLite databases, no store mocks: the gate, the
broker, the recorder contract, tamper detection, and an MCP stdio round-trip.

Even the demo video is generated from real data: a script drives the live
pipeline (real Claude calls, a real tamper, a real MCP round-trip), saves the
artifacts, and a Remotion composition renders the scenes from them. Nothing on
screen is mocked up.

### Challenges we ran into

**Getting the trust boundary right.** The first design review flagged two
critical gaps, and both fixes became the architecture. Actions can only come
from the structured modal, so free text is never an instruction and prompt
injection is closed by construction rather than by filtering. And the gate
binds to the requester's own entitlements at parameter level, not a verb
allow-list, so an injected string in any field is inert data that can only fail
to match.

**Proving the gate outranks the model.** A stub reasoner that always proposes
"grant" still gets denied on every over-reach in the test suite. Then the live
model did it for real: on the admin over-reach demo, Claude proposed GRANT and
it did not matter. The card shows both, which is the honest version of "the AI
is not in charge here."

**Slack delivery.** `chat.postMessage` fails with `not_in_channel` when the bot
is not a member, so results are delivered through the slash command's
`response_url`, threaded through the modal's `private_metadata`.

**A mid-hackathon track pivot.** We discovered that Socket Mode apps cannot be
distributed through the Slack Marketplace, which the Organizations track
requires. Rather than burn the runway on an HTTP migration, we entered the New
Slack Agent track and spent the time on the MCP server and the demo.

**Making the tamper demo real.** It would have been easy to render a fake
violation card. Instead `/audit tamper` genuinely drops the append-only
triggers, rewrites the stored row, restores the triggers, and lets the normal
audit path discover the break. What you see is detection, not theatre.

### Accomplishments that we're proud of

- The security ordering holds against the live model: Claude proposed GRANT on
  an over-reach and the deterministic gate refused, on camera, with both
  recorded in the audit.
- Tamper detection that names the exact altered event, not just "something
  changed".
- Two different agents (a Slack bot and Claude Desktop) writing to one shared
  black box, verified across processes.
- 26 tests against real databases, zero mocked stores, and a zero-dependency
  core library.
- A demo any judge can self-serve: every workspace member is entitled to grant
  read on the demo resource, and every over-reach denies.

### What we learned

- "The model proposes, the gate disposes" generalizes to any agent that takes
  privileged actions. Record the model's opinion as evidence; never treat it as
  authority.
- Closing prompt injection by construction (a structured command channel) is
  simpler and stronger than trying to filter free text.
- Tamper evidence is cheap. A SHA-256 hash chain plus append-only triggers on
  stock SQLite gives you a black box with zero infrastructure.
- Slack platform details matter: `response_url` lifetimes, Socket Mode's
  Marketplace restriction, and modals doubling as a security boundary.

### What's next for flightrec

- Publish the zero-dependency flightrec core library to npm.
- Put real access systems behind the gate (Okta, cloud IAM, GitHub, database
  grants) with the same attestation cards.
- HTTP + OAuth distribution so the broker can enter the Slack Marketplace.
- Dual-control approval flows, recorded in the same chain.
- Anchor head hashes externally (a transparency log or RFC 3161 timestamps) so
  even the database owner cannot silently rewrite history.
- Retention and redaction policies for sensitive payloads, on top of the
  existing redaction boundary.

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

- [x] Record the demo video — DONE 2026-07-04: `video/flightrec-demo-voiced.mp4`
      (2:57, Remotion cut + Keith's narration re-timed and verified)
- [ ] Upload the video to YouTube (unlisted is fine), paste the link above
- [x] Export the diagram to PNG — DONE: `docs/architecture.png` (Devpost only
      accepts pdf/png/jpg)
- [x] Push latest master to GitHub; confirm repo is public
- [x] Invite `slackhack@salesforce.com` + `testing@devpost.com` — DONE 2026-07-02,
      pre-added to #demo and #demo2
- [x] Bot running with `FLIGHTREC_DEMO=1` (restart after any reboot; leave the PC
      on through judging — Socket Mode needs no public endpoint)
- [ ] Run the judge steps above once yourself as a rehearsal
- [ ] Submit the Devpost form; verify the video plays on the submission page
