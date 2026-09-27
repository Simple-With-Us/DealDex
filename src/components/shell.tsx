import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { AccountMenu, GuestMenu } from "@/components/account-menu";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { DealDexWordmark } from "@/components/app-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openSentryFeedback } from "@/lib/observability/sentry";

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Skeleton className="size-9 rounded-full" />;
  return user ? (
    <AccountMenu />
  ) : (
    <GuestMenu />
  );
}

const PAGE = "mx-auto w-full min-w-0 max-w-7xl px-4";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh min-w-0 overflow-x-hidden bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/85 backdrop-blur-sm">
        <div className={cn(PAGE, "flex h-14 items-center justify-between gap-3")}>
          <Link to="/" className="flex shrink-0 items-center" aria-label="DealDex home">
            <DealDexWordmark />
          </Link>
          <nav className="flex shrink-0 items-center gap-0.5 text-sm sm:gap-1">
            <Link
              to="/"
              className="hidden h-11 items-center px-3 text-muted transition-colors duration-150 hover:text-fg sm:inline-flex"
            >
              Scan
            </Link>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/install">
                <Smartphone />
                Apps
              </Link>
            </Button>
            <AuthSlot />
          </nav>
        </div>
      </header>
      <div className={cn(PAGE, "pb-16 pt-8 sm:pt-12")}>{children}</div>
      <footer className="border-t border-border/80">
        <div className={cn(PAGE, "flex flex-col gap-2 py-8 text-xs text-subtle sm:flex-row sm:items-start sm:justify-between sm:gap-8")}>
          <p>
            Reference values may come from TCGPlayer, Cardmarket, eBay solds, and PriceCharting when available.  Not affiliated with those markets or Pokémon.{" "}
            <Link to="/privacy" className="underline decoration-border underline-offset-2 hover:text-fg">
              Privacy
            </Link>{" "}·{" "}
            <button
              type="button"
              onClick={() => openSentryFeedback()}
              className="underline decoration-border underline-offset-2 hover:text-fg"
            >
              Report a Problem
            </button>
          </p>
          <div className="sm:max-w-sm sm:text-right">
            <p>Grade multipliers are estimates.  Confirm authenticity before you buy.</p>
            <a
              href="https://simplewithus.com/"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-subtle transition-colors hover:text-fg focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label="From Simple With Us"
            >
              <span>From</span>
              <img src="/swu-logo-wide.webp" alt="Simple With Us by Jay Wedgeworth" width="288" height="30" className="h-auto max-w-[calc(100vw-92px)] rounded-sm bg-white" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
