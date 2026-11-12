/**
 * Datadog env resolution for DealDex.
 *
 * Reuses the fleet / Datadog-Vercel names already in use on the existing
 * US5 org.  Do not invent new secret names.  Values never belong in git.
 *
 * Datadog is opt-in everywhere:  a deploy with no DD_* keys runs dark.
 * Set DD_REQUIRE=1 to restore the fail-closed guard for the server API key
 * (`DD_API_KEY` / `DATADOG_API_KEY`) - the fleet precedent is ContactLogo's
 * DD_REQUIRE.  Missing RUM tokens stay dark - they must not 503 the site or
 * throw from root `beforeLoad`.  Preview, CI, and local continue without
 * instrumentation so verify can run.
 */

export const DEFAULT_DD_SITE = "us5.datadoghq.com";
export const DEFAULT_DD_SERVICE = "dealdex";

export type EnvMap = Record<string, string | undefined>;

export type DatadogLogStatus = "debug" | "info" | "warn" | "error";

export type ServerObservabilityConfig = {
  apiKey: string;
  site: string;
  service: string;
  env: string;
  version: string;
};

export type RumPublicConfig = {
  applicationId: string;
  clientToken: string;
  site: string;
  service: string;
  env: string;
  version: string;
};

export function readEnv(env: EnvMap, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function firstEnv(env: EnvMap, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = readEnv(env, key);
    if (value) return value;
  }
  return undefined;
}

export function isProductionObservability(env: EnvMap): boolean {
  return readEnv(env, "VERCEL_ENV") === "production";
}

/** Explicit opt-in to the fail-closed Datadog guard (DD_REQUIRE=1). */
export function isDatadogRequired(env: EnvMap): boolean {
  return readEnv(env, "DD_REQUIRE") === "1";
}

export function resolveSite(env: EnvMap): string {
  return firstEnv(env, ["DD_SITE"]) ?? DEFAULT_DD_SITE;
}

export function resolveService(env: EnvMap): string {
  return firstEnv(env, ["DD_SERVICE"]) ?? DEFAULT_DD_SERVICE;
}

export function canonicalizeDatadogEnv(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === "prod" || lower === "production") return "production";
  return trimmed;
}

export function resolveEnvName(env: EnvMap): string {
  return (
    canonicalizeDatadogEnv(firstEnv(env, ["DD_ENV"])) ??
    (isProductionObservability(env) ? "production" : (readEnv(env, "NODE_ENV") ?? "development"))
  );
}

export function resolveVersion(env: EnvMap): string {
  return firstEnv(env, ["DD_VERSION", "VERCEL_GIT_COMMIT_SHA"]) ?? "unknown";
}

export function resolveApiKey(env: EnvMap): string | undefined {
  return firstEnv(env, ["DD_API_KEY", "DATADOG_API_KEY"]);
}

export function resolveRumApplicationId(env: EnvMap): string | undefined {
  return firstEnv(env, ["DD_APPLICATION_ID", "VITE_DD_APPLICATION_ID"]);
}

export function resolveRumClientToken(env: EnvMap): string | undefined {
  return firstEnv(env, ["DD_CLIENT_TOKEN", "VITE_DD_CLIENT_TOKEN", "DD_RUM_CLIENT_TOKEN"]);
}

export function missingServerKeys(env: EnvMap): string[] {
  const missing: string[] = [];
  if (!resolveApiKey(env)) missing.push("DD_API_KEY");
  return missing;
}

export function missingRumKeys(env: EnvMap): string[] {
  const missing: string[] = [];
  if (!resolveRumApplicationId(env)) missing.push("DD_APPLICATION_ID");
  if (!resolveRumClientToken(env)) missing.push("DD_CLIENT_TOKEN");
  return missing;
}

export function missingProductionKeys(env: EnvMap): string[] {
  return missingServerKeys(env);
}

export function failClosedMessage(missing: string[]): string {
  return (
    "DealDex Datadog is fail-closed in production.  Missing " +
    missing.join(", ") +
    ".  Set the existing Datadog env vars on the Vercel project.  Do not invent new secret names."
  );
}

export function requireServerObservability(env: EnvMap): ServerObservabilityConfig | null {
  const apiKey = resolveApiKey(env);
  if (!apiKey) {
    if (isDatadogRequired(env)) {
      throw new Error(failClosedMessage(missingServerKeys(env)));
    }
    return null;
  }
  return {
    apiKey,
    site: resolveSite(env),
    service: resolveService(env),
    env: resolveEnvName(env),
    version: resolveVersion(env),
  };
}

export function requireRumPublicConfig(env: EnvMap): RumPublicConfig | null {
  const applicationId = resolveRumApplicationId(env);
  const clientToken = resolveRumClientToken(env);
  if (!applicationId || !clientToken) return null;
  return {
    applicationId,
    clientToken,
    site: resolveSite(env),
    service: resolveService(env),
    env: resolveEnvName(env),
    version: resolveVersion(env),
  };
}

export function shouldSampleRoutine(envName: string): boolean {
  if (envName !== "production") return true;
  return Math.random() < 0.2;
}

export function logStatusRank(status: DatadogLogStatus): number {
  switch (status) {
    case "debug":
      return 0;
    case "info":
      return 1;
    case "warn":
      return 2;
    case "error":
      return 3;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
