/**
 * eBay OAuth 2.0 helper — Authorization Code grant with PKCE for native.
 *
 * Power users grant DealDex permission to place Buy It Now orders on
 * their behalf via eBay's standard OAuth flow.  Per fleet-wide preference
 * (user memory, 2026-09-21), the credentials never live in a Settings
 * text field — they arrive via this exchange.
 *
 * Flow:
 *   1. /api/settings/ebay/oauth/start builds a code_verifier + code_challenge
 *      and redirects the user's browser to eBay's consent page.
 *   2. eBay redirects back to /api/settings/ebay/oauth/callback?code=…
 *      &state=…  (the runId we stored in oauth_states).
 *   3. callback verifies the state, exchanges the code for an access +
 *      refresh token, persists the refresh token to user_settings, and
 *      redirects the user to /settings?ebay=connected.
 *
 * Tokens are server-side only.  The refresh token never leaves the
 * user_settings table and is never returned to the browser.
 *
 * Env (server-side, app-level, shared by all users):
 *   EBAY_APP_ID              OAuth client id (developer.ebay.com)
 *   EBAY_CERT_ID             OAuth client secret (Infisical only)
 *   EBAY_REDIRECT_URI        e.g. https://dealdex.net/api/settings/ebay/oauth/callback
 *   EBAY_ENV                 'production' (default) | 'sandbox'
 *
 * Required scope for auto-buy: https://api.ebay.com/oauth/api_scope/buy.order
 * Read scope for the Browse API we already use: buy.item.feed (added
 * automatically when the user has signed in once).
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { upsertUserSettings } from "./user-settings-store";
import { defaultServerEnv } from "./app-settings";

const PROD_AUTH = "https://auth.ebay.com/oauth2/authorize";
const PROD_TOKEN = "https://api.ebay.com/identity/v1/oauth2/token";
const SANDBOX_AUTH = "https://auth.sandbox.ebay.com/oauth2/authorize";
const SANDBOX_TOKEN = "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope/buy.item.feed",
  "https://api.ebay.com/oauth/api_scope/buy.order",
];

export function readEbayOAuthConfig(env: Record<string, string | undefined> = defaultServerEnv()): {
  appId: string;
  certId: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
} | null {
  const appId = env.EBAY_APP_ID?.trim();
  const certId = env.EBAY_CERT_ID?.trim();
  const redirectUri = env.EBAY_REDIRECT_URI?.trim();
  if (!appId || !certId || !redirectUri) return null;
  const sandbox = env.EBAY_ENV?.trim().toLowerCase() === "sandbox";
  return {
    appId,
    certId,
    redirectUri,
    authUrl: sandbox ? SANDBOX_AUTH : PROD_AUTH,
    tokenUrl: sandbox ? SANDBOX_TOKEN : PROD_TOKEN,
  };
}

/**
 * PKCE code_verifier — RFC 7636.
 *   code_verifier ∈ [43, 128] characters, [A-Z][a-z][0-9]\-._~
 */
export function generateCodeVerifier(byteLength = 48): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return base64UrlEncode(bytes);
}

export async function generateCodeChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * In-memory state map: state → { userId, codeVerifier, createdAt }.
 *
 * Single-process dev only.  Production replaces this with a redis
 * `oauth_states` table; the interface stays the same.
 */
type OAuthState = { userId: string; codeVerifier: string; createdAt: number };
const oauthStates = new Map<string, OAuthState>();
const STATE_TTL_MS = 10 * 60 * 1000;

export function recordOAuthState(state: string, payload: OAuthState): void {
  oauthStates.set(state, payload);
  // Sweep stale states periodically (cheap; in-memory only).
  const cutoff = Date.now() - STATE_TTL_MS;
  for (const [k, v] of oauthStates) if (v.createdAt < cutoff) oauthStates.delete(k);
}

export function consumeOAuthState(state: string): OAuthState | null {
  const payload = oauthStates.get(state);
  if (!payload) return null;
  oauthStates.delete(state);
  if (Date.now() - payload.createdAt > STATE_TTL_MS) return null;
  return payload;
}

export const startEbayOAuth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const cfg = readEbayOAuthConfig();
    if (!cfg) {
      return Response.json(
        { error: "eBay OAuth is not configured on the server (EBAY_APP_ID / EBAY_CERT_ID / EBAY_REDIRECT_URI)." },
        { status: 503 },
      );
    }
    const userId = currentUserId(context);
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    const state = generateCodeVerifier(16);
    const verifier = generateCodeVerifier(48);
    const challenge = await generateCodeChallengeS256(verifier);
    recordOAuthState(state, { userId, codeVerifier: verifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: cfg.appId,
      response_type: "code",
      redirect_uri: cfg.redirectUri,
      scope: SCOPES.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return Response.json({ url: `${cfg.authUrl}?${params.toString()}` });
  });

type CallbackInput = { code?: string; state?: string };

export const callbackEbayOAuth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CallbackInput = {}) => ({
    code: typeof input.code === "string" ? input.code : "",
    state: typeof input.state === "string" ? input.state : "",
  }))
  .handler(async ({ data, context }) => {
    const cfg = readEbayOAuthConfig();
    if (!cfg) {
      return Response.json({ error: "eBay OAuth is not configured on the server." }, { status: 503 });
    }
    if (!data.code || !data.state) {
      return Response.json({ error: "missing code or state" }, { status: 400 });
    }
    const state = consumeOAuthState(data.state);
    if (!state) {
      return Response.json({ error: "state expired or unknown" }, { status: 400 });
    }
    const userId = currentUserId(context);
    if (!userId || userId !== state.userId) {
      return Response.json({ error: "user mismatch" }, { status: 403 });
    }

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", data.code);
    body.set("redirect_uri", cfg.redirectUri);
    body.set("code_verifier", state.codeVerifier);

    const auth = Buffer.from(`${cfg.appId}:${cfg.certId}`).toString("base64");
    const res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
    });
    if (!res.ok) {
      return Response.json(
        { error: `eBay token exchange failed: HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      username?: string;
    };
    if (!json.refresh_token) {
      return Response.json({ error: "eBay did not return a refresh_token" }, { status: 502 });
    }
    const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 7200;
    const expiry = new Date(Date.now() + Math.max(0, expiresIn - 300) * 1000).toISOString();
    const scopes = typeof json.scope === "string" ? json.scope.split(" ") : SCOPES;

    await upsertUserSettings(userId, {
      ebay_refresh_token: json.refresh_token,
      ebay_oauth_expiry: expiry,
      ebay_username: typeof json.username === "string" ? json.username : null,
      ebay_scopes: scopes,
    });

    return Response.json({ ok: true, ebay_username: json.username ?? null });
  });

/**
 * Refresh an access token against eBay using the stored refresh token.
 * Caller passes the refresh token; the helper handles the network call
 * and updates the row when eBay returns a new refresh token.
 */
export async function refreshEbayAccessToken(
  refreshToken: string,
  env: Record<string, string | undefined> = defaultServerEnv(),
): Promise<{ access_token: string; expires_in: number } | null> {
  const cfg = readEbayOAuthConfig(env);
  if (!cfg) return null;
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("scope", SCOPES.join(" "));
  const auth = Buffer.from(`${cfg.appId}:${cfg.certId}`).toString("base64");
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  return {
    access_token: json.access_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 7200,
  };
}

/**
 * Returns the user id from the auth middleware context.  Today this reads
 * `context.userId`; future middleware (Better Auth, Clerk, custom) can
 * be swapped without changing the OAuth handler.
 */
function currentUserId(context: unknown): string | null {
  const c = context as { userId?: string; user?: { id?: string } } | null;
  if (!c) return null;
  if (typeof c.userId === "string" && c.userId) return c.userId;
  if (c.user && typeof c.user.id === "string" && c.user.id) return c.user.id;
  return null;
}