/**
 * App configuration: secrets from the environment, entitlements from a JSON
 * file. Loaded once at startup.
 *
 * @module config
 */
import { readFileSync, existsSync } from "node:fs";
import { EntitlementStore, type Entitlement } from "./entitlements.js";

export interface AppConfig {
  readonly botToken: string;
  readonly appToken: string;
  readonly model: string;
  readonly dbPath: string;
  readonly entitlements: EntitlementStore;
  /** When true, the demo-only `/audit tamper <runId>` command is enabled. */
  readonly demoMode: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`missing required env var: ${name} (set it in .env)`);
  }
  return value;
}

/** Load entitlements from JSON; an absent file means "deny everything" (logged). */
function loadEntitlements(path: string): EntitlementStore {
  if (!existsSync(path)) {
    console.error(
      `[config] no entitlements file at '${path}'; every request will be DENIED. ` +
        `Copy entitlements.example.json to entitlements.json and add your grantors.`,
    );
    return new EntitlementStore([]);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Entitlement[];
  return new EntitlementStore(parsed);
}

export function loadConfig(): AppConfig {
  return {
    botToken: requireEnv("SLACK_BOT_TOKEN"),
    appToken: requireEnv("SLACK_APP_TOKEN"),
    model: process.env.FLIGHTREC_SLACK_MODEL ?? "claude-haiku-4-5-20251001",
    dbPath: process.env.FLIGHTREC_SLACK_DB ?? "data/audit.db",
    entitlements: loadEntitlements(process.env.FLIGHTREC_SLACK_ENTITLEMENTS ?? "entitlements.json"),
    demoMode: process.env.FLIGHTREC_DEMO === "1",
  };
}
