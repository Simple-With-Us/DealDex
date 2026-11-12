import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { openSentryFeedback } from "@/lib/observability/sentry";

export function AppErrorComponent(_props: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-deal-bad" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-xl tracking-tight">This page did not load</h1>
      <p className="max-w-md text-sm text-muted">
        Reload the page and try again.{"\u00A0 "}If it keeps happening, report the problem.
      </p>
      <button
        type="button"
        onClick={() => openSentryFeedback()}
        className="mt-2 inline-flex h-11 items-center text-sm text-subtle underline decoration-border underline-offset-2 hover:text-fg"
      >
        Report a Problem
      </button>
    </main>
  );
}
