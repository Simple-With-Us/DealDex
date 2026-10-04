/**
 * App-level settings — Infisical is the sole source of truth.
 *
 * Policy and key inventory live in INFISICAL.md at the repo root.  This
 * module is the server-side runtime contract:
 *
 *   - `initAppSettings()` loads the app's Infisical project
 *     (6d50da37-5fb9-4c5b-bcf0-085ac29c1705) for the current environment
 *     into an in-memory cache at server startup.  Idempotent.
 *   - `get()` / `getNumber()` / `getBoolean()` / `getRequired()` read the
 *     resolved value — Infisical cache first, then `process.env`, then the
 *     schema default.  They make zero network calls, so they are safe in
 *     hot request/tick paths.  Per-request Infisical fetches are forbidden.
 *   - Background refresh re-reads Infisical on a self-tuning interval
 *     (SETTINGS_REFRESH_INTERVAL_MS, itself an Infisical knob) plus a
 *     SIGHUP handler.  Refresh failures log loudly and keep serving the
 *     last-known-good cache — staleness is safer than an outage.
 *   - `set()` is write-through: Infisical FIRST, then the local cache.
 *     A failed Infisical write rejects — cache and Infisical never diverge
 *     silently.  Unknown keys are rejected so the INFISICAL.md inventory
 *     stays honest.
 *
 * Without universal-auth credentials (INFISICAL_CLIENT_ID /
 * INFISICAL_CLIENT_SECRET) the module runs in local-only mode: reads fall
 * back to `process.env` + schema defaults with a one-time warning, and
 * `set()` refuses (fail, never diverge).  This keeps `npm run dev`, CI,
 * and deploys without the machine identity working exactly as before.
 *
 * Server-only.  NEVER import from client code.
 */
import {
  createInfisicalSettings,
  type InfisicalSettings,
} from "@jaywedgeworth22/congress-trading-shared";

export const DEALDEX_INFISICAL_PROJECT_ID = "6d50da37-5fb9-4c5b-bcf0-085ac29c1705";

export type DealDexAppEnv = "dev" | "staging" | "prod";

/** Map the deploy environment onto an Infisical environment slug. */
export function resolveAppEnv(
  env: Record<string, string | undefined> = process.env,
): DealDexAppEnv {
  const explicit = env.DEALDEX_INFISICAL_ENV?.trim().toLowerCase();
  if (explicit === "dev" || explicit === "staging" || explicit === "prod") return explicit;
  const raw = (
    env.DEALDEX_ENV ??
    env.APP_ENV ??
    env.VERCEL_ENV ??
    "dev"
  )
    .trim()
    .toLowerCase();
  if (raw === "prod" || raw === "production") return "prod";
  if (raw === "staging" || raw === "preview") return "staging";
  return "dev";
}

export type SettingKind = "secret" | "env" | "knob";

export interface SettingDef {
  /** Canonical name (also the Infisical secret key). */
  name: string;
  kind: SettingKind;
  /** Baked-in fallback when neither Infisical nor process.env provides a value. */
  default?: string;
  blurb: string;
}

/**
 * The full app-level settings inventory.  This list IS the INFISICAL.md
 * key inventory in code form — keep them in sync.
 */
export const SETTING_DEFS: SettingDef[] = [
  // -- Secrets ------------------------------------------------------------
  { name: "DATABASE_URL", kind: "secret", blurb: "Postgres connection string.  Unset → embedded PGLite (dev/preview)." },
  { name: "BETTER_AUTH_SECRET", kind: "secret", blurb: "Better Auth signing secret.  Unset → per-process preview secret." },
  { name: "SCAN_RUNNER_TOKEN", kind: "secret", blurb: "Bearer token gating /api/alerts/run and the admin settings surface." },
  { name: "PROXY_URL_LIST", kind: "secret", blurb: "Comma-separated rotating-proxy URLs for the scan fallback chain." },
  { name: "GOOGLE_CLIENT_ID", kind: "secret", blurb: "Google OAuth client id for sign-in." },
  { name: "GOOGLE_CLIENT_SECRET", kind: "secret", blurb: "Google OAuth client secret for sign-in." },
  { name: "DD_WEB_GOOGLE_ID", kind: "secret", blurb: "Google OAuth client id (DD_WEB alias)." },
  { name: "DD_WEB_GOOGLE_SECRET", kind: "secret", blurb: "Google OAuth client secret (DD_WEB alias)." },
  { name: "DEALDEX_GOOGLE_CLIENT_ID", kind: "secret", blurb: "Google OAuth client id (DEALDEX_ alias)." },
  { name: "DEALDEX_GOOGLE_CLIENT_SECRET", kind: "secret", blurb: "Google OAuth client secret (DEALDEX_ alias)." },
  { name: "DEALDEX_WEB_GOOGLE_ID", kind: "secret", blurb: "Google OAuth client id (DEALDEX_WEB alias)." },
  { name: "DEALDEX_WEB_GOOGLE_SECRET", kind: "secret", blurb: "Google OAuth client secret (DEALDEX_WEB alias)." },
  { name: "APPLE_CLIENT_ID", kind: "secret", blurb: "Apple Services ID for Sign in with Apple." },
  { name: "APPLE_CLIENT_SECRET", kind: "secret", blurb: "Pre-generated Apple client_secret JWT (alternative to raw-key components)." },
  { name: "APPLE_TEAM_ID", kind: "secret", blurb: "Apple Developer team id (for client_secret JWT generation)." },
  { name: "APPLE_KEY_ID", kind: "secret", blurb: "Apple Sign in with Apple key id (for client_secret JWT generation)." },
  { name: "APPLE_PRIVATE_KEY", kind: "secret", blurb: "Apple .p8 private key content (for client_secret JWT generation)." },
  { name: "DEALDEX_APPLE_CLIENT_ID", kind: "secret", blurb: "Apple Services ID (DEALDEX_ alias)." },
  { name: "DEALDEX_APPLE_CLIENT_SECRET", kind: "secret", blurb: "Pre-generated Apple JWT (DEALDEX_ alias)." },
  { name: "DEALDEX_APPLE_TEAM_ID", kind: "secret", blurb: "Apple team id (DEALDEX_ alias)." },
  { name: "DEALDEX_APPLE_KEY_ID", kind: "secret", blurb: "Apple key id (DEALDEX_ alias)." },
  { name: "DEALDEX_APPLE_PRIVATE_KEY", kind: "secret", blurb: "Apple .p8 key (DEALDEX_ alias)." },
  { name: "DD_APPLE_CLIENT_ID", kind: "secret", blurb: "Apple Services ID (DD_ alias)." },
  { name: "DD_APPLE_CLIENT_SECRET", kind: "secret", blurb: "Pre-generated Apple JWT (DD_ alias)." },
  { name: "DD_APPLE_TEAM_ID", kind: "secret", blurb: "Apple team id (DD_ alias)." },
  { name: "DD_APPLE_KEY_ID", kind: "secret", blurb: "Apple key id (DD_ alias)." },
  { name: "DD_APPLE_PRIVATE_KEY", kind: "secret", blurb: "Apple .p8 key (DD_ alias)." },
  { name: "TWITTER_CLIENT_ID", kind: "secret", blurb: "X/Twitter OAuth 2 client id for sign-in." },
  { name: "TWITTER_CLIENT_SECRET", kind: "secret", blurb: "X/Twitter OAuth 2 client secret for sign-in." },
  { name: "X_CLIENT_ID", kind: "secret", blurb: "X/Twitter OAuth 2 client id (X_ alias)." },
  { name: "X_CLIENT_SECRET", kind: "secret", blurb: "X/Twitter OAuth 2 client secret (X_ alias)." },
  { name: "DEALDEX_X_CLIENT_ID", kind: "secret", blurb: "X/Twitter OAuth 2 client id (DEALDEX_ alias)." },
  { name: "DEALDEX_X_CLIENT_SECRET", kind: "secret", blurb: "X/Twitter OAuth 2 client secret (DEALDEX_ alias)." },
  { name: "DD_X_CLIENT_ID", kind: "secret", blurb: "X/Twitter OAuth 2 client id (DD_ alias)." },
  { name: "DD_X_CLIENT_SECRET", kind: "secret", blurb: "X/Twitter OAuth 2 client secret (DD_ alias)." },
  { name: "EBAY_APP_ID", kind: "secret", blurb: "eBay Developers app id (server-side website scan OAuth)." },
  { name: "EBAY_CERT_ID", kind: "secret", blurb: "eBay Developers cert id (server-side website scan OAuth)." },
  // -- Env config ---------------------------------------------------------
  { name: "BETTER_AUTH_URL", kind: "env", blurb: "Public origin for Better Auth (deployed).  Unset → per-request dynamic base URL." },
  { name: "EBAY_REDIRECT_URI", kind: "env", blurb: "eBay OAuth redirect URI registered on the eBay app." },
  { name: "EBAY_ENV", kind: "env", default: "production", blurb: "eBay environment: production or sandbox." },
  { name: "SENTRY_DSN", kind: "env", blurb: "Sentry DSN for server error reporting." },
  { name: "SENTRY_ENV", kind: "env", blurb: "Sentry environment label.  Falls back to VERCEL_ENV / NODE_ENV." },
  { name: "SENTRY_TRACES_SAMPLE_RATE", kind: "env", default: "0.2", blurb: "Sentry traces sample rate, 0–1." },
  // -- Tunable knobs ------------------------------------------------------
  { name: "SETTINGS_REFRESH_INTERVAL_MS", kind: "knob", default: "300000", blurb: "Background settings refresh interval.  <=0 disables the timer." },
  { name: "SCAN_MAX_ROWS_PER_RUN", kind: "knob", default: "50", blurb: "Max alert-rule rows evaluated per scan-runner tick." },
  { name: "PROXY_MAX_CONCURRENCY", kind: "knob", default: "4", blurb: "Max in-flight requests per proxy in the rotating pool." },
  { name: "AUTO_BUY_DRY_RUN_FORCE", kind: "knob", default: "false", blurb: "Safety kill-switch: true forces dry-run on every auto-buy evaluation." },
  { name: "AUTO_BUY_DEFAULT_MIN_SPREAD", kind: "knob", default: "0.18", blurb: "Default min spread (fraction) for newly created alert rules." },
  { name: "AUTO_BUY_DEFAULT_MAX_PRICE_CENTS", kind: "knob", default: "5000", blurb: "Default max price (cents) for newly created alert rules." },
  { name: "AUTO_BUY_DEFAULT_MAX_DAILY_CENTS", kind: "knob", default: "10000", blurb: "Default daily spend cap (cents) for newly created alert rules." },
  { name: "AUTO_BUY_DEFAULT_MAX_MONTHLY_CENTS", kind: "knob", default: "50000", blurb: "Default monthly spend cap (cents) for newly created alert rules." },
  { name: "AUTO_BUY_DEFAULT_COOL_HOURS", kind: "knob", default: "24", blurb: "Default cooldown (hours) between runs for newly created alert rules." },
];

const DEFAULTS = new Map<string, string>();
for (const def of SETTING_DEFS) {
  if (def.default !== undefined) DEFAULTS.set(def.name, def.default);
}
const KNOWN = new Set(SETTING_DEFS.map((d) => d.name));

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

let client: InfisicalSettings | null = null;
let initPromise: Promise<boolean> | null = null;
let warnedLocalOnly = false;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let sighupWired = false;

/** True once initAppSettings() has connected to Infisical. */
export function settingsConnected(): boolean {
  return client !== null;
}

function scheduleRefresh(): void {
  if (refreshTimer !== undefined) clearTimeout(refreshTimer);
  const intervalMs = getNumberSetting("SETTINGS_REFRESH_INTERVAL_MS", 300_000);
  if (!(intervalMs > 0)) return; // <=0 disables the background timer.
  refreshTimer = setTimeout(() => {
    void client
      ?.refresh()
      .catch(() => {
        /* pilot logs loudly and keeps last-known-good; nothing more to do */
      })
      .finally(() => scheduleRefresh());
  }, intervalMs);
  const maybeUnref = refreshTimer as { unref?: () => void };
  if (typeof maybeUnref.unref === "function") maybeUnref.unref();
}

/**
 * Load app settings from Infisical into memory.  Idempotent — concurrent
 * callers share one in-flight init.  Resolves true when Infisical is
 * connected, false in local-only mode (no credentials) or when the Infisical
 * load failed (loudly logged; env + defaults keep the server running —
 * staleness/outage-safety wins over fail-fast on cold start).
 *
 * `overrides` is a test seam (fetchImpl / explicit credentials / environment).
 */
export function initAppSettings(overrides?: {
  fetchImpl?: typeof fetch;
  clientId?: string;
  clientSecret?: string;
  environment?: DealDexAppEnv;
}): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async (): Promise<boolean> => {
      const env = process.env;
      const clientId = overrides?.clientId ?? clean(env.INFISICAL_CLIENT_ID);
      const clientSecret = overrides?.clientSecret ?? clean(env.INFISICAL_CLIENT_SECRET);
      if (!clientId || !clientSecret) {
        if (!warnedLocalOnly) {
          warnedLocalOnly = true;
          console.warn(
            "[app-settings] INFISICAL_CLIENT_ID/INFISICAL_CLIENT_SECRET not set — " +
              "running in local-only mode (process.env + built-in defaults). " +
              "See INFISICAL.md.",
          );
        }
        return false;
      }
      const appEnv = overrides?.environment ?? resolveAppEnv(env);
      const next = createInfisicalSettings({
        projectId: DEALDEX_INFISICAL_PROJECT_ID,
        environment: appEnv,
        clientId,
        clientSecret,
        fetchImpl: overrides?.fetchImpl,
        // Self-scheduled refresh so SETTINGS_REFRESH_INTERVAL_MS (itself a
        // knob) is honored; pass 0 to disable the client's own timer.
        refreshIntervalMs: 0,
        onRefreshError: (err) => {
          console.error(`[app-settings] background refresh failed: ${err.message}`);
        },
      });
      try {
        await next.init();
      } catch (error) {
        console.error(
          `[app-settings] Infisical load failed (project ${DEALDEX_INFISICAL_PROJECT_ID}, env "${appEnv}"): ` +
            `${error instanceof Error ? error.message : String(error)}. ` +
            "Continuing in local-only mode — see INFISICAL.md.",
        );
        return false;
      }
      client = next;
      scheduleRefresh();
      if (!sighupWired && typeof process !== "undefined" && typeof process.on === "function") {
        sighupWired = true;
        process.on("SIGHUP", () => {
          void client?.refresh().catch(() => {
            /* pilot already logs loudly */
          });
        });
      }
      return true;
    })();
  }
  return initPromise;
}

/**
 * Resolved setting value: Infisical cache → process.env → schema default.
 * Memory/env only — never hits the network.  Empty/whitespace counts as
 * unset.  Safe to call before initAppSettings() (Infisical layer is then
 * simply absent).
 */
export function getSetting(name: string): string | undefined {
  return clean(client?.get(name)) ?? clean(process.env[name]) ?? DEFAULTS.get(name);
}

/** Like getSetting but throws a clear, INFISICAL.md-pointing error when absent. */
export function getRequiredSetting(name: string): string {
  const value = getSetting(name);
  if (value === undefined) {
    throw new Error(
      `Missing required app setting "${name}" (Infisical project ${DEALDEX_INFISICAL_PROJECT_ID}, ` +
        `environment "${resolveAppEnv()}"). Add it to the Infisical project and restart — see INFISICAL.md.`,
    );
  }
  return value;
}

export function getNumberSetting(name: string, fallback: number): number {
  const raw = getSetting(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getBooleanSetting(name: string, fallback: boolean): boolean {
  const raw = getSetting(name)?.toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
}

/** Where the current resolved value came from — metadata only, never a value. */
export function settingSource(name: string): "infisical" | "env" | "default" | "unset" {
  if (client && clean(client.get(name)) !== undefined) return "infisical";
  if (clean(process.env[name]) !== undefined) return "env";
  if (DEFAULTS.has(name)) return "default";
  return "unset";
}

/**
 * Write-through admin save: persists to Infisical FIRST, then updates the
 * local cache (the client enforces the ordering).  Rejects when the
 * Infisical write fails — cache and Infisical never diverge silently.
 * Rejects for unknown keys and in local-only mode (fail, never diverge).
 */
export async function setSetting(name: string, value: string): Promise<void> {
  if (!KNOWN.has(name)) {
    throw new Error(
      `Unknown app setting "${name}". Pick one from the INFISICAL.md inventory.`,
    );
  }
  if (!client) {
    throw new Error(
      `Cannot save "${name}": Infisical is not connected (local-only mode). ` +
        "Set INFISICAL_CLIENT_ID/INFISICAL_CLIENT_SECRET and restart — see INFISICAL.md.",
    );
  }
  await client.set(name, value.trim());
}

/** On-demand refresh (admin "Reload settings" action).  Returns false in local-only mode or when the refresh fails — the last-known-good cache keeps serving either way. */
export async function refreshSettings(): Promise<boolean> {
  if (!client) return false;
  try {
    await client.refresh();
  } catch (error) {
    console.error(
      `[app-settings] on-demand refresh failed: ${error instanceof Error ? error.message : String(error)}. ` +
        "Serving last-known-good cache; staleness is safer than an outage.",
    );
    return false;
  }
  scheduleRefresh(); // re-arm so a changed interval knob takes effect
  return true;
}

/** Clear the background timer.  Tests and graceful shutdown. */
export function stopSettingsRefresh(): void {
  if (refreshTimer !== undefined) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
  client?.stop();
}

/** Test seam: reset module state between tests. */
export function __resetAppSettingsForTests(): void {
  stopSettingsRefresh();
  client = null;
  initPromise = null;
  warnedLocalOnly = false;
  sighupWired = false;
}

/**
 * Default env map for server modules that take an injectable
 * `env: Record<string, string | undefined> = process.env` parameter.
 * Returns a fresh snapshot per call: process.env with every known
 * Infisical-backed key overlaid from the cache (Infisical wins when
 * connected).  Tests keep passing explicit objects; production call sites
 * switch their default to this.
 */
export function defaultServerEnv(): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = { ...process.env };
  if (client) {
    for (const name of KNOWN) {
      const value = clean(client.get(name));
      if (value !== undefined) snapshot[name] = value;
    }
  }
  return snapshot;
}

/** Server-side auto-buy defaults for newly created rules (knobs, Infisical-tunable). */
export function serverAutoBuyDefaults(): {
  maxPriceCents: number;
  minSpread: number;
  maxMonthlyCents: number;
  maxDailyCents: number;
  coolHours: number;
} {
  return {
    maxPriceCents: getNumberSetting("AUTO_BUY_DEFAULT_MAX_PRICE_CENTS", 5000),
    minSpread: getNumberSetting("AUTO_BUY_DEFAULT_MIN_SPREAD", 0.18),
    maxMonthlyCents: getNumberSetting("AUTO_BUY_DEFAULT_MAX_MONTHLY_CENTS", 50000),
    maxDailyCents: getNumberSetting("AUTO_BUY_DEFAULT_MAX_DAILY_CENTS", 10000),
    coolHours: getNumberSetting("AUTO_BUY_DEFAULT_COOL_HOURS", 24),
  };
}
