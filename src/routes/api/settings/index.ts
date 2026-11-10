/**
 * GET /api/settings — current user's settings (no secrets).
 * PUT /api/settings — patch the non-secret fields (e.g. proxy_url_override).
 *
 * Secrets (refresh tokens, pushover creds) are only ever written by the
 * vendor's OAuth callback; the UI can read a masked view but never write
 * them.  This keeps a Settings page from leaking the refresh token through
 * a stale form re-submit.
 */
import { createFileRoute } from "@tanstack/react-router";
import { loadUserSettings, upsertUserSettings } from "@/lib/server/user-settings-store";

type SettingsView = {
  ebay_connected: boolean;
  ebay_username: string | null;
  ebay_oauth_expiry: string | null;
  ebay_scopes: string[];
  pushover_connected: boolean;
  email_address: string | null;
  sms_provider: string | null;
  sms_e164: string | null;
  proxy_url_override: string | null;
  updated_at: string | null;
};

function viewOf(s: Awaited<ReturnType<typeof loadUserSettings>>): SettingsView {
  if (!s) {
    return {
      ebay_connected: false,
      ebay_username: null,
      ebay_oauth_expiry: null,
      ebay_scopes: [],
      pushover_connected: false,
      email_address: null,
      sms_provider: null,
      sms_e164: null,
      proxy_url_override: null,
      updated_at: null,
    };
  }
  return {
    ebay_connected: Boolean(s.ebay_refresh_token),
    ebay_username: s.ebay_username,
    ebay_oauth_expiry: s.ebay_oauth_expiry,
    ebay_scopes: s.ebay_scopes,
    pushover_connected: Boolean(s.pushover_user_key && s.pushover_api_token),
    email_address: s.email_address,
    sms_provider: s.sms_provider,
    sms_e164: s.sms_e164,
    proxy_url_override: s.proxy_url_override,
    updated_at: s.updated_at,
  };
}

async function getUserId(request: Request): Promise<string | null> {
  // Stub: future Better Auth / Clerk middleware supplies this.  Until then,
  // the demo accepts an X-Demo-User header so curl tests can drive the
  // endpoint without spinning up a session.
  const header = request.headers.get("x-demo-user")?.trim();
  if (header) return header;
  // Pull from the auth context if available.
  const fromContext = request.headers.get("x-user-id")?.trim();
  return fromContext || null;
}

export const Route = createFileRoute("/api/settings/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserId(request);
        if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
        const s = await loadUserSettings(userId);
        return Response.json(viewOf(s));
      },
      PUT: async ({ request }) => {
        const userId = await getUserId(request);
        if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        // Only allow non-secret fields; refresh tokens + pushover creds are
        // vendor-set only.
        const patch: Parameters<typeof upsertUserSettings>[1] = {};
        if (typeof body.proxy_url_override === "string") patch.proxy_url_override = body.proxy_url_override.trim() || null;
        if (typeof body.email_address === "string") patch.email_address = body.email_address.trim() || null;
        if (typeof body.sms_e164 === "string") patch.sms_e164 = body.sms_e164.trim() || null;
        if (typeof body.sms_provider === "string") patch.sms_provider = body.sms_provider.trim() || null;
        const updated = await upsertUserSettings(userId, patch);
        return Response.json(viewOf(updated));
      },
    },
  },
});