/**
 * GET/POST /api/admin/settings — admin settings surface for the Infisical
 * sole-source-of-truth contract (see INFISICAL.md).
 *
 * Admin gating: DealDex has no user roles — the existing machine credential,
 * the SCAN_RUNNER_TOKEN bearer (same token that gates /api/alerts/run for
 * the scan-runner cron), is the admin gate.  Non-admin requests get 403.
 *
 *   GET   → key inventory: names + metadata only (kind, source, configured).
 *           Secret VALUES are never returned.
 *   POST  → { action: "set", key, value }  write-through save: Infisical
 *           FIRST, then the local cache.  A failed Infisical write fails the
 *           save — the two never diverge silently.
 *           { action: "refresh" }           on-demand cache refresh
 *           ("Reload settings").
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  getSetting,
  initAppSettings,
  refreshSettings,
  resolveAppEnv,
  setSetting,
  settingSource,
  settingsConnected,
  SETTING_DEFS,
} from "@/lib/server/app-settings";

async function requireAdmin(request: Request): Promise<Response | null> {
  await initAppSettings();
  const expected = getSetting("SCAN_RUNNER_TOKEN");
  const header = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !header || header !== expected) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

async function json(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/admin/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        return Response.json({
          environment: resolveAppEnv(),
          connected: settingsConnected(),
          settings: SETTING_DEFS.map((def) => ({
            name: def.name,
            kind: def.kind,
            source: settingSource(def.name),
            configured: settingSource(def.name) !== "unset",
            blurb: def.blurb,
          })),
        });
      },
      POST: async ({ request }) => {
        const denied = await requireAdmin(request);
        if (denied) return denied;
        const body = await json(request);
        const action = body.action;
        if (action === "refresh") {
          const refreshed = await refreshSettings();
          return Response.json({ refreshed, connected: settingsConnected() });
        }
        if (action === "set") {
          const key = typeof body.key === "string" ? body.key : "";
          const value = typeof body.value === "string" ? body.value : "";
          if (!key || !value) {
            return Response.json({ error: "key and value are required" }, { status: 400 });
          }
          try {
            await setSetting(key, value);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = /not connected/i.test(message)
              ? 503
              : /unknown app setting/i.test(message)
                ? 400
                : 502;
            return Response.json({ error: message }, { status });
          }
          return Response.json({ ok: true, key, source: settingSource(key) });
        }
        return Response.json({ error: 'unknown action (want "set" or "refresh")' }, { status: 400 });
      },
    },
  },
});
