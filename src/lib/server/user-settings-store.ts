/**
 * Per-user settings store.
 *
 * Owner direction 2026-09-21: power users opt into per-integration OAuth,
 * so the credentials that back auto-buy (eBay refresh token) and the
 * out-of-app channels (Pushover, email, SMS) live here.  Every column
 * is populated by an OAuth callback or vendor SDK — never a Settings page
 * text field.
 *
 * Schema: src/lib/db.ts is the same getSql() used by alert_rules / scan_runs,
 * so this module follows the same Ne on vs PGlite backend switch with zero
 * code change.
 */
import { getSql } from "@/lib/db";

export type UserSettings = {
  user_id: string;
  ebay_refresh_token: string | null;
  ebay_oauth_expiry: string | null;
  ebay_username: string | null;
  ebay_scopes: string[];
  pushover_user_key: string | null;
  pushover_api_token: string | null;
  email_address: string | null;
  sms_provider: string | null;
  sms_e164: string | null;
  proxy_url_override: string | null;
  created_at: string;
  updated_at: string;
};

export type UserSettingsPatch = Partial<
  Omit<UserSettings, "user_id" | "created_at" | "updated_at">
>;

export async function loadUserSettings(userId: string): Promise<UserSettings | null> {
  const sql = await getSql();
  const rows = await sql<UserSettings>`select * from user_settings where user_id = ${userId}`;
  return rows[0] ?? null;
}

export async function upsertUserSettings(
  userId: string,
  patch: UserSettingsPatch,
): Promise<UserSettings> {
  const sql = await getSql();
  const existing = await loadUserSettings(userId);
  const next: UserSettings = {
    user_id: userId,
    ebay_refresh_token: existing?.ebay_refresh_token ?? null,
    ebay_oauth_expiry: existing?.ebay_oauth_expiry ?? null,
    ebay_username: existing?.ebay_username ?? null,
    ebay_scopes: existing?.ebay_scopes ?? [],
    pushover_user_key: existing?.pushover_user_key ?? null,
    pushover_api_token: existing?.pushover_api_token ?? null,
    email_address: existing?.email_address ?? null,
    sms_provider: existing?.sms_provider ?? null,
    sms_e164: existing?.sms_e164 ?? null,
    proxy_url_override: existing?.proxy_url_override ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...patch,
  };
  await sql`
    insert into user_settings (
      user_id, ebay_refresh_token, ebay_oauth_expiry, ebay_username,
      ebay_scopes, pushover_user_key, pushover_api_token, email_address,
      sms_provider, sms_e164, proxy_url_override, created_at, updated_at
    ) values (
      ${next.user_id}, ${next.ebay_refresh_token}, ${next.ebay_oauth_expiry},
      ${next.ebay_username}, ${next.ebay_scopes}, ${next.pushover_user_key},
      ${next.pushover_api_token}, ${next.email_address}, ${next.sms_provider},
      ${next.sms_e164}, ${next.proxy_url_override}, ${next.created_at},
      ${next.updated_at}
    )
    on conflict (user_id) do update set
      ebay_refresh_token   = excluded.ebay_refresh_token,
      ebay_oauth_expiry    = excluded.ebay_oauth_expiry,
      ebay_username        = excluded.ebay_username,
      ebay_scopes          = excluded.ebay_scopes,
      pushover_user_key    = excluded.pushover_user_key,
      pushover_api_token   = excluded.pushover_api_token,
      email_address        = excluded.email_address,
      sms_provider         = excluded.sms_provider,
      sms_e164             = excluded.sms_e164,
      proxy_url_override   = excluded.proxy_url_override,
      updated_at           = excluded.updated_at
  `;
  return next;
}

export async function deleteUserSettings(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from user_settings where user_id = ${userId}`;
}

/**
 * Read-only view the scan-runner consults every tick.  Returns the columns
 * it needs without leaking the refresh token into logs.
 */
export type RunUserCredentials = {
  has_ebay: boolean;
  ebay_username: string | null;
  ebay_oauth_expired: boolean;
  proxy_url_override: string | null;
  pushover_user_key: string | null;
  pushover_api_token: string | null;
  email_address: string | null;
  sms_provider: string | null;
  sms_e164: string | null;
};

export async function loadRunUserCredentials(
  userId: string,
  now: number = Date.now(),
): Promise<RunUserCredentials> {
  const settings = await loadUserSettings(userId);
  if (!settings) {
    return {
      has_ebay: false,
      ebay_username: null,
      ebay_oauth_expired: false,
      proxy_url_override: null,
      pushover_user_key: null,
      pushover_api_token: null,
      email_address: null,
      sms_provider: null,
      sms_e164: null,
    };
  }
  const expiry = settings.ebay_oauth_expiry ? new Date(settings.ebay_oauth_expiry).getTime() : 0;
  return {
    has_ebay: Boolean(settings.ebay_refresh_token),
    ebay_username: settings.ebay_username,
    ebay_oauth_expired: expiry > 0 && expiry < now,
    proxy_url_override: settings.proxy_url_override,
    pushover_user_key: settings.pushover_user_key,
    pushover_api_token: settings.pushover_api_token,
    email_address: settings.email_address,
    sms_provider: settings.sms_provider,
    sms_e164: settings.sms_e164,
  };
}