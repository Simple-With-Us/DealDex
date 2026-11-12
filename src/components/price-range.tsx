import { describeVsBook } from "@/lib/tcg/vs-book";
import { cn, formatUsd } from "@/lib/utils";

type Props = {
  ask: number | null;
  book: number | null;
  low: number | null;
  high: number | null;
  compact?: boolean;
};

function pct(value: number, start: number, span: number) {
  if (span <= 0) return 50;
  return Math.min(98, Math.max(2, ((value - start) / span) * 100));
}

export function PriceRangeBar({ ask, book, low, high, compact }: Props) {
  const vs = describeVsBook(ask, book, low, high);
  const hasAsk = ask != null && Number.isFinite(ask);
  const points = [low, high, book, ask].filter(
    (n): n is number => n != null && Number.isFinite(n) && n >= 0,
  );
  if (points.length < 2) {
    return <p className={cn("text-xs text-subtle", compact && "mt-1")}>{vs.headline}</p>;
  }

  // The axis is the DESK RANGE, because that is what the two numbers printed at
  // its ends say it is. The old domain was [min, max] across low/high/book/ask,
  // so as soon as the ask fell outside the desk range — exactly the case worth
  // reading — the printed endpoints stopped describing the bar's edges and the
  // dot's position misled. An out-of-range ask is now pinned at the edge and
  // drawn differently instead.
  const bandLo = low ?? (book != null ? book * 0.92 : Math.min(...points));
  const bandHi = high ?? (book != null ? book * 1.08 : Math.max(...points));
  const lo = Math.min(bandLo, bandHi);
  const hi = Math.max(bandLo, bandHi);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.04, 0.75);
  const start = Math.max(0, lo - pad);
  const end = hi + pad;
  const span = end - start;
  const bandL = pct(lo, start, span);
  const bandR = pct(hi, start, span);
  const left = Math.min(bandL, bandR);
  const width = Math.max(2, Math.abs(bandR - bandL));
  const askLeft = ask != null ? pct(ask, start, span) : null;
  const askOutside = ask != null && (ask < start || ask > end);
  const bookLeft = book != null ? pct(book, start, span) : null;
  const tone = vs.tone === "good" ? "bg-deal-good" : vs.tone === "bad" ? "bg-deal-bad" : "bg-fg";

  return (
    <div className={cn("min-w-0", compact ? "mt-2 space-y-1.5" : "space-y-2")}>
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-fg">{hasAsk ? vs.headline : "Published prices"}</p>
          <p className="text-xs text-subtle">
            {hasAsk ? vs.detail : `${formatUsd(low)}–${formatUsd(high)} across price sources.`}
          </p>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums text-subtle">
        <span>{formatUsd(low ?? book)}</span>
        <span className="truncate text-center text-muted">Price range</span>
        <span>{formatUsd(high ?? book)}</span>
      </div>
      <div
        className="relative h-3 rounded-full bg-elevated"
        role="img"
        aria-label={`Ask ${formatUsd(ask)} against the price range ${formatUsd(low)} to ${formatUsd(high)}`}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-accent/30"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        {bookLeft != null && (
          <span
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-muted"
            style={{ left: `${bookLeft}%` }}
            title={`Book middle ${formatUsd(book)}`}
          />
        )}
        {askLeft != null && (
          <span
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[var(--shadow-border)]",
              tone,
              // Pinned at the edge because the ask sits outside what the desks
              // print. The ring says "further than the bar can show".
              askOutside && "ring-2 ring-bg",
            )}
            style={{ left: `${askLeft}%` }}
            title={
              askOutside
                ? `Ask ${formatUsd(ask)} — outside the price range`
                : `Ask ${formatUsd(ask)}`
            }
          />
        )}
      </div>
      {compact && hasAsk ? (
        <p className="text-xs text-muted">
          <span className="font-medium text-fg">{formatUsd(ask)}</span>
          <span className="text-subtle"> ask</span>
          {" · "}
          <span
            className={cn(
              vs.tone === "good"
                ? "text-deal-good"
                : vs.tone === "bad"
                  ? "text-deal-bad"
                  : "text-fg",
            )}
          >
            {vs.short}
          </span>
          {book != null && (
            <>
              {" · "}
              <span className="text-subtle">middle {formatUsd(book)}</span>
            </>
          )}
        </p>
      ) : !compact ? (
        <p className="text-xs text-subtle">
          {hasAsk
            ? `Dot is this listing’s all-in ask${askOutside ? ", pinned at the edge because it falls outside the price range" : ""}. Shaded band is the published price range. Tick is the middle price.`
            : "Shaded band is the spread across TCGPlayer, Cardmarket, sold comps, and any keys you added. Tick is the middle."}
        </p>
      ) : null}
    </div>
  );
}
