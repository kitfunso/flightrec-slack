// Records the demo reel: drives video/demo.html scene by scene at the beat
// timings in VOICEOVER.md, capturing 1920x1080 webm. Encode afterwards with:
//   ffmpeg -i <webm> -c:v libx264 -pix_fmt yuv420p -r 30 -movflags +faststart video/flightrec-demo.mp4
// Run from the repo root: node video/record.mjs
import { createRequire } from "node:module";
const require = createRequire("C:/Users/skf_s/AppData/Roaming/npm/node_modules/@playwright/mcp/");
const { chromium } = require("playwright");

const URL = "file:///C:/Users/skf_s/flightrec-slack/video/demo.html?intro=1";
const OUT = "C:/Users/skf_s/flightrec-slack/video";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();

const wait = (ms) => page.waitForTimeout(ms);
const intro = (big, sub) => page.evaluate(([b, s]) => window.frIntro(b, s), [big, sub]);
const cap = (t) => page.evaluate((x) => window.frCap(x), t);
const chip = (t) => page.evaluate((x) => window.frChip(x), t);
const run = (fn, ...args) => page.evaluate(([f, a]) => window[f](...a), [fn, args]);

await page.goto(URL, { waitUntil: "commit" });
await page.waitForFunction(() => window.frIntro && window.ARTIFACTS);

// S0 0:00 title card
await intro('<span style="color:#4ec9b0">🔒</span> flightrec', "EVERY AGENT ACTION, PROVABLE");
await wait(5000);

// S1 0:05 cold open: the broken audit, full frame
await run("sceneColdOpen");
await intro("", "");
await cap("This audit trail just caught someone editing it.");
await wait(12000);

// S2 0:17 the problem
await cap("");
await intro("Regulated firms can't deploy AI agents that <em>act</em>.", "IF YOU CAN'T AUDIT IT, YOU CAN'T SHIP IT");
await wait(8000);
await intro("flightrec gives every agent a black box.", "APPEND-ONLY · HASH-CHAINED · TAMPER-EVIDENT");
await wait(9000);

// S3 0:34 the structured command channel
await run("sceneModal");
await intro("", "");
await chip("Slack agent");
await cap("/grant opens a structured form. Free text is never an instruction.");
await wait(3000);
await run("modalFill", "target", '<span class="mention">@Jane Osei</span>');
await wait(2500);
await run("modalFill", "resource", "prod-analytics", true);
await wait(2500);
await run("modalFill", "resource", "prod-analytics");
await run("modalFill", "scope", "read");
await wait(2500);
await run("modalFill", "duration", "1 hour");
await wait(2000);
await cap("Claude reasons about it — advisory. A deterministic entitlement gate decides.");
await wait(5500);
await run("modalSubmit");
await wait(2000);

// S4 0:57 the grant card
await run("sceneGrant");
await cap("Granted. And every step of it just went into the black box.");
await wait(15000);

// S5 1:12 the over-reach deny — the money property
await run("sceneDeny");
await cap("Over-reach: admin. The model proposed GRANT — the gate refused. The gate cannot be talked out of policy.");
await wait(17000);

// S6 1:29 the audit report
await run("sceneAuditOk");
await chip("Tamper-evident audit");
await cap("One click: request, rationale, decision, action, token spend — each event hash-linked to the last.");
await wait(7000);
await run("scrollReport", 430);
await wait(12000);

// S7 1:48 the attack
await cap("Now an insider with database access rewrites the record.");
await run("sceneTamper");
await wait(12000);
await run("sceneBroken");
await cap("The chain breaks at the exact altered step. The edit is undeniable.");
await wait(14000);

// S8 2:14 MCP: two agents, one black box
await chip("MCP server integration");
await run("sceneMcp");
await cap("flightrec is also an MCP server — Claude Desktop records into the SAME black box, audited from Slack.");
await wait(22000);

// S9 2:36 close
await chip("");
await cap("");
await run("go", "close");
await wait(14000);

await ctx.close();
const v = await page.video().path();
console.log("VIDEO:", v);
await browser.close();
