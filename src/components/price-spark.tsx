import { cn, formatUsd } from "@/lib/utils";
import type { PriceTick } from "@/lib/marketplaces/memory";

export function PriceSpark({ ticks }: { ticks: PriceTick[] }) {
  if (ticks.length < 2) return null;
  const prices = ticks.map((t) => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const width = 72;
  const height = 22;
  const path = ticks
    .map((tick, i) => {
      const x = (i / (ticks.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((tick.price - min) / span) * (height - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const first = prices[0]!;
  const last = prices[prices.length - 1]!;
  const delta = last - first;
  const down = delta < 0;
  return (
    <span className="inline-flex items-center gap-1.5" title="Ask history for this listing">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={cn(
          "h-5 w-[4.5rem]",
          down ? "text-deal-good" : delta > 0 ? "text-deal-bad" : "text-muted",
        )}
        aria-hidden
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {delta !== 0 && (
        <span className={cn("text-xs tabular-nums", down ? "text-deal-good" : "text-deal-bad")}>
          {down ? "−" : "+"}
          {formatUsd(Math.abs(delta))}
        </span>
      )}
    </span>
  );
}
