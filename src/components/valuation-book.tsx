import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { getValuationBook } from "@/lib/server/tcg";
import type { ValuationBook } from "@/lib/tcg/comps";
import { loadDeskKeys } from "@/lib/settings/keys";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/utils";
import { PriceRangeBar } from "@/components/price-range";

const FAMILY: Record<string, string> = {
  sold: "Sold comps",
  listed: "Live asks",
  retail: "Retail / direct",
  model: "Models",
};

export function ValuationBookPanel({ cardId }: { cardId: string }) {
  const [book, setBook] = useState<ValuationBook | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    getValuationBook({ data: { id: cardId, grade: "raw", keys: loadDeskKeys() } })
      .then((row) => {
        if (live) setBook(row);
      })
      .catch(() => {
        if (live) setBook(null);
      });
    return () => {
      live = false;
    };
  }, [cardId]);

  if (book === undefined) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }
  if (!book) {
    return <p className="text-sm text-muted">Valuation book could not load.</p>;
  }

  const tone = book.confidence === "high" ? "good" : book.confidence === "medium" ? "fair" : "bad";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-tight">Valuation book</h2>
          <p className="text-sm text-muted">{book.note}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl tabular-nums">{formatUsd(book.blend)}</p>
          <p className="text-xs text-subtle">
            Middle of the book · conservative {formatUsd(book.conservative)}
          </p>
          <p className="text-xs text-subtle">
            Desk range {formatUsd(book.rangeLow)}–{formatUsd(book.rangeHigh)}
          </p>
          <div className="mt-1 flex justify-end gap-2">
            <Badge variant={tone}>{book.confidence} confidence</Badge>
            {book.conflict && <Badge variant="bad">Desks Differ</Badge>}
          </div>
          {book.conflictDetail && (
            <p className="mt-1 max-w-xs text-xs text-deal-bad">{book.conflictDetail}</p>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <PriceRangeBar
          ask={null}
          book={book.blend}
          low={book.rangeLow}
          high={book.rangeHigh}
        />
      </div>

      {(["sold", "listed", "retail", "model"] as const).map((family) => {
        const rows = book.quotes.filter((q) => q.family === family);
        if (!rows.length) return null;
        return (
          <div key={family} className="mb-5">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-subtle">{FAMILY[family]}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((q) => (
                <div key={q.source} className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{q.label}</p>
                    <p className="font-mono text-sm tabular-nums">{formatUsd(q.usd)}</p>
                  </div>
                  <p className="mt-1 text-xs text-subtle">{q.note}</p>
                  {q.url && (
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex h-11 items-center gap-1 text-xs text-muted hover:text-fg"
                    >
                      Source <ArrowUpRight className="size-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <aside className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <h3 className="font-display text-xl tracking-tight">How the desk prices</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            <span className="text-fg">Shop buyer.</span> Completed eBay sales beat listed asks.
            TCGPlayer market can sit high for weeks. Steal requires the conservative blend, not
            one snapshot.
          </li>
          <li>
            <span className="text-fg">EU desk.</span> Cardmarket 7-day is the check on US prints.
            If TCGPlayer is 35%+ above Cardmarket, we use the lower number.
          </li>
          <li>
            <span className="text-fg">Sold-comp desk.</span> PriceCharting and IQR-trimmed eBay
            solds. Outliers (one $9,999 BIN) get dropped before the median.
          </li>
          <li>
            <span className="text-fg">Quant.</span> Weighted blend: solds heaviest, then TCGPlayer
            market, Cardmarket 7-day, PriceCharting, TCGCSV dump. High confidence needs four desks
            inside ~22%.
          </li>
        </ul>
      </aside>
    </div>
  );
}
