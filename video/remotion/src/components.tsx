import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FPS } from "./timeline";
import A from "./artifacts.json";

export const NAMES: Record<string, string> = {
  [A.grant.req.requester]: "Keith So",
  [A.grant.req.targetUser]: "Jane Osei",
};
export const TS = "2:14 PM";

export const Mention: React.FC<{ id: string }> = ({ id }) => (
  <span className="mention">@{NAMES[id] ?? id}</span>
);

export const humanDuration = (s: number): string =>
  s === 3600 ? "1 hour" : s === 86400 ? "24 hours" : `${s}s`;

/** Frame-driven typewriter: characters revealed at `cps` chars/second. */
export const typed = (full: string, t: number, startAt: number, cps: number): string => {
  if (t <= startAt) return "";
  return full.slice(0, Math.max(0, Math.floor((t - startAt) * cps)));
};

/** Fade wrapper for anything appearing mid-scene. Seconds are scene-relative. */
export const Appear: React.FC<{
  at: number;
  children: React.ReactNode;
  fade?: number;
  fill?: boolean;
}> = ({ at, children, fade = 0.3, fill }) => {
  const t = useCurrentFrame() / FPS;
  const opacity = interpolate(t, [at, at + fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (opacity === 0) return null;
  const style: React.CSSProperties = fill
    ? { opacity, position: "absolute", inset: 0 }
    : { opacity };
  return <div style={style}>{children}</div>;
};

/* ---------- Slack chrome ---------- */

export const SlackFrame: React.FC<{
  children?: React.ReactNode;
  overlay?: React.ReactNode;
}> = ({ children, overlay }) => (
  <div style={{ position: "absolute", inset: 0 }}>
    <div className="slack">
      <div className="rail">
        <div className="ws">sh</div>
        <div className="dot" />
        <div className="dot" />
      </div>
      <div className="sidebar">
        <h1>slack-hack</h1>
        <div className="sect">Channels</div>
        <div className="ch"># general</div>
        <div className="ch active"># demo</div>
        <div className="ch"># random</div>
        <div className="sect">Apps</div>
        <div className="ch">🔒 flightrec</div>
      </div>
      <div className="main">
        <div className="chanhead">
          # demo <span>Privileged-action broker demo</span>
        </div>
        <div className="msgs">{children}</div>
        <div className="inputbar">Message #demo</div>
      </div>
    </div>
    {overlay}
  </div>
);

export const UserMsg: React.FC<{ cmd: string }> = ({ cmd }) => (
  <div className="msg">
    <div className="avatar user">🧑‍💻</div>
    <div className="mbody">
      <div className="mhead">
        <b>Keith So</b>
        <span className="ts">{TS}</span>
      </div>
      <div className="mtext">
        <span className="cmd">{cmd}</span>
      </div>
    </div>
  </div>
);

export const AppMsg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="msg">
    <div className="avatar">🔒</div>
    <div className="mbody">
      <div className="mhead">
        <b>flightrec</b>
        <span className="app">APP</span>
        <span className="ts">{TS}</span>
      </div>
      {children}
    </div>
  </div>
);

/* ---------- Block Kit cards ---------- */

type Decision = {
  req: {
    requester: string;
    targetUser: string;
    resource: string;
    scope: string;
    durationSeconds: number;
  };
  res: { runId: string; outcome: string; reason: string; llmProposed: string };
  audit?: { events: number };
};

export const DecisionCard: React.FC<{ d: Decision }> = ({ d }) => {
  const granted = d.res.outcome === "grant";
  const events = d.audit ? ` OK · ${d.audit.events} events ` : " OK ";
  return (
    <div className="card">
      <div className="hdr">{granted ? "✅ Access granted" : "⛔ Access denied"}</div>
      <div className="fields">
        <div className="f">
          <label>Requester</label>
          <div><Mention id={d.req.requester} /></div>
        </div>
        <div className="f">
          <label>Target</label>
          <div><Mention id={d.req.targetUser} /></div>
        </div>
        <div className="f">
          <label>Resource</label>
          <div><code className="ic">{d.req.resource}</code></div>
        </div>
        <div className="f">
          <label>Scope</label>
          <div><code className="ic">{d.req.scope}</code></div>
        </div>
        <div className="f">
          <label>Duration</label>
          <div>{humanDuration(d.req.durationSeconds)}</div>
        </div>
        <div className="f">
          <label>LLM proposed</label>
          <div>
            {d.res.llmProposed} <i style={{ color: "#9d9ba3" }}>(advisory)</i>
          </div>
        </div>
      </div>
      <div className="gateline">
        <b>Policy gate</b> {d.res.reason}
      </div>
      <div className="btnrow">
        <span className="grnbtn">📋 View audit</span>
      </div>
      <div className="divider" />
      <div className="ctx">🔒 audit verified{events} · run {d.res.runId}</div>
    </div>
  );
};

type Audit = {
  intact: boolean;
  events: number;
  headHash: string;
  markdown: string;
  firstBroken?: number;
};

export const AuditCard: React.FC<{
  audit: Audit;
  runId: string;
  scrollY?: number;
}> = ({ audit, runId, scrollY }) => {
  const ok = audit.intact;
  return (
    <div className="card">
      <div className="hdr">
        {ok ? (
          <span className="verdict-ok">🔒 AUDIT VERIFIED</span>
        ) : (
          <span className="verdict-bad">🚨 INTEGRITY VIOLATION</span>
        )}
      </div>
      <div className="fields">
        <div className="f">
          <label>Run</label>
          <div><code className="ic">{runId}</code></div>
        </div>
        <div className="f">
          <label>Verdict</label>
          <div>
            {ok ? (
              "chain intact"
            ) : (
              <>
                <b className="verdict-bad">BROKEN</b> · tamper at seq {audit.firstBroken}
              </>
            )}
          </div>
        </div>
        <div className="f">
          <label>Events</label>
          <div>{audit.events}</div>
        </div>
        <div className="f">
          <label>Head hash</label>
          <div><code className="ic">{audit.headHash.slice(0, 16)}…</code></div>
        </div>
      </div>
      <div className="gateline">
        {ok
          ? "Every recorded step is hash-linked and independently verifiable."
          : "🚨 The recorded history was altered out-of-band; the hash chain no longer verifies. The black box caught it."}
      </div>
      {scrollY !== undefined ? (
        <div className="auditpre">
          <div style={{ transform: `translateY(-${scrollY}px)` }}>{audit.markdown}</div>
        </div>
      ) : null}
    </div>
  );
};

/* ---------- modal ---------- */

const ModalField: React.FC<{
  label: string;
  placeholder: string;
  value?: React.ReactNode;
  cursor?: boolean;
}> = ({ label, placeholder, value, cursor }) => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 12) % 2 === 0;
  return (
    <div className="mf">
      <label>{label}</label>
      <div className="inp">
        {value !== undefined && value !== "" ? value : <span className="ph">{placeholder}</span>}
        {cursor ? <span className="cursor" style={{ opacity: blink ? 1 : 0 }}>|</span> : null}
      </div>
    </div>
  );
};

export const GrantModal: React.FC<{
  target?: React.ReactNode;
  resource?: string;
  resourceCursor?: boolean;
  scope?: string;
  duration?: string;
  pressed?: boolean;
}> = ({ target, resource, resourceCursor, scope, duration, pressed }) => (
  <div className="modalveil">
    <div className="modal">
      <h2>Request access</h2>
      <ModalField label="Grant access to" placeholder="Select a user" value={target} />
      <ModalField
        label="Resource"
        placeholder="e.g. prod-analytics"
        value={resource}
        cursor={resourceCursor}
      />
      <ModalField label="Scope" placeholder="Select an option" value={scope} />
      <ModalField label="Duration" placeholder="Select an option" value={duration} />
      <div className="mbtns">
        <div className="cancel">Cancel</div>
        <div className={`submit${pressed ? " pressed" : ""}`}>Request</div>
      </div>
    </div>
  </div>
);

/* ---------- terminal ---------- */

export const Terminal: React.FC<{ text: string }> = ({ text }) => (
  <div className="termveil">
    <div className="term">
      <div className="bar">
        <i className="r" />
        <i className="y" />
        <i className="g" />
        <span>attacker@insider: sqlite3 data/audit.db</span>
      </div>
      <pre>{text}</pre>
    </div>
  </div>
);

/* ---------- dark cards ---------- */

export const BigCard: React.FC<{ big: React.ReactNode; sub?: string }> = ({ big, sub }) => (
  <div className="darkcard">
    <div className="bigline">{big}</div>
    {sub ? <div className="subline">{sub}</div> : null}
  </div>
);

export const WordmarkCard: React.FC<{ tagline: string; url?: string }> = ({ tagline, url }) => (
  <div className="darkcard">
    <div className="wordmark">
      <span className="lock">🔒</span> flightrec
    </div>
    <div className="tagline">{tagline}</div>
    {url ? <div className="urlline">{url}</div> : null}
  </div>
);
