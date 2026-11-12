import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { Evaluator } from "@/components/evaluator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCard } from "@/lib/server/tcg";
import { ebaySoldUrl, mercariSearchUrl, pickFinish, tcgplayerUrl } from "@/lib/tcg/appraise";
import type { TcgCard } from "@/lib/tcg/types";
import { ValuationBookPanel } from "@/components/valuation-book";
import { MarketplaceLogo } from "@/components/market-logo";
import { cardImageUrl, formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/card/$cardId")({ component: CardPage });

function CardPage() {
  const { cardId } = Route.useParams();
  const [card, setCard] = useState<TcgCard | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [prevCardId, setPrevCardId] = useState(cardId);
  if (prevCardId !== cardId) {
    setPrevCardId(cardId);
    setCard(undefined);
    setFailed(false);
  }

  useEffect(() => {
    let live = true;
    getCard({ data: { id: cardId } })
      .then((row) => {
        if (!live) return;
        setFailed(false);
        setCard(row);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setCard(null);
      });
    return () => {
      live = false;
    };
  }, [cardId, attempt]);

  const finish = useMemo(() => (card ? pickFinish(card, null) : null), [card]);
  const img = cardImageUrl(card?.image ?? null);

  return (
    <Shell>
      <Link
        to="/"
        className="mb-6 inline-flex h-11 items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      {card === undefined && (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <Skeleton className="aspect-[600/825] w-full" />
          <div className="space-y-3">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      )}

      {card === null && failed && (
        <div className="rounded-xl bg-surface p-6 text-sm text-muted shadow-[var(--shadow-border)]">
          <p>This card did not load.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setCard(undefined);
              setAttempt((n) => n + 1);
            }}
            className="mt-3 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            Try Again
          </button>
        </div>
      )}

      {card === null && !failed && <p className="text-muted">That card is not in the catalog.</p>}

      {card && (
        <div className="grid items-start gap-8 lg:grid-cols-[240px_1fr]">
          {img ? (
            <img
              src={img}
              alt={card.name}
              className="aspect-[600/825] w-full rounded-lg bg-elevated object-cover"
            />
          ) : (
            <div className="grid aspect-[600/825] place-items-center rounded-lg bg-elevated text-subtle">
              No scan
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">{card.setName}</p>
            <h1 className="font-display text-4xl tracking-tight">{card.name}</h1>
            <p className="mt-2 text-sm text-muted">
              #{card.localId}
              {card.rarity ? ` · ${card.rarity}` : ""}
              {card.types.length ? ` · ${card.types.join(" / ")}` : ""}
              {card.hp ? ` · ${card.hp} HP` : ""}
            </p>
            <p className="mt-6 font-mono text-3xl tabular-nums">{formatUsd(finish?.market)}</p>
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">
              TCGPlayer snapshot · {finish?.label ?? "market"}
            </p>
            <p className="mt-2 text-sm text-muted">
              This is the TCGPlayer price.{"\u00A0 "}Cardmarket, sold listings, and PriceCharting
              are below.
            </p>
            <p className="mt-2 font-mono text-sm tabular-nums text-muted">
              Low {formatUsd(finish?.low)} · Mid {formatUsd(finish?.mid)} · High{" "}
              {formatUsd(finish?.high)}
              {finish?.directLow != null ? ` · Direct ${formatUsd(finish.directLow)}` : ""}
            </p>
            {card.cardmarketEur != null && (
              <p className="mt-1 font-mono text-sm tabular-nums text-muted">
                Cardmarket €{card.cardmarketEur.toFixed(2)}
                {card.cardmarketAvg1 != null ? ` · 1d €${card.cardmarketAvg1.toFixed(2)}` : ""}
                {card.cardmarketAvg7 != null ? ` · 7d €${card.cardmarketAvg7.toFixed(2)}` : ""}
                {card.cardmarketAvg30 != null ? ` · 30d €${card.cardmarketAvg30.toFixed(2)}` : ""}
              </p>
            )}
            {card.updatedAt && (
              <p className="mt-1 text-xs text-subtle">Updated {card.updatedAt.slice(0, 10)}</p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <a href={tcgplayerUrl(card, finish)} target="_blank" rel="noreferrer">
                  TCGPlayer <ArrowUpRight />
                </a>
              </Button>
              <Button variant="secondary" asChild className="overflow-hidden">
                <a href={ebaySoldUrl(card, "raw")} target="_blank" rel="noreferrer">
                  <MarketplaceLogo marketplace="ebay" />
                  Sold Listings
                </a>
              </Button>
              <Button variant="secondary" asChild className="overflow-hidden">
                <a href={mercariSearchUrl(card, "raw")} target="_blank" rel="noreferrer">
                  <MarketplaceLogo marketplace="mercari" />
                  Search
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {card && (
        <div className="mt-12">
          <ValuationBookPanel key={card.id} cardId={card.id} />
        </div>
      )}

      {card && (
        <div className="mt-12">
          <h2 className="mb-4 font-display text-2xl tracking-tight">
            Appraise a listing of this card
          </h2>
          <Evaluator
            initialQuery={`${card.name} ${card.setName} ${card.localId}`}
            initialCardId={card.id}
          />
        </div>
      )}
    </Shell>
  );
}
