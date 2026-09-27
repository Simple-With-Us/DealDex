import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Shell } from "@/components/shell";
import { Scanner } from "@/components/scanner";
import { Evaluator } from "@/components/evaluator";
import { MarketBoard } from "@/components/market-board";
import { APP_SUBTITLE } from "@/lib/copy";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <section className="mb-8 text-center">
        <h1 className="mx-auto max-w-4xl font-display text-4xl tracking-tight sm:text-5xl">
          {APP_SUBTITLE}
        </h1>
        <p className="mt-4 text-left text-muted">
          Search supported Buy It Now singles on eBay and Mercari, then compare asking prices
          with available market references. {"  "}Coverage depends on the listing, source access,
          and any paid data services you configure.
        </p>
      </section>
      <Scanner />
      {/*
        Styled as a card to match everything around it.  This was a bare native
        <details> marker sitting between fully designed panels.
      */}
      <details className="group mt-14 rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:p-5">
          <span>
            <span className="block font-display text-2xl tracking-tight text-fg">
              Or paste one listing
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              Drop in a title and price from anywhere and score it against the same desks.
            </span>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-border/30 p-4 sm:p-5">
          <Evaluator />
        </div>
      </details>
      <div className="mt-14">
        <MarketBoard />
      </div>
    </Shell>
  );
}
