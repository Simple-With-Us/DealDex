import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SOCIAL_PROVIDERS, authEnabled, signIn, type SocialProviderId } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { safeInternalPath } from "@/lib/auth/safe-redirect";
import { Button } from "@/components/ui/button";
import { DealDexWordmark } from "@/components/app-mark";
import { APP_SUBTITLE } from "@/lib/copy";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    if (typeof search.redirect !== "string") return {};
    return { redirect: safeInternalPath(search.redirect, "/settings") };
  },
  component: Login,
});

function ProviderIcon({ id }: { id: SocialProviderId }) {
  if (id === "google") {
    return (
      <svg className="size-4 shrink-0" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
    );
  }
  if (id === "apple") {
    return (
      <svg className="size-4 shrink-0 fill-current" viewBox="0 0 170 170">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.91-12.03-14.49-6.08-9.28-10.9-19.92-14.47-31.91-3.57-12-5.36-23.23-5.36-33.7 0-14.81 3.7-27.13 11.09-36.95 7.39-9.82 16.73-14.82 28.02-15 4.58 0 9.87 1.25 15.87 3.75 6 2.5 10.02 3.75 12.06 3.75 1.63 0 5.8-1.31 12.51-3.95 6.72-2.63 12.33-3.83 16.85-3.59 12.87.62 23.36 5.56 31.47 14.82-11.25 6.84-16.73 16.31-16.44 28.42.3 9.47 3.97 17.43 11.02 23.88 7.05 6.45 15.34 10.08 24.87 10.89-2.03 6.09-4.48 12.06-7.36 17.91zM119.22 33.63c0-7.38 2.65-14.28 7.95-20.7 5.3-6.42 11.83-10.73 19.59-12.93.88 7.15-1.12 14.07-6 20.76-4.88 6.69-11.27 10.98-19.18 12.87-.73-1.07-1.36-2.08-1.89-3.04-.32-.58-.75-1.25-1.27-2.02-.75-1.17-1.1-2.29-1.2-3.37v-1.57z" />
      </svg>
    );
  }
  return (
    <svg className="size-4 shrink-0 fill-current" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function Login() {
  const search = Route.useSearch();
  const callbackURL = search.redirect ?? "/settings";
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();

  // If the user becomes signed in while this page is open (OAuth round-trip
  // completed, or they navigated here while already signed in), close the
  // login card by redirecting to the intended destination.
  useEffect(() => {
    if (!isPending && user) {
      void navigate({ to: callbackURL as "/" });
    }
  }, [isPending, user, callbackURL, navigate]);

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-surface p-6 sm:p-7 shadow-[var(--shadow-border)]">
        <div>
          <DealDexWordmark className="mx-auto h-12 max-w-[18rem] sm:h-14 sm:max-w-[22rem]" />
          <p className="mt-3 text-center text-sm font-medium text-muted">{APP_SUBTITLE}</p>
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Sign in to DealDex</h1>
          <p className="mt-1.5 text-sm text-muted leading-relaxed">
            Guests can scan without an account.{"\u00A0 "}
            Sign in to back up saved deals and price-source keys.
          </p>
        </div>

        {authEnabled ? (
          <div className="space-y-2.5">
            {SOCIAL_PROVIDERS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="secondary"
                className="h-11 w-full justify-center gap-2.5 rounded-xl font-medium shadow-xs"
                onClick={() => void signIn(p.id, { callbackURL })}
              >
                <ProviderIcon id={p.id} />
                <span>Continue with {p.label}</span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link
          to="/"
          className="flex h-11 items-center justify-center text-center text-sm font-medium text-muted hover:text-fg"
        >
          Back to Scan
        </Link>
      </div>
    </main>
  );
}

