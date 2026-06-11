# flightrec-slack — demo video script (≤3 min, Organizations track)

Goal: in under 3 minutes, hit all four EQUAL judging criteria — Quality of Idea,
Technological Implementation, Potential Impact, Design — and open on the wow
(the audit flipping to a tamper violation).

## Pre-record checklist
- Bot running in demo mode: `cd flightrec-slack && FLIGHTREC_DEMO=1 node --env-file=.env dist/app.js`
- `entitlements.json` has your member id on `prod-analytics` (read/write) + `staging-db` (read).
- A clean `#demo` channel (delete prior test messages so the recording is tidy).
- (For the MCP beat, 2:20) Claude Desktop wired to flightrec-mcp on the SAME db.
  If not done, cut that beat — the grant/audit/tamper spine stands alone.
- Screen at 100% zoom, Slack in a clean theme.

## Beat sheet

| Time | On screen | Voiceover (tighten to your delivery) |
|---|---|---|
| 0:00–0:18 | The 🚨 **INTEGRITY VIOLATION** audit card, full-frame | "This is an AI agent's audit trail catching someone tampering with it — in real time. Most AI agents that take real actions have no audit trail at all. flightrec gives every agent a tamper-evident black box." |
| 0:18–0:38 | Slack `#demo`, the flightrec app in the sidebar | "Regulated firms — banks, hospitals — can't deploy AI agents that *do* things, because they can't prove what the agent did. SR 11-7, the EU AI Act: if you can't audit it, you can't ship it. That's the blocker. flightrec removes it." |
| 0:38–1:25 | Type `/grant` → the modal → fill (target, `prod-analytics`, `read`, 1h) → submit → the ✅ grant card | "I ask the agent to grant access. Note the input is a *structured form*, not free text — so a prompt-injection in a Slack message can't drive it. The AI proposes a decision, but a deterministic policy gate — bound to *my* entitlements — is what authorizes it. The model proposes; the gate disposes." |
| 1:25–1:45 | `/grant` again with scope `admin` → ⛔ **denied** card | "Same agent, an over-reach: admin. The AI still leans 'grant' — but the gate refuses, because I'm not entitled to admin. The model can be wrong or jailbroken; the gate can't be talked out of policy." |
| 1:45–2:10 | Click **View audit** → 🔒 **AUDIT VERIFIED** card + report | "Every step is recorded — the request, the AI's reasoning, the decision, the action, the token cost — each one hash-chained to the last. One click, a full compliance report, in Slack." |
| 2:10–2:40 | Run `/audit tamper <runId>` → the card flips to 🚨 **INTEGRITY VIOLATION** | "Now an insider with database access edits the record to hide what really happened. Watch. *(flip)* The chain breaks at the exact altered step. A log file you can edit is worthless — this is a black box. It doesn't prevent the edit; it makes the edit *undeniable*." |
| 2:40–2:55 | (Optional) Claude Desktop records a run → `/audit` that run in Slack | "And flightrec isn't just this bot — it's an MCP server. Here's Claude Desktop writing into the *same* black box. Any agent, one audit trail." |
| 2:55–3:00 | flightrec card / repo | "flightrec: the first Slack AI agent a regulated firm can actually deploy — because every action is provable." |

## Criteria the judges are scoring (name them on screen as lower-thirds)
- **Quality of Idea** — a tamper-evident black box for AI agents; doesn't exist as a Slack agent.
- **Technological Implementation** — MCP server integration + SHA-256 hash chain + append-only SQLite + 22 real-DB tests.
- **Potential Impact** — unlocks AI agents for regulated orgs; AI governance is the #1 enterprise-AI blocker.
- **Design** — verdict-header cards, two-column field grids, one-click audit, the FAIL card.

## Notes
- Keep it UNDER 3:00 — cut the optional MCP beat before you cut the tamper beat.
- The tamper flip (2:10) is the single most important shot. Rehearse it; let it land.
- Record in segments and stitch; don't fight a single take.

## Recording order (clean, no-id commands — use THIS)

`/audit` and `/audit tamper` default to the LATEST run, so no run-id pasting on
camera. Record linearly in this order — the tamper hits the grant because the
grant is the most-recent run at that point:

1. `/grant` → target = you, resource `prod-analytics`, scope **admin**, 1 hour → Request → ⛔ DENIED (gate refuses the over-reach; the LLM still leaned grant).
2. `/grant` → resource `prod-analytics`, scope **read**, 1 hour → Request → ✅ GRANTED.
3. Click the green **View audit** button → 🔒 AUDIT VERIFIED.
4. Type `/audit tamper` (no id) → 🚨 INTEGRITY VIOLATION — the same run flips. The money shot.
5. (Optional) Claude Desktop records a run → `/audit` in Slack shows it.

Cold-open tip: record linearly, then in editing lift the step-4 flip to the
front as a ~5s teaser and cut back to the start.
