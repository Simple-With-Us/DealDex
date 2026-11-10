/**
 * Nitro Sentry init + flush for Vercel isolates.
 *
 * Scan hop spans are opened in the scan handlers, not here.  Datadog keeps
 * the one-span-per-request `web.request` parent.  Missing SENTRY_DSN /
 * VITE_SENTRY_DSN is a no-op and never 503s the site.
 */
import {
  flushSentryServer,
  initSentryServer,
} from "../../src/lib/observability/sentry-server";

interface SentryEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function sentryMiddleware(
  _event: SentryEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  await initSentryServer();
  try {
    return await next();
  } finally {
    await flushSentryServer(2000);
  }
}
