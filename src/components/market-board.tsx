import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getMarketBoard } from "@/lib/server/tcg";
import type { TcgCard } from "@/lib/tcg/types";
import { cardImageUrl, formatUsd } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketBoard() {
  const [cards, setCards] = useState<TcgCard[] | null>(null);

  useEffect(() => {
    let live = true;
    getMarketBoard()
      .then((rows) => {
        if (live) setCards(rows);
      })
      .catch(() => {
        if (live) setCards([]);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-tight">A few cards on TCGPlayer</h2>
          <p className="text-sm text-muted">
            Sample prices from TCGPlayer. Open a card for Cardmarket, sold listings, and
            PriceCharting.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {!cards &&
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        {cards && cards.length === 0 && (
          <p className="rounded-xl bg-surface p-6 text-sm text-muted shadow-[var(--shadow-border)]">
            Sample cards did not load. You can still search above.
          </p>
        )}
        {cards?.map((card) => {
          const market = card.finishes.find((f) => f.market != null)?.market ?? null;
          const img = cardImageUrl(card.image, "low");
          return (
            <Link
              key={card.id}
              to="/card/$cardId"
              params={{ cardId: card.id }}
              className="flex gap-3 rounded-lg bg-surface p-2.5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              {img ? (
                <img src={img} alt="" className="h-[88px] w-16 rounded-sm object-cover" />
              ) : (
                <div className="h-[88px] w-16 rounded-sm bg-elevated" />
              )}
              <span className="min-w-0 py-0.5">
                <span className="block truncate text-sm font-medium">{card.name}</span>
                <span className="block truncate text-xs text-subtle">{card.setName}</span>
                <span className="mt-2 block font-mono text-base tabular-nums">
                  {formatUsd(market)}
                </span>
                <span className="block text-xs uppercase tracking-[0.12em] text-subtle">
                  TCGPlayer
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
