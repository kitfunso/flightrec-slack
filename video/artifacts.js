window.ARTIFACTS = {
  "model": "claude-haiku-4-5-20251001",
  "now": 1751500800000,
  "grant": {
    "req": {
      "teamId": "T0B9Q29RXNX",
      "requester": "U0BA01UT7KN",
      "targetUser": "U_JANE",
      "resource": "prod-analytics",
      "scope": "read",
      "durationSeconds": 3600,
      "channel": "C0B9UC35P1U",
      "threadTs": "V0DEMO100"
    },
    "res": {
      "runId": "T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100",
      "outcome": "grant",
      "reason": "requester U0BA01UT7KN is entitled to grant 'read' on 'prod-analytics' for up to 3600s",
      "grant": {
        "id": "grant-1",
        "targetUser": "U_JANE",
        "resource": "prod-analytics",
        "scope": "read",
        "grantedAtMs": 1751500800000,
        "expiresAtMs": 1751504400000
      },
      "llmProposed": "grant"
    },
    "audit": {
      "markdown": "# flightrec audit report\n\n- run: T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100\n- source: slack-broker\n- algo: sha256\n- created: 2026-07-02T20:57:34.282Z\n- closed: 2026-07-02T20:57:35.628Z\n\n## Integrity attestation\n\n- verdict: OK\n- events verified: 6\n- head hash: 7d1bf33e81ade1e05d001755f9a8b5e67fbc2573e20da9a188fb33208567be6d\n- algo: sha256\n\n## Tool inventory\n\n| tool | calls |\n| --- | --- |\n| access.grant | 1 |\n\n## Token spend\n\n| model | messages | input | output | cache_create | cache_read |\n| --- | --- | --- | --- | --- | --- |\n| claude-haiku-4-5-20251001 | 1 | 163 | 41 | 0 | 0 |\n| TOTAL | 1 | 163 | 41 | 0 | 0 |\n\nCost events: 1 (1 distinct message id(s), 0 duplicate(s), 0 malformed).\n\n## Anomalies\n\nIntegrity-class anomalies indicate tampering and fail `audit --strict` (exit 3); hygiene-class anomalies are recorded but never exit-affecting.\n\nNone detected.\n\n## Event appendix\n\n- seq 1 | 2026-07-02T20:57:34.282Z | run\\_meta\n  `{\"requester\":\"U0BA01UT7KN\",\"channel\":\"C0B9UC35P1U\",\"threadTs\":\"V0DEMO100\",\"action\":\"grant\",\"targetUser\":\"U_JANE\",\"resource\":\"prod-analytics\",\"scope\":\"read\",\"durationSeconds\":3600}`\n- seq 2 | 2026-07-02T20:57:35.622Z | llm\\_call\n  `{\"model\":\"claude-haiku-4-5-20251001\",\"purpose\":\"reason about access request\",\"proposedOutcome\":\"grant\",\"rationale\":\"The request is for read-only access to prod-analytics for one hour to a named user, which is a standard and time-limited access pattern consistent with typical operational needs.\",\"inputTokens\":163,\"outputTokens\":41}`\n- seq 3 | 2026-07-02T20:57:35.624Z | decision\n  `{\"outcome\":\"grant\",\"gateVerdict\":\"allow\",\"reason\":\"requester U0BA01UT7KN is entitled to grant 'read' on 'prod-analytics' for up to 3600s\"}`\n- seq 4 | 2026-07-02T20:57:35.625Z | tool\\_call\n  `{\"phase\":\"pre\",\"tool_name\":\"access.grant\",\"tool_use_id\":\"T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100#access1\",\"input\":{\"targetUser\":\"U_JANE\",\"resource\":\"prod-analytics\",\"scope\":\"read\",\"durationSeconds\":3600}}`\n- seq 5 | 2026-07-02T20:57:35.626Z | tool\\_call\n  `{\"phase\":\"post\",\"tool_name\":\"access.grant\",\"tool_use_id\":\"T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100#access1\",\"output\":{\"executed\":true,\"grantId\":\"grant-1\",\"expiresAt\":\"2025-07-03T01:00:00.000Z\",\"result\":\"granted 'read' on 'prod-analytics' to U_JANE\"}}`\n- seq 6 | 2026-07-02T20:57:35.627Z | cost\n  `{\"messageId\":\"T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100#llm1\",\"model\":\"claude-haiku-4-5-20251001\",\"usage\":{\"input_tokens\":163,\"output_tokens\":41,\"cache_creation_input_tokens\":0,\"cache_read_input_tokens\":0}}`\n",
      "intact": true,
      "events": 6,
      "headHash": "7d1bf33e81ade1e05d001755f9a8b5e67fbc2573e20da9a188fb33208567be6d"
    }
  },
  "deny": {
    "req": {
      "teamId": "T0B9Q29RXNX",
      "requester": "U0BA01UT7KN",
      "targetUser": "U_JANE",
      "resource": "prod-analytics",
      "scope": "admin",
      "durationSeconds": 3600,
      "channel": "C0B9UC35P1U",
      "threadTs": "V0DEMO200"
    },
    "res": {
      "runId": "T0B9Q29RXNX.C0B9UC35P1U.V0DEMO200",
      "outcome": "deny",
      "reason": "requester U0BA01UT7KN may not grant scope 'admin' on 'prod-analytics' (permitted: read, write)",
      "llmProposed": "grant"
    }
  },
  "tampered": {
    "detail": "rewrote a recorded event at seq 4",
    "audit": {
      "markdown": "# flightrec audit report\n\n- run: T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100\n- source: slack-broker\n- algo: sha256\n- created: 2026-07-02T20:57:34.282Z\n- closed: 2026-07-02T20:57:35.628Z\n\n## Integrity attestation\n\n- verdict: BROKEN\n- first broken event: seq 4\n- events examined before break: 4\n- recomputed head hash: ce61d01ac362408fdfd6137236d382d3bedefdf3f445ff4bc7fb841f8f8f8aef\n- run claims algo: sha256\n\n## Tool inventory\n\n| tool | calls |\n| --- | --- |\n| access.grant | 1 |\n\n## Token spend\n\n| model | messages | input | output | cache_create | cache_read |\n| --- | --- | --- | --- | --- | --- |\n| claude-haiku-4-5-20251001 | 1 | 163 | 41 | 0 | 0 |\n| TOTAL | 1 | 163 | 41 | 0 | 0 |\n\nCost events: 1 (1 distinct message id(s), 0 duplicate(s), 0 malformed).\n\n## Anomalies\n\nIntegrity-class anomalies indicate tampering and fail `audit --strict` (exit 3); hygiene-class anomalies are recorded but never exit-affecting.\n\n| seq | class | kind | detail |\n| --- | --- | --- | --- |\n| 4 | integrity | chain_violation | chain breaks at seq 4 |\n\n## Event appendix\n\n- seq 1 | 2026-07-02T20:57:34.282Z | run\\_meta\n  `{\"requester\":\"U0BA01UT7KN\",\"channel\":\"C0B9UC35P1U\",\"threadTs\":\"V0DEMO100\",\"action\":\"grant\",\"targetUser\":\"U_JANE\",\"resource\":\"prod-analytics\",\"scope\":\"read\",\"durationSeconds\":3600}`\n- seq 2 | 2026-07-02T20:57:35.622Z | llm\\_call\n  `{\"model\":\"claude-haiku-4-5-20251001\",\"purpose\":\"reason about access request\",\"proposedOutcome\":\"grant\",\"rationale\":\"The request is for read-only access to prod-analytics for one hour to a named user, which is a standard and time-limited access pattern consistent with typical operational needs.\",\"inputTokens\":163,\"outputTokens\":41}`\n- seq 3 | 2026-07-02T20:57:35.624Z | decision\n  `{\"outcome\":\"grant\",\"gateVerdict\":\"allow\",\"reason\":\"requester U0BA01UT7KN is entitled to grant 'read' on 'prod-analytics' for up to 3600s\"}`\n- seq 4 | 2026-07-02T20:57:35.625Z | tool\\_call [unverified - after chain break]\n  `{\"phase\":\"pre\",\"tool_name\":\"access.grant\",\"tool_use_id\":\"T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100#access1\",\"input\":{\"targetUser\":\"U_JANE\",\"resource\":\"prod-analytics\",\"scope\":\"read\",\"durationSeconds\":3600},\"_TAMPERED\":\"scope secretly escalated to admin on prod-secrets after the fact\"}`\n- seq 5 | 2026-07-02T20:57:35.626Z | tool\\_call [unverified - after chain break]\n  `{\"phase\":\"post\",\"tool_name\":\"access.grant\",\"tool_use_id\":\"T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100#access1\",\"output\":{\"executed\":true,\"grantId\":\"grant-1\",\"expiresAt\":\"2025-07-03T01:00:00.000Z\",\"result\":\"granted 'read' on 'prod-analytics' to U_JANE\"}}`\n- seq 6 | 2026-07-02T20:57:35.627Z | cost [unverified - after chain break]\n  `{\"messageId\":\"T0B9Q29RXNX.C0B9UC35P1U.V0DEMO100#llm1\",\"model\":\"claude-haiku-4-5-20251001\",\"usage\":{\"input_tokens\":163,\"output_tokens\":41,\"cache_creation_input_tokens\":0,\"cache_read_input_tokens\":0}}`\n",
      "intact": false,
      "firstBroken": 4,
      "events": 4,
      "headHash": "ce61d01ac362408fdfd6137236d382d3bedefdf3f445ff4bc7fb841f8f8f8aef"
    }
  },
  "mcp": {
    "runId": "claude-desktop.deploy.model-cta-v5",
    "recorded": [
      {
        "seq": 1,
        "hash": "772fd6d8eaafc5998f59a2b5442ae152a593dc304495621509ca3dda46f25840",
        "truncated": false
      },
      {
        "seq": 2,
        "hash": "693497d19e1279ede70e16feecdf843bbbbdb7cab21bd91ddefd06f09cbefafe",
        "truncated": false
      },
      {
        "seq": 3,
        "hash": "ce059494ba599e3e7469f803e04d839bdcc32034003260d63cbada37717269a3",
        "truncated": false
      },
      {
        "seq": 4,
        "hash": "4bff35d2cbe3b0099344be3c106a1c1be42e55952a85e159dbb80ec4d63c42c7",
        "truncated": false
      }
    ],
    "audit": {
      "intact": true,
      "events": 4,
      "markdown": "# flightrec audit report\n\n- run: claude-desktop.deploy.model-cta-v5\n- source: claude-desktop\n- algo: sha256\n- created: 2026-07-02T21:00:36.878Z\n- closed: (open - no close marker)\n\n## Integrity attestation\n\n- verdict: OK\n- events verified: 4\n- head hash: 4bff35d2cbe3b0099344be3c106a1c1be42e55952a85e159dbb80ec4d63c42c7\n- algo: sha256\n\n## Tool inventory\n\n| tool | calls |\n| --- | --- |\n| deploy.push | 1 |\n\n## Token spend\n\nNo cost events recorded.\n\nCost events: 0 (0 distinct message id(s), 0 duplicate(s), 0 malformed).\n\n## Anomalies\n\nIntegrity-class anomalies indicate tampering and fail `audit --strict` (exit 3); hygiene-class anomalies are recorded but never exit-affecting.\n\n| seq | class | kind | detail |\n| --- | --- | --- | --- |\n| - | hygiene | run_not_closed | run has no close marker (no SessionEnd recorded) |\n\n## Event appendix\n\n- seq 1 | 2026-07-02T21:00:36.878Z | run\\_meta\n  `{\"requester\":\"claude-desktop\",\"action\":\"deploy\",\"detail\":\"push cta-v5 model to prod\"}`\n- seq 2 | 2026-07-02T21:00:36.883Z | tool\\_call\n  `{\"phase\":\"pre\",\"tool_name\":\"deploy.push\",\"tool_use_id\":\"cd1\",\"input\":{\"model\":\"cta-v5\",\"target\":\"prod\"}}`\n- seq 3 | 2026-07-02T21:00:36.885Z | tool\\_call\n  `{\"phase\":\"post\",\"tool_name\":\"deploy.push\",\"tool_use_id\":\"cd1\",\"output\":{\"ok\":true,\"release\":\"r-2026-07-03\"}}`\n- seq 4 | 2026-07-02T21:00:36.887Z | decision\n  `{\"outcome\":\"deployed\",\"note\":\"recorded by Claude Desktop via flightrec-mcp\"}`\n",
      "headHash": "4bff35d2cbe3b0099344be3c106a1c1be42e55952a85e159dbb80ec4d63c42c7"
    }
  }
};
