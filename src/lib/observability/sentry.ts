/**
 * Sentry client observability for DealDex.
 *
 * Gated on VITE_SENTRY_DSN (inlined by Vite at build time).
 * Completely inert in dev/CI when no DSN is provided.
 *
 * Replay stays 100% on error / 10% session.  DealDex is not the giant
 * public congress.trade surface; reserved Replay quota is org-level.
 * User Feedback is the consumer widget (auto-injected).  Privacy: mask
 * all text and block all media on Replay.
 *
 * Logs: Sentry v11 removed the top-level `enableLogs` option.  Logs are now
 * always on in v11 (the flush pipeline is unconditional), so no flag is set
 * here.  Console calls are still captured as breadcrumbs by the default
 * `consoleIntegration`; to send them as Sentry *logs* instead, add
 * `Sentry.consoleLoggingIntegration()` to `integrations`.
 */

import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry(): void {
  if (initialized || typeof window === "undefined") return;

  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn) return;

  const env = (import.meta.env.VITE_SENTRY_ENV as string | undefined)?.trim() ||
    (import.meta.env.MODE as string | undefined) ||
    "production";

  const tracesSampleRate = Number(
    (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined)?.trim() ?? "0.2"
  );
  const replayRaw = (import.meta.env.VITE_SENTRY_REPLAY_ENABLED as string | undefined)?.trim();
  const replayDisabled = replayRaw ? /^(false|0|off|no)$/i.test(replayRaw) : false;
  const replaysSessionSampleRate = Number(
    (import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE as string | undefined)?.trim() ?? "0.1"
  );
  const replaysOnErrorSampleRate = Number(
    (import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE as string | undefined)?.trim() ?? "1.0"
  );

  Sentry.init({
    dsn,
    environment: env,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? Math.min(Math.max(tracesSampleRate, 0), 1) : 0.2,
    replaysSessionSampleRate: !replayDisabled && Number.isFinite(replaysSessionSampleRate) ? replaysSessionSampleRate : 0,
    replaysOnErrorSampleRate: !replayDisabled && Number.isFinite(replaysOnErrorSampleRate) ? replaysOnErrorSampleRate : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.feedbackIntegration({
        colorScheme: "light",
        autoInject: false,
        showBranding: false,
        buttonLabel: "Report a Problem",
        submitButtonLabel: "Send",
        formTitle: "Report a Problem",
      }),
      ...(!replayDisabled
        ? [
            Sentry.replayIntegration({
              maskAllText: true,
              blockAllMedia: true,
            }),
          ]
        : []),
    ],
  });

  initialized = true;
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;

/** Open the Sentry user feedback dialog programmatically. */
export function openSentryFeedback(): void {
  try {
    const feedback = Sentry.getFeedback?.();
    if (feedback?.createForm) {
      void feedback.createForm().then((form) => {
        form.appendToDom();
        form.open();
      }).catch(() => {});
      return;
    }

    if (typeof window !== "undefined") {
      const windowFeedback = (window as unknown as { Sentry?: { getFeedback?: () => { createForm?: () => Promise<{ appendToDom: () => void; open: () => void }> } } }).Sentry?.getFeedback?.();
      if (windowFeedback?.createForm) {
        void windowFeedback.createForm().then((form) => {
          form.appendToDom();
          form.open();
        }).catch(() => {});
      }
    }
  } catch {
    // Safe no-op if feedback is not initialized or fails
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { openSentryFeedback?: typeof openSentryFeedback }).openSentryFeedback = openSentryFeedback;
}
