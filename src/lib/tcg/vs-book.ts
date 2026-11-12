import { formatUsd } from "@/lib/utils";

export type VsTone = "good" | "fair" | "bad";

export type VsBook = {
  headline: string;
  detail: string;
  short: string;
  tone: VsTone;
};

/** Words for (ask − book) / book. Never emit a bare −133%. */
export function describeVsBook(
  ask: number | null | undefined,
  book: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined,
): VsBook {
  if (ask == null || !Number.isFinite(ask) || ask < 0) {
    return { headline: "No ask yet", detail: "Add a listing price to compare it.", short: "—", tone: "fair" };
  }
  if (book == null || !Number.isFinite(book) || book <= 0) {
    return {
      headline: "No price yet",
      detail: "No usable price range for this printing yet.",
      short: "no book",
      tone: "fair",
    };
  }

  const inside = low != null && high != null && high > low && ask >= low && ask <= high;
  const dollars = ask - book;
  const under = book - ask;

  if (inside && Math.abs(dollars) / book <= 0.08) {
    return {
      headline: "Ask sits in the middle of the range",
      detail: `${formatUsd(ask)} is inside ${formatUsd(low)}–${formatUsd(high)}.`,
      short: "in the book",
      tone: "fair",
    };
  }
  if (inside && ask < book) {
    const pct = Math.round((under / book) * 100);
    return {
      headline: `${pct}% under the middle, still inside the range`,
      detail: `${formatUsd(ask)} ask vs ${formatUsd(low)}–${formatUsd(high)} across price sources.`,
      short: `${pct}% under`,
      tone: "fair",
    };
  }
  if (inside && ask > book) {
    const pct = Math.round((dollars / book) * 100);
    return {
      headline: `${pct}% over the middle, still inside the range`,
      detail: `${formatUsd(ask)} ask vs ${formatUsd(low)}–${formatUsd(high)} across price sources.`,
      short: `${pct}% over`,
      tone: "fair",
    };
  }

  if (ask < book) {
    const pct = Math.round((under / book) * 100);
    return {
      headline: `${pct}% under the book`,
      detail: `Pay ${formatUsd(ask)} vs a ${formatUsd(book)} middle — ${formatUsd(under)} cheaper.`,
      short: `${pct}% under`,
      tone: pct >= 12 ? "good" : "fair",
    };
  }

  const times = ask / book;
  if (times >= 1.8) {
    return {
      headline: `Ask is ${times.toFixed(1)}× the book`,
      detail: `${formatUsd(ask)} vs a ${formatUsd(book)} middle — ${formatUsd(dollars)} over.`,
      short: `${times.toFixed(1)}× book`,
      tone: "bad",
    };
  }
  const pct = Math.round((dollars / book) * 100);
  return {
    headline: `${pct}% over the book`,
    detail: `${formatUsd(ask)} vs a ${formatUsd(book)} middle — ${formatUsd(dollars)} over.`,
    short: `${pct}% over`,
    tone: pct >= 8 ? "bad" : "fair",
  };
}

/** When we only stored the old (book − ask) / book ratio. */
export function labelSpread(spread: number | null | undefined): string {
  if (spread == null || Number.isNaN(spread)) return "—";
  if (Math.abs(spread) < 0.04) return "in the book";
  if (spread > 0) return `${Math.round(spread * 100)}% under`;
  const times = 1 - spread;
  if (times >= 1.8) return `${times.toFixed(1)}× book`;
  return `${Math.round(-spread * 100)}% over`;
}
