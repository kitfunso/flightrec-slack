// Validate live credentials without printing them.
// Run: node --env-file=.env scripts/smoke_creds.mjs
const bot = process.env.SLACK_BOT_TOKEN ?? "";
const app = process.env.SLACK_APP_TOKEN ?? "";
const anthropic = process.env.ANTHROPIC_API_KEY ?? "";

const mask = (t) => (t ? `${t.slice(0, 6)}...(${t.length} chars)` : "(missing)");

console.log("token prefixes:");
console.log("  SLACK_BOT_TOKEN  :", bot.startsWith("xoxb-") ? "xoxb- OK" : `UNEXPECTED ${mask(bot)}`);
console.log("  SLACK_APP_TOKEN  :", app.startsWith("xapp-") ? "xapp- OK" : `UNEXPECTED ${mask(app)}`);
console.log("  ANTHROPIC_API_KEY:", anthropic.startsWith("sk-ant-") ? "sk-ant- OK" : `UNEXPECTED ${mask(anthropic)}`);

// Slack auth.test — works with any valid token, no special scope.
try {
  const r = await fetch("https://slack.com/api/auth.test", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bot}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const j = await r.json();
  console.log(
    j.ok
      ? `\nSlack auth.test : OK  team='${j.team}' user='${j.user}' bot_id='${j.bot_id ?? ""}'`
      : `\nSlack auth.test : FAIL  ${j.error}`,
  );
} catch (e) {
  console.log("\nSlack auth.test : ERROR", e.message);
}

// Anthropic — one 1-token call to confirm the key bills and the model resolves.
try {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropic,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  const j = await r.json();
  console.log(
    r.ok
      ? `Anthropic msgs  : OK  model='${j.model}' stop='${j.stop_reason}'`
      : `Anthropic msgs  : FAIL  ${r.status} ${j.error?.type}: ${j.error?.message}`,
  );
} catch (e) {
  console.log("Anthropic msgs  : ERROR", e.message);
}
