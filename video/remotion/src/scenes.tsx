import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  Appear,
  AppMsg,
  AuditCard,
  BigCard,
  DecisionCard,
  GrantModal,
  Mention,
  SlackFrame,
  Terminal,
  typed,
  UserMsg,
  WordmarkCard,
} from "./components";
import { durOf, FPS } from "./timeline";
import A from "./artifacts.json";

const useT = (): number => useCurrentFrame() / FPS;

/** Fade a full-frame dark card in and out. */
const DarkFade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const t = useT();
  const opacity =
    interpolate(t, [0, 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(t, [dur - 0.45, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ position: "absolute", inset: 0, opacity }}>{children}</div>;
};

/* ---------- S0 title ---------- */
export const TitleScene: React.FC = () => (
  <DarkFade dur={durOf("title")}>
    <WordmarkCard tagline="a Slack agent with a tamper-evident black box" />
  </DarkFade>
);

/* ---------- S1 problem ---------- */
export const ProblemScene: React.FC = () => (
  <DarkFade dur={durOf("problem")}>
    <BigCard
      big={<>Regulated firms can&rsquo;t deploy AI agents that <em>act</em>.</>}
      sub="IF YOU CAN'T AUDIT IT, YOU CAN'T SHIP IT"
    />
  </DarkFade>
);

/* ---------- S2 solution ---------- */
export const SolutionScene: React.FC = () => (
  <DarkFade dur={durOf("solution")}>
    <BigCard
      big={<>flightrec gives every agent a <em>black box</em>.</>}
      sub="APPEND-ONLY · HASH-CHAINED · TAMPER-EVIDENT"
    />
  </DarkFade>
);

/* ---------- S3 the structured command channel ---------- */
export const ModalScene: React.FC = () => {
  const t = useT();
  const resourceFull = A.grant.req.resource;
  const resourceTyped = typed(resourceFull, t, 5, 10);
  const typingDone = 5 + resourceFull.length / 10;
  const modalOpacity = interpolate(t, [1, 1.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <SlackFrame
      overlay={
        <div style={{ position: "absolute", inset: 0, opacity: modalOpacity }}>
          {modalOpacity > 0 ? (
            <GrantModal
              target={t >= 3.5 ? <Mention id={A.grant.req.targetUser} /> : undefined}
              resource={resourceTyped || undefined}
              resourceCursor={t >= 5 && t < typingDone + 0.4}
              scope={t >= 7.6 ? A.grant.req.scope : undefined}
              duration={t >= 9 ? "1 hour" : undefined}
              pressed={t >= 21.5}
            />
          ) : null}
        </div>
      }
    >
      <UserMsg cmd="/grant" />
    </SlackFrame>
  );
};

/* ---------- S4 the grant card ---------- */
export const GrantScene: React.FC = () => (
  <SlackFrame>
    <UserMsg cmd="/grant" />
    <Appear at={0.8}>
      <AppMsg>
        <DecisionCard d={A.grant} />
      </AppMsg>
    </Appear>
  </SlackFrame>
);

/* ---------- S5 the over-reach deny ---------- */
export const DenyScene: React.FC = () => (
  <SlackFrame>
    <Appear at={0.6}>
      <AppMsg>
        <DecisionCard d={A.deny} />
      </AppMsg>
    </Appear>
  </SlackFrame>
);

/* ---------- S6 the audit report ---------- */
export const AuditOkScene: React.FC = () => {
  const t = useT();
  const scrollY = interpolate(t, [9, 17], [0, 430], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <SlackFrame>
      <Appear at={0.6}>
        <AppMsg>
          <AuditCard audit={A.grant.audit} runId={A.grant.res.runId} scrollY={scrollY} />
        </AppMsg>
      </Appear>
    </SlackFrame>
  );
};

/* ---------- S7a the turn ---------- */
export const TurnScene: React.FC = () => (
  <DarkFade dur={durOf("turn")}>
    <BigCard
      big={<>A log you can <em>edit</em> is worthless.</>}
      sub="WHAT IF SOMEONE REWRITES THE HISTORY?"
    />
  </DarkFade>
);

/* ---------- S7b the attack ---------- */
const UPDATE_SQL =
  "UPDATE events\n   SET payload = json_insert(payload, '$._TAMPERED',\n" +
  "       'scope secretly escalated to admin on prod-secrets after the fact')\n" +
  ` WHERE run_id = '${A.grant.res.runId}' AND seq = 4;`;

const TERM_SCHEDULE: { ch: string; at: number }[] = (() => {
  const chars: { ch: string; at: number }[] = [];
  let t = 1.2;
  const push = (s: string, perCharMs: number, pause = 0) => {
    t += pause;
    for (const ch of s) {
      chars.push({ ch, at: t });
      t += perCharMs / 1000;
    }
  };
  push("sqlite> ", 0);
  push("DROP TRIGGER events_no_update;", 45);
  push("\nsqlite> ", 0, 0.5);
  push(UPDATE_SQL, 22);
  push("\nsqlite> ", 0, 0.4);
  return chars;
})();

export const TamperScene: React.FC = () => {
  const t = useT();
  const text = TERM_SCHEDULE.filter((c) => c.at <= t)
    .map((c) => c.ch)
    .join("");
  return (
    <SlackFrame
      overlay={
        <Appear at={0.5} fill>
          <Terminal text={text} />
        </Appear>
      }
    >
      <AppMsg>
        <AuditCard audit={A.grant.audit} runId={A.grant.res.runId} scrollY={430} />
      </AppMsg>
    </SlackFrame>
  );
};

/* ---------- S7c the catch ---------- */
export const BrokenScene: React.FC = () => (
  <SlackFrame>
    <UserMsg cmd="/audit" />
    <Appear at={0.6}>
      <AppMsg>
        <AuditCard audit={A.tampered.audit} runId={A.grant.res.runId} />
      </AppMsg>
    </Appear>
  </SlackFrame>
);

/* ---------- S8 MCP: two agents, one black box ---------- */
export const McpScene: React.FC = () => {
  const rec = A.mcp.recorded;
  return (
    <div className="split" style={{ position: "absolute", inset: 0 }}>
      <div className="cd">
        <div className="bar">
          <i style={{ background: "#ff5f57" }} />
          <i style={{ background: "#febc2e" }} />
          <i style={{ background: "#28c840" }} />
          &nbsp;Claude Desktop
        </div>
        <div className="body">
          <Appear at={1}>
            <div className="u">
              Push the cta-v5 model to prod, and record every step in the flightrec black box.
            </div>
          </Appear>
          <Appear at={3}>
            <div className="a">
              Deploying now. Recording each step to the shared audit store via flightrec-mcp:
            </div>
          </Appear>
          <Appear at={5}>
            <div className="tool">
              <b>flightrec_record</b> run_meta → seq {rec[0].seq} · {rec[0].hash.slice(0, 12)}…
            </div>
          </Appear>
          <Appear at={6.5}>
            <div className="tool">
              <b>flightrec_record</b> tool_call deploy.push (pre/post) → seq {rec[1].seq}, {rec[2].seq}
            </div>
          </Appear>
          <Appear at={8}>
            <div className="tool">
              <b>flightrec_record</b> decision "deployed" → seq {rec[3].seq} · {rec[3].hash.slice(0, 12)}…
            </div>
          </Appear>
          <Appear at={10}>
            <div className="a">
              Done. Run <span className="mono">{A.mcp.runId}</span> is hash-chained in the same
              black box your Slack bot audits.
            </div>
          </Appear>
        </div>
      </div>
      <div className="slackhalf">
        <div className="chanhead">
          # demo <span>same black box, audited from Slack</span>
        </div>
        <div className="msgs">
          <Appear at={12.5}>
            <UserMsg cmd={`/audit ${A.mcp.runId}`} />
          </Appear>
          <Appear at={14}>
            <AppMsg>
              <AuditCard audit={A.mcp.audit} runId={A.mcp.runId} />
            </AppMsg>
          </Appear>
        </div>
        <div className="inputbar">Message #demo</div>
      </div>
    </div>
  );
};

/* ---------- S9 close ---------- */
export const CloseScene: React.FC = () => (
  <DarkFade dur={durOf("close")}>
    <WordmarkCard
      tagline="The model proposes. The gate disposes. The black box remembers everything."
      url="github.com/kitfunso/flightrec-slack"
    />
  </DarkFade>
);
