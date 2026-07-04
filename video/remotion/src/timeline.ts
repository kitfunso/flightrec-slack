// The beat sheet as data. Durations in seconds; every scene, caption, and chip
// hangs off this one table so re-timing the video is a one-file edit.
export const FPS = 30;
export const sec = (s: number): number => Math.round(s * FPS);

export const SCENES = [
  { id: "title", dur: 7 },
  { id: "problem", dur: 9 },
  { id: "solution", dur: 8 },
  { id: "modal", dur: 24 },
  { id: "grant", dur: 17 },
  { id: "deny", dur: 18 },
  { id: "auditOk", dur: 25 },
  { id: "turn", dur: 7 },
  { id: "tamper", dur: 15 },
  { id: "broken", dur: 15 },
  { id: "mcp", dur: 22 },
  { id: "close", dur: 10 },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

const starts: Record<string, number> = {};
{
  let at = 0;
  for (const s of SCENES) {
    starts[s.id] = at;
    at += s.dur;
  }
}

/** Scene start in seconds from the top of the video. */
export const startOf = (id: SceneId): number => starts[id];
/** Scene duration in seconds. */
export const durOf = (id: SceneId): number =>
  SCENES.find((s) => s.id === id)!.dur;

export const TOTAL_SECONDS = SCENES.reduce((a, s) => a + s.dur, 0);
export const TOTAL_FRAMES = sec(TOTAL_SECONDS);

// Bottom captions, absolute seconds. No free-floating numbers: anchor to scenes.
const cap = (
  scene: SceneId,
  from: number,
  to: number,
  text: string
): { from: number; to: number; text: string } => ({
  from: startOf(scene) + from,
  to: startOf(scene) + to,
  text,
});

export const CAPTIONS = [
  cap("modal", 1.5, 9.5, "/grant opens a structured form. Free text is never an instruction."),
  cap("modal", 11, 23, "Claude's reasoning is advisory. A deterministic gate, bound to the requester's own entitlements, decides."),
  cap("grant", 1.5, 15, "Granted. Every step of it just went into the black box."),
  cap("deny", 1, 17, "Over-reach: admin. The model still proposed GRANT. The gate refused; it cannot be talked out of policy."),
  cap("auditOk", 1.5, 16, "One click: request, rationale, decision, action, token spend. Each event hash-linked to the last."),
  cap("tamper", 1.5, 14, "An insider with database access rewrites the record. No API. No permissions."),
  cap("broken", 0.5, 13.5, "The chain breaks at the exact altered step. The edit is undeniable."),
  cap("mcp", 1.5, 19, "flightrec is also an MCP server. Claude Desktop records into the SAME black box, audited from Slack."),
];

export const CHIPS = [
  { from: startOf("modal"), to: startOf("turn"), text: "Slack agent" },
  { from: startOf("tamper"), to: startOf("mcp"), text: "Tamper-evident audit" },
  { from: startOf("mcp"), to: startOf("close"), text: "MCP server integration" },
];
