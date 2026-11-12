/**
 * Agentless Datadog logs + APM for the Nitro / Vercel function.
 *
 * Opt-in:  no DD_* keys means the middleware passes through dark.  DD_REQUIRE=1
 * restores the fail-closed 503 guard when DD_API_KEY is missing.  Missing RUM
 * tokens stay dark and must not 503 the site.
 * Application errors are rethrown after they are shipped — they stay visible.
 */
import {
  isDatadogRequired,
  missingServerKeys,
  requireServerObservability,
} from "../../src/lib/observability/config";
import { datadogTraceHeaders, parseIncomingTrace } from "../../src/lib/observability/ids";
import { nowNs, shipDatadogLog, shipDatadogSpan } from "../../src/lib/observability/server";

interface DatadogEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function requestHeaders(event: DatadogEvent): Headers {
  return event.req.headers instanceof Headers ? event.req.headers : new Headers();
}

function withTraceHeaders(response: Response, headers: Record<string, string>): Response {
  const next = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    next.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: next,
  });
}

function failClosedResponse(): Response {
  const missing = missingServerKeys(process.env);
  return new Response(
    `DealDex Datadog is fail-closed in production.  Missing ${missing.join(", ")}.`,
    {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    },
  );
}

export default async function datadogMiddleware(
  event: DatadogEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (isDatadogRequired(process.env) && missingServerKeys(process.env).length) {
    return failClosedResponse();
  }

  const config = requireServerObservability(process.env);
  if (!config) return next();

  const method = (event.req.method ?? "GET").toUpperCase();
  const path = event.url.pathname;
  const resource = `${method} ${path}`;
  const ctx = parseIncomingTrace(requestHeaders(event));
  const startNs = nowNs();
  const started = Date.now();

  try {
    const result = await next();
    const status = result instanceof Response ? result.status : 200;
    const error = status >= 500;
    const endNs = nowNs();
    const durationMs = Date.now() - started;

    void shipDatadogLog(config, {
      status: error ? "error" : "info",
      message: resource,
      resource,
      durationMs,
      httpStatus: status,
    }).catch((err) => {
      console.error("[datadog] log ship failed", err);
    });
    void shipDatadogSpan(config, {
      ctx,
      name: "web.request",
      resource,
      startNs,
      endNs,
      httpMethod: method,
      httpStatus: status,
      error,
    }).catch((err) => {
      console.error("[datadog] span ship failed", err);
    });

    if (result instanceof Response) {
      return withTraceHeaders(result, datadogTraceHeaders(ctx));
    }
    return result;
  } catch (err) {
    const endNs = nowNs();
    const durationMs = Date.now() - started;
    void shipDatadogLog(config, {
      status: "error",
      message: resource,
      resource,
      durationMs,
      httpStatus: 500,
      error: err,
    }).catch((shipErr) => {
      console.error("[datadog] log ship failed", shipErr);
    });
    void shipDatadogSpan(config, {
      ctx,
      name: "web.request",
      resource,
      startNs,
      endNs,
      httpMethod: method,
      httpStatus: 500,
      error: true,
      errorMessage: err instanceof Error ? err.message : String(err),
    }).catch((shipErr) => {
      console.error("[datadog] span ship failed", shipErr);
    });
    throw err;
  }
}
