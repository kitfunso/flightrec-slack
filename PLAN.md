# flightrec-slack — MVP plan (Slack Agent Challenge, Organizations track)

**Date:** 2026-06-11 · **Deadline:** Slack hackathon submission window (≈Jul 13 2026)
**Owner:** Keith So (KITFUNSO LTD) · **Repo:** `C:/Users/skf_s/flightrec-slack` (new, public-able)

## Product

A **privileged-action broker** for Slack: an AI agent that performs sensitive
operations (e.g. "grant Jane 24h read on prod-analytics") *and records every
decision, action, and token of spend into a tamper-evident black box* via
[`flightrec`](../flightrec). A compliance officer can replay any run and prove
no row was altered.

Pitch (Organizations track): **the first Slack AI agent a regulated firm can
actually deploy, because every action is black-box recorded — model risk
management for agents, built in.** The agent is the utility; the tamper-evident
audit + replay is the moat no other entry will have.

## Win condition (judging-aligned)

- **Useful:** a real, believable privileged-action flow that an org would want.
- **Wow:** the replay + tamper-evidence demo (mutate a row → `verify` exits 3).
- **Impact (org):** lets regulated firms put AI agents in Slack without an
  unaccountable-AI compliance veto.
- **Submittable:** working solution + Marketplace submission (App ID).

## Architecture

```
Slack STRUCTURED command (slash command / modal — the ONLY action trigger)
  -> Bolt app (this repo; has runtime deps)
     -> requester check (authorized Slack user?)
     -> PARAMETER-LEVEL policy gate (can THIS requester grant THIS
        scope/resource/duration? — deterministic, in code, NOT the LLM)
     -> agent loop (Claude via @anthropic-ai/sdk)
        -> tool: execute privileged action against MOCK access system
        (free-text thread content is UNTRUSTED DATA, never instructions)
     -> recorder (wraps flightrec lib; zero-dep boundary)
        appendEvent kinds (real EVENT_KINDS only):
          run_meta  (request context: requester, channel, requested scope)
          llm_call  (each Claude turn)
          decision  (agent's grant/deny choice + gate verdict)
          tool_call (the executed/denied action; result carried in payload)
          cost      (token spend)
        then closeRun() — a SEPARATE call, not an event kind
  -> /audit <run>  -> verifyRun + buildRunModel + renderAuditMarkdown
                   -> post attestation CARD to Slack (PASS/FAIL, tool
                      inventory, spend, anomalies, replay timeline)
                   -> tamper demo: out-of-band UPDATE -> attestation flips to
                      FAIL (integrity violation, seq N hash mismatch); CLI
                      exit 3 is the machine contract, the card is the wow
```

- **flightrec stays zero runtime deps** (its product law). The Slack-event ->
  flightrec-event mapping is a dep-free function; candidate to contribute
  upstream as `flightrec/src/adapters/slack.ts` mirroring `claude_code.ts`.
- **flightrec consumption:** publish `flightrec` 0.1.0 to npm (MIT, already
  queued) so this repo does a clean `npm i flightrec`; fall back to
  `"flightrec": "file:../flightrec"` for local dev. (Decision needed: publish
  now vs file-dep through the hackathon.)
- **run = one request/conversation.** run id = Slack
  `{team}.{channel}.{thread_ts}` (thread root, NOT message ts), so the audit
  joins back to the exact Slack thread. Two concurrent requests in the same
  thread are serialized by a **single-writer guard per run-id** (in-process
  queue); confirm flightrec's own `appendEvent` concurrency behavior at M1
  rather than assuming it (it runs under `BEGIN IMMEDIATE`, but verify the
  interleaving guarantee against a real concurrent-write test).
- **redaction vs tamper demo are different paths — keep them visibly
  separate.** flightrec's redaction/`sealAndPrune` is the ONLY sanctioned
  write that touches stored rows; the tamper demo's out-of-band UPDATE is an
  attack. Never let the demo's mutation run through the redaction path, or it
  muddies the integrity claim.

## The security spine (this is a privileged-action agent — non-negotiable)

The scariest failure: a Slack message **prompt-injects** the agent into granting
access it shouldn't. The audit trail proves what happened — it does NOT prevent
a bad grant — so prevention lives in the gate, not the recorder. Mitigations,
all required:
1. **Command channel ≠ data channel (confused-deputy defense).** Privileged
   actions are triggered ONLY by *structured* input — a slash command / modal
   with typed fields (requester, target user, resource, scope, duration). The
   agent NEVER treats free-text thread content as instructions; referenced
   messages are untrusted data. This closes the path where a trusted sender
   quotes (or is socially-engineered by) an attacker's text.
2. **Parameter-level policy gate, not verb-level.** The gate does not ask "are
   grants allowed" — it asks "is THIS authenticated requester entitled to grant
   THIS scope on THIS resource for THIS duration." A verb allow-list would pass
   "grant attacker admin on prod" whenever attacker + prod are each individually
   allow-listed; the gate must bind to the requester's own entitlements. The LLM
   proposes parameters; the deterministic gate (in code) disposes. A denied
   action is still recorded (denied tool calls are exactly what flightrec
   captures that transcripts miss).
3. **Requester check** — only authorized Slack users reach the agent loop at
   all; enforced before any LLM call.
4. **Minimal OAuth scopes** (Marketplace requires granular permissions anyway).
5. **The audit trail is the accountability control** (not the prevention
   control): every grant/denial is provable, replayable, tamper-evident.
6. **Redaction (flightrec E5)** scrubs secrets/PII from the recorded payloads.

For the MVP demo the privileged action targets a **mock internal access
system** (in-repo) — deterministic, safe, and enough to tell the story. A real
integration (GitHub repo access, etc.) is a stretch goal, not MVP.

## Milestones (timeboxed)

- **M1 — Foundation.** Repo scaffold (TS, Node >=22.13, vitest, real-DB tests),
  flightrec dep wired, `recorder` module, Bolt app in Socket Mode posting a
  recorded "hello" run. *Verify:* a Slack message produces a flightrec run that
  `verify` passes.
- **M2 — Broker core.** Structured slash-command/modal trigger -> requester
  check -> agent loop (Claude) -> parameter-level policy gate -> mock access
  system -> recorded as `run_meta`/`llm_call`/`decision`/`tool_call`/`cost`
  then `closeRun`. *Verify:* grant + deny paths both recorded; an injection
  attempt embedded in thread text is ignored (data, not instructions) AND a
  parameter-level over-reach (requester lacks entitlement) is denied by the
  gate with the denial in the audit.
- **M3 — Audit surface + tamper demo.** `/audit <run>` posts an attestation
  CARD + replay timeline to Slack; out-of-band row mutation flips the card to
  **FAIL (integrity violation, seq N hash mismatch)** (CLI exit 3 underneath).
  *Verify:* golden audit content; tamper test red->green; the FAIL card
  renders in-channel (this is the demo's lead shot, not a terminal exit code).
- **M4 — Demo polish.** Architecture diagram, README, ~3-min video script that
  OPENS on the FAIL card, recorded demo. *Verify:* full demo runs end to end on
  the sandbox.
- **M5 — Submission final-mile (PARALLEL FROM DAY 1, not last).** The 5-active-
  install gate is the long-pole, so it starts now: public OAuth distribution +
  TLS host, privacy-policy URL, OAuth redirect, Marketplace listing assets, and
  recruiting ~5 active workspaces (used in past 28d) to install + use the app.
  Submit to Slack Marketplace -> capture App ID. *Verify:* App ID in hand;
  submission confirmed during the window.

## Defaults taken (bounded; flag if wrong)

- **Slack sandbox:** create a fresh free Slack workspace as the dev sandbox; add
  `slackhack@salesforce.com` + `testing@devpost.com` at submission.
- **Privileged-action target:** mock in-repo access system for the MVP
  (determinism + safety); real integration is stretch.
- **Build mechanism:** follow the dev-framework gates (this plan-review now;
  verify/review/ship later). Running it as a formal `/dev-framework-rl` episode
  is optional given the deadline — decide at execute.

## Risks

- **5-install hustle** (Marketplace submission gate) — M5 runs parallel from
  day 1. Fallback if installs stall: the *agent build* reuses wholesale for the
  Good track, but Good-track judging criteria + deliverables differ and the
  App-ID proof is Organizations-specific — re-confirm Good-track rules before
  relying on the pivot (it is NOT a free zero-cost switch, only a no-rebuild
  one).
- **Prompt injection on a privileged agent** — mitigated by the two-part M2
  defense: command-channel/data-channel separation + parameter-level
  entitlement gate. This is the make-or-break security design; if either half
  is weak the product's whole premise (safe AI in a regulated Slack) fails.
- **flightrec consumption** (publish vs file-dep) — low risk, decide at M1.
- **Scope creep** — MVP is mock target + one clean flow + the replay/tamper
  demo. Resist adding real integrations before the demo is solid.

## Plan-review resolutions (2026-06-11, senior-code-reviewer + verified facts)

1. **Prompt-injection sufficiency — HOLE FOUND, fixed.** A verb-level gate was
   insufficient. Now: command/data-channel separation + parameter-level
   entitlement gate (§security spine 1-2).
2. **Run-id — FIXED.** `{team}.{channel}.{thread_ts}` + single-writer guard per
   run-id; confirm flightrec concurrency at M1 (§architecture).
3. **flightrec consumption — OPEN, decide at M1.** Publish 0.1.0 to npm (clean
   `npm i flightrec`, public repo looks self-contained) vs `file:../flightrec`
   (no publish dependency). Leaning publish, since the hackathon repo is public
   and a real npm dep reads as production-grade.
4. **Marketplace feasibility — CONFIRMED.** ~5 active installs (28-day window)
   is the real pre-submit gate; privacy-policy URL + TLS OAuth redirect are also
   hard pre-reqs; the security review happens *during* approval, not before
   submission, so it is not a pre-submit blocker. M5 starts day 1 to de-risk.

## Changelog
- 2026-06-11: applied consolidated plan-review revisions (2 CRIT security, 2
  HIGH architecture, 3 MED, 1 LOW). Plan cleared to execute.
