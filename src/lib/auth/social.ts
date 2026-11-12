import type { SocialProviderId } from "./providers";
import { getSetting } from "../server/app-settings";

type Pair = { clientId: string; clientSecret: string };

/** First set candidate: Infisical cache → process.env → schema default. */
function firstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const val = getSetting(k);
    if (val) return val;
  }
  return undefined;
}

function resolvePair(candidatePairs: Array<[idKey: string, secretKey: string]>): Pair | undefined {
  for (const [idKey, secretKey] of candidatePairs) {
    const clientId = getSetting(idKey);
    const clientSecret = getSetting(secretKey);
    if (clientId && clientSecret) {
      return { clientId, clientSecret };
    }
  }
  return undefined;
}

/**
 * Generate the Apple client_secret JWT from raw key components.
 *
 * Apple Sign In does not use a static client secret — it requires a short-lived
 * ES256 JWT signed with the private key from your Apple Developer Console.
 * The token is valid for up to 6 months.  We generate it fresh each server
 * start so the secret in Vercel env only needs to be the raw `.p8` content,
 * not a pre-generated JWT that can expire silently.
 *
 * Required env vars (any naming convention):
 *   APPLE_CLIENT_ID    — your Apple Services ID (e.g. "com.example.web")
 *   APPLE_TEAM_ID      — 10-char team identifier from developer.apple.com
 *   APPLE_KEY_ID       — Key ID shown in developer.apple.com → Keys
 *   APPLE_PRIVATE_KEY  — full .p8 PEM content (newlines as \n or literal)
 *
 * Alternatively, if APPLE_CLIENT_SECRET is already a valid JWT, it's used as-is
 * (backward-compatible with the old pre-generated-JWT approach).
 */
async function generateAppleClientSecret(clientId: string): Promise<string> {
  // Dynamic import so jose (a transitive dep of better-auth) is never bundled
  // into the client — this function is only called server-side.
  const { SignJWT, importPKCS8 } = await import("jose");

  const teamId = firstEnv("APPLE_TEAM_ID", "DEALDEX_APPLE_TEAM_ID", "DD_APPLE_TEAM_ID");
  const keyId = firstEnv("APPLE_KEY_ID", "DEALDEX_APPLE_KEY_ID", "DD_APPLE_KEY_ID");
  // Support both literal newlines and \n-escaped strings stored in env vars.
  const rawKey = firstEnv("APPLE_PRIVATE_KEY", "DEALDEX_APPLE_PRIVATE_KEY", "DD_APPLE_PRIVATE_KEY")
    ?.replace(/\\n/g, "\n");

  if (!teamId || !keyId || !rawKey) {
    throw new Error(
      "Apple Sign In: missing APPLE_TEAM_ID, APPLE_KEY_ID, or APPLE_PRIVATE_KEY env vars. " +
      "Set all three or set APPLE_CLIENT_SECRET to a pre-generated JWT.",
    );
  }

  const privateKey = await importPKCS8(rawKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    // 5 months — well within Apple's 6-month max; refresh on next deploy.
    .setExpirationTime(now + 60 * 60 * 24 * 150)
    .setAudience("https://appleid.apple.com")
    .setSubject(clientId)
    .sign(privateKey);
}

/**
 * Resolve Apple credentials.  Returns a Pair and optionally a `clientSecretFn`
 * (for dynamic generation) or a static secret.
 *
 * Priority order:
 *   1. Pre-generated JWT  (APPLE_CLIENT_ID + APPLE_CLIENT_SECRET)
 *   2. Raw key components (APPLE_CLIENT_ID + APPLE_TEAM_ID + APPLE_KEY_ID + APPLE_PRIVATE_KEY)
 */
function resolveApplePair(): Pair | undefined {
  const clientId = firstEnv(
    "APPLE_CLIENT_ID",
    "DEALDEX_APPLE_CLIENT_ID",
    "DD_APPLE_CLIENT_ID",
  );
  if (!clientId) return undefined;

  // Path 1: pre-generated JWT already provided.
  const clientSecret = firstEnv(
    "APPLE_CLIENT_SECRET",
    "DEALDEX_APPLE_CLIENT_SECRET",
    "DD_APPLE_CLIENT_SECRET",
  );
  if (clientSecret) return { clientId, clientSecret };

  // Path 2: raw key components — generate JWT now (sync-compatible: we
  // return a placeholder and let the server.ts use clientSecretFn instead).
  // Returning undefined here means the Apple provider won't be registered
  // until the async version is resolved; callers that support async resolution
  // should call `resolveAppleConfig()` instead.
  const hasRawKey = Boolean(
    firstEnv("APPLE_TEAM_ID", "DEALDEX_APPLE_TEAM_ID", "DD_APPLE_TEAM_ID") &&
    firstEnv("APPLE_KEY_ID", "DEALDEX_APPLE_KEY_ID", "DD_APPLE_KEY_ID") &&
    firstEnv("APPLE_PRIVATE_KEY", "DEALDEX_APPLE_PRIVATE_KEY", "DD_APPLE_PRIVATE_KEY"),
  );
  if (!hasRawKey) return undefined;

  // Return a sentinel — callers should use resolveAppleConfig() for the async
  // JWT.  This path is only reached in hasSocialProvider() checks.
  return { clientId, clientSecret: "__pending_apple_jwt__" };
}

/**
 * Async version: resolves the Apple Pair with a real generated JWT when raw
 * key components are present.  Used by `socialProviderConfig()`.
 */
async function resolveAppleConfigAsync(): Promise<
  (Pair & { appBundleIdentifier?: string }) | undefined
> {
  const clientId = firstEnv(
    "APPLE_CLIENT_ID",
    "DEALDEX_APPLE_CLIENT_ID",
    "DD_APPLE_CLIENT_ID",
  );
  if (!clientId) return undefined;

  const appBundleIdentifier =
    firstEnv("APPLE_APP_BUNDLE_IDENTIFIER", "APPLE_BUNDLE_ID", "DEALDEX_APPLE_BUNDLE_ID") ||
    "net.dealdex";

  // Path 1: pre-generated JWT.
  const staticSecret = firstEnv(
    "APPLE_CLIENT_SECRET",
    "DEALDEX_APPLE_CLIENT_SECRET",
    "DD_APPLE_CLIENT_SECRET",
  );
  if (staticSecret) {
    return { clientId, clientSecret: staticSecret, appBundleIdentifier };
  }

  // Path 2: generate JWT from raw key components.
  const hasRawKey = Boolean(
    firstEnv("APPLE_TEAM_ID", "DEALDEX_APPLE_TEAM_ID", "DD_APPLE_TEAM_ID") &&
    firstEnv("APPLE_KEY_ID", "DEALDEX_APPLE_KEY_ID", "DD_APPLE_KEY_ID") &&
    firstEnv("APPLE_PRIVATE_KEY", "DEALDEX_APPLE_PRIVATE_KEY", "DD_APPLE_PRIVATE_KEY"),
  );
  if (!hasRawKey) return undefined;

  try {
    const clientSecret = await generateAppleClientSecret(clientId);
    return { clientId, clientSecret, appBundleIdentifier };
  } catch (err) {
    console.error("[DealDex] Failed to generate Apple client_secret JWT:", err);
    return undefined;
  }
}

/** Google / Apple / X (Twitter) client creds from env.  Missing providers are omitted. */
export async function socialProviderConfig(): Promise<{
  google?: Pair;
  apple?: Pair & { appBundleIdentifier?: string };
  twitter?: Pair;
}> {
  const google = resolvePair([
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    ["DD_WEB_GOOGLE_ID", "DD_WEB_GOOGLE_SECRET"],
    ["DEALDEX_GOOGLE_CLIENT_ID", "DEALDEX_GOOGLE_CLIENT_SECRET"],
    ["DEALDEX_WEB_GOOGLE_ID", "DEALDEX_WEB_GOOGLE_SECRET"],
  ]);
  const apple = await resolveAppleConfigAsync();
  const twitter = resolvePair([
    ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
    ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    ["DEALDEX_X_CLIENT_ID", "DEALDEX_X_CLIENT_SECRET"],
    ["DD_X_CLIENT_ID", "DD_X_CLIENT_SECRET"],
  ]);

  return {
    ...(google ? { google } : {}),
    ...(apple ? { apple } : {}),
    ...(twitter ? { twitter } : {}),
  };
}

export function hasSocialProvider(id: SocialProviderId): boolean {
  // Synchronous check — uses the sentinel path for Apple raw-key detection.
  const idMap: Record<SocialProviderId, () => Pair | undefined> = {
    google: () =>
      resolvePair([
        ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        ["DD_WEB_GOOGLE_ID", "DD_WEB_GOOGLE_SECRET"],
        ["DEALDEX_GOOGLE_CLIENT_ID", "DEALDEX_GOOGLE_CLIENT_SECRET"],
        ["DEALDEX_WEB_GOOGLE_ID", "DEALDEX_WEB_GOOGLE_SECRET"],
      ]),
    apple: resolveApplePair,
    twitter: () =>
      resolvePair([
        ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"],
        ["X_CLIENT_ID", "X_CLIENT_SECRET"],
        ["DEALDEX_X_CLIENT_ID", "DEALDEX_X_CLIENT_SECRET"],
        ["DD_X_CLIENT_ID", "DD_X_CLIENT_SECRET"],
      ]),
  };
  return Boolean(idMap[id]?.());
}
