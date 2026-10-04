/**
 * POST /api/alerts/run — background scan runner trigger.
 *
 * Called by .github/workflows/scan-runner.yml once per minute.  Reads
 * `alert_rules` (server-side table), runs Market.scan per enabled rule,
 * applies the auto-buy decision engine in dry-run mode, and persists a
 * `scan_runs` row.  Auth: bearer token from the SCAN_RUNNER_TOKEN env
 * var (rotated via Infisical).  The token is never logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import { runScanRunner } from "@/lib/server/scan-runner";
import { getSetting, initAppSettings } from "@/lib/server/app-settings";

function checkRunnerToken(req: Request): boolean {
  // Infisical sole source of truth — SCAN_RUNNER_TOKEN lives there (see INFISICAL.md).
  const expected = getSetting("SCAN_RUNNER_TOKEN");
  if (!expected) return false;
  const header = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(header && header === expected);
}

async function json(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/alerts/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await initAppSettings();
        if (!checkRunnerToken(request)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const body = await json(request);
        const result = await runScanRunner({
          data: {
            forceScan: Boolean(body.forceScan),
            cursorMs: typeof body.cursorMs === "number" ? body.cursorMs : 0,
          },
        });
        return Response.json(result);
      },
    },
  },
});