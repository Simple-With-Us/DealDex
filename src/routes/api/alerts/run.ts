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
import {
  parseRunnerRequest,
  runScanRunnerTick,
  type RunnerInput,
} from "@/lib/server/scan-runner.server";
import { getSetting, initAppSettings } from "@/lib/server/app-settings";

function checkRunnerToken(req: Request): boolean {
  // Infisical sole source of truth — SCAN_RUNNER_TOKEN lives there (see INFISICAL.md).
  const expected = getSetting("SCAN_RUNNER_TOKEN");
  if (!expected) return false;
  const header = req.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  return Boolean(header && header === expected);
}

export const Route = createFileRoute("/api/alerts/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await initAppSettings();
        if (!checkRunnerToken(request)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid payload" }, { status: 400 });
        }
        let input: RunnerInput;
        try {
          input = parseRunnerRequest(body);
        } catch (err) {
          if (err instanceof Response) {
            return Response.json({ error: "invalid payload" }, { status: err.status });
          }
          throw err;
        }
        const result = await runScanRunnerTick(input);
        return Response.json(result);
      },
    },
  },
});
