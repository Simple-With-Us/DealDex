import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Copy, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { scanMarketplaces } from "@/lib/server/scan";
import { mercariSearchPage } from "@/lib/marketplaces/mercari";
import type { ScanSource, ScoredListing } from "@/lib/marketplaces/types";
import { collectHits } from "@/lib/alerts/match";
import { dispatchHits } from "@/lib/alerts/notify";
import { loadRules, pushHits } from "@/lib/alerts/store";
import { loadDeskKeys } from "@/lib/settings/keys";
import { verdictCopy } from "@/lib/tcg/appraise";
import type { Verdict } from "@/lib/tcg/types";
import { cardImageUrl, cn, formatUsd } from "@/lib/utils";
import { PriceRangeBar } from "@/components/price-range";
import { MarketplaceLogo, MarketplaceToggle } from "@/components/market-logo";
import { PriceSpark } from "@/components/price-spark";
import { SellerBadge } from "@/components/seller-badge";
import {
  formatAge,
  loadScanCache,
  peekListing,
  rememberListings,
  saveScanCache,
} from "@/lib/marketplaces/memory";

type ViewFilter = "all" | "deals" | "verified";
type VerdictFilter = "any" | Verdict;
type PriceFilter = "any" | "25" | "50" | "100" | "250";
type ConditionFilter = "any" | "raw" | "graded";
type SpreadFilter = "any" | "10" | "20" | "40";
type FinishFilter = "any" | "holo" | "reverse" | "promo";
type SellerFilter = "any" | "top_rated" | "trusted" | "hide_risky";

/** A listing the desks say is under the book. */
function isDeal(row: ScoredListing) {
  return row.appraisal?.verdict === "steal" || row.appraisal?.verdict === "good";
}

/** A deal that more than one desk agrees on, with no conflict. */
function isVerifiedDeal(row: ScoredListing) {
  const a = row.appraisal;
  return (
    !!a &&
    (a.verdict === "steal" || a.verdict === "good") &&
    !a.conflict &&
    a.confidence !== "low" &&
    a.sourcesUsed >= 2
  );
}

function verdictVariant(v: Verdict) {
  if (v === "steal" || v === "good") return "good" as const;
  if (v === "fair") return "fair" as const;
  return "bad" as const;
}

export function Scanner() {
  const [q, setQ] = useState("");
  const [sources, setSources] = useState<ScanSource[]>(["ebay", "mercari"]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ScoredListing[] | null>(null);
  const [meta, setMeta] = useState({ ebay: 0, mercari: 0, notes: [] as string[] });
  const [view, setView] = useState<ViewFilter>("all");
  const [verdict, setVerdict] = useState<VerdictFilter>("any");
  const [priceCap, setPriceCap] = useState<PriceFilter>("any");
  const [condition, setCondition] = useState<ConditionFilter>("any");
  const [spreadMin, setSpreadMin] = useState<SpreadFilter>("any");
  const [finish, setFinish] = useState<FinishFilter>("any");
  const [sellerFilter, setSellerFilter] = useState<SellerFilter>("any");
  const [hideRepacks, setHideRepacks] = useState(true);
  const scanReqIdRef = useRef(0);

  async function run(query = q, src = sources) {
    const reqId = ++scanReqIdRef.current;
    const term = query.trim();
    setLoading(true);
    try {
      const res = await scanMarketplaces({
        data: { q: term, sources: src, keys: loadDeskKeys() },
      });
      if (reqId !== scanReqIdRef.current) return;
      setRows(res.rows);
      setMeta({ ebay: res.ebay, mercari: res.mercari, notes: res.notes });
      rememberListings(res.rows);
      saveScanCache({
        q: term,
        sources: src,
        at: new Date().toISOString(),
        rows: res.rows,
        meta: { ebay: res.ebay, mercari: res.mercari, notes: res.notes },
      });
      if (!res.rows.length) toast("No live listings right now. Try again in a minute.");
      const rules = loadRules();
      const hits = collectHits(res.rows, rules);
      if (hits.length) {
        pushHits(hits);
        void dispatchHits(hits, rules);
        toast(`${hits.length} alert${hits.length === 1 ? "" : "s"} matched this scan.`);
      }
    } catch (err) {
      if (reqId !== scanReqIdRef.current) return;
      toast(err instanceof Error ? err.message : "Scan failed");
    } finally {
      if (reqId === scanReqIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const cached = loadScanCache();
    if (cached) {
      setRows(cached.rows);
      setMeta(cached.meta);
      setQ(cached.q);
      if (cached.sources.length) setSources(cached.sources);
    }
    void run(cached?.q ?? "", cached?.sources ?? ["ebay", "mercari"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(src: ScanSource) {
    const next = sources.includes(src) ? sources.filter((s) => s !== src) : [...sources, src];
    if (!next.length) return;
    setSources(next);
    void run(q, next);
  }

  const visible = useMemo(() => {
    if (!rows) return [];
    return rows.filter((row) => {
      if (hideRepacks && row.appraisal?.isSuspiciousRepack) return false;
      // Quick View narrows the set; it does NOT replace the dropdowns. These
      // two branches used to `return` here, so picking "Deals" silently threw
      // away Max Ask, Condition, Min Discount and Finish while they still
      // showed their selected values.
      if (view === "deals" && !isDeal(row)) return false;
      if (view === "verified" && !isVerifiedDeal(row)) return false;
      if (verdict !== "any" && row.appraisal?.verdict !== verdict) return false;
      if (
        priceCap !== "any" &&
        (row.listing.price == null || row.listing.price > Number(priceCap))
      ) {
        return false;
      }
      if (condition === "raw" && row.parsed.grade !== "raw") return false;
      if (condition === "graded" && row.parsed.grade === "raw") return false;
      if (
        spreadMin !== "any" &&
        (row.appraisal?.spread == null || row.appraisal.spread < Number(spreadMin) / 100)
      ) {
        return false;
      }
      if (finish !== "any") {
        const blob = `${row.listing.title} ${row.parsed.finishHint ?? ""}`.toLowerCase();
        if (!blob.includes(finish)) return false;
      }
      if (sellerFilter === "top_rated" && row.listing.seller?.reputation !== "top_rated") {
        return false;
      }
      if (
        sellerFilter === "trusted" &&
        row.listing.seller?.reputation !== "top_rated" &&
        row.listing.seller?.reputation !== "trusted"
      ) {
        return false;
      }
      if (
        sellerFilter === "hide_risky" &&
        (row.listing.seller?.reputation === "new" || row.listing.seller?.reputation === "low_rated")
      ) {
        return false;
      }
      return true;
    });
  }, [rows, view, verdict, priceCap, condition, spreadMin, finish, sellerFilter, hideRepacks]);

  const dealCount = rows?.filter(isDeal).length ?? 0;
  const verifiedCount = rows?.filter(isVerifiedDeal).length ?? 0;
  const ebayCount = rows?.filter((r) => r.listing.marketplace === "ebay").length ?? meta.ebay;
  const mercariCount =
    rows?.filter((r) => r.listing.marketplace === "mercari").length ?? meta.mercari;

  return (
    <section className="min-w-0 space-y-4">
      <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <MarketplaceToggle
            marketplace="ebay"
            selected={sources.includes("ebay")}
            onClick={() => toggle("ebay")}
            count={ebayCount}
            className="w-full min-w-0 max-sm:gap-1 max-sm:px-2"
            size="lg"
          />
          <MarketplaceToggle
            marketplace="mercari"
            selected={sources.includes("mercari")}
            onClick={() => toggle("mercari")}
            count={mercariCount}
            className="w-full min-w-0 max-sm:gap-1 max-sm:px-2"
            size="lg"
          />
        </div>

        {/* Search Input & Prominent SCAN Action */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
          <div className="relative flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run();
              }}
              placeholder="Card name, set, number, or leave blank for whole market..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="dealdex-scan"
              inputMode="search"
              className="h-14 pl-4 pr-16 text-base rounded-xl bg-elevated/40 border-border/40 focus:bg-surface focus:border-border"
            />
            {q && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (loading) return;
                  setQ("");
                  void run("", sources);
                }}
                className={cn(
                  "absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-fg px-2 py-1 rounded-md bg-elevated transition-colors",
                  loading && "cursor-not-allowed opacity-50 pointer-events-none",
                )}
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className={cn(
              "inline-flex h-14 min-w-[170px] shrink-0 items-center justify-center gap-2.5 rounded-xl px-6 text-base font-bold tracking-wide bg-scan text-scan-fg transition-all shadow-md active:scale-[0.98] select-none cursor-pointer",
              loading ? "cursor-not-allowed opacity-80" : "hover:opacity-90 hover:shadow-lg",
            )}
          >
            {loading ? (
              <>
                <LoaderCircle className="size-5 animate-spin shrink-0" />
                <span>SCANNING...</span>
              </>
            ) : (
              <span>⚡ SCAN MARKET</span>
            )}
          </button>
        </div>

        {/* Scanning Live Indicator Banner */}
        {loading && (
          <div className="flex items-center gap-3 rounded-xl bg-elevated/70 px-4 py-2.5 text-xs text-fg animate-pulse border border-border/20">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-deal-good opacity-75"></span>
              <span className="relative inline-flex size-2.5 rounded-full bg-deal-good"></span>
            </span>
            <span className="font-medium">
              Scanning live {sources.map((s) => (s === "ebay" ? "eBay" : "Mercari")).join(" & ")}{" "}
              Buy It Now listings & scoring spreads...
            </span>
          </div>
        )}

        {/* Filters Grid */}
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7 items-end pt-1">
          <FilterSelect
            label="Verdict"
            value={verdict}
            onChange={setVerdict}
            options={[
              ["any", "Any Verdict"],
              ["steal", "Steal (High Spread)"],
              ["good", "Good Deal"],
              ["fair", "Fair Ask"],
              ["high", "High Ask"],
              ["avoid", "Overpriced"],
            ]}
          />
          <FilterSelect
            label="Seller"
            value={sellerFilter}
            onChange={setSellerFilter}
            options={[
              ["any", "Any Seller"],
              ["top_rated", "Top Rated Only"],
              ["trusted", "Trusted & Top"],
              ["hide_risky", "Hide Risky"],
            ]}
          />
          <FilterSelect
            label="Max Ask"
            value={priceCap}
            onChange={setPriceCap}
            options={[
              ["any", "Any Price"],
              ["25", "Under $25"],
              ["50", "Under $50"],
              ["100", "Under $100"],
              ["250", "Under $250"],
            ]}
          />
          <FilterSelect
            label="Condition"
            value={condition}
            onChange={setCondition}
            options={[
              ["any", "Raw or Graded"],
              ["raw", "Raw Singles Only"],
              ["graded", "Graded Slabs Only"],
            ]}
          />
          <FilterSelect
            label="Min Discount"
            value={spreadMin}
            onChange={setSpreadMin}
            options={[
              ["any", "Any vs Book"],
              ["10", "10%+ Under Book"],
              ["20", "20%+ Under Book"],
              ["40", "40%+ Under Book"],
            ]}
          />
          <FilterSelect
            label="Card Finish"
            value={finish}
            onChange={setFinish}
            options={[
              ["any", "Any Finish"],
              ["holo", "Holo"],
              ["reverse", "Reverse Holo"],
              ["promo", "Promo"],
            ]}
          />
          <label className="flex min-w-0 cursor-pointer select-none flex-col items-center justify-end">
            <span className="mb-1 block text-center text-xs uppercase tracking-[0.12em] text-subtle">
              Integrity
            </span>
            <span className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/40 bg-surface px-2 text-xs font-medium text-fg shadow-xs">
              <input
                type="checkbox"
                checked={hideRepacks}
                onChange={(e) => setHideRepacks(e.target.checked)}
                className="size-3.5 rounded text-accent"
              />
              <span className="truncate">Hide Proxies</span>
            </span>
          </label>
        </div>

        {/* Results Quick View Tabs */}
        {rows && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/20">
            <span className="text-xs font-medium text-muted mr-1">Quick View:</span>
            {(
              [
                ["all", `All (${rows.length})`],
                ["deals", `Deals (${dealCount})`],
                ["verified", `Verified Steals (${verifiedCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-medium tabular-nums transition-all select-none cursor-pointer",
                  view === key
                    ? "bg-fg text-surface shadow-xs"
                    : "bg-elevated/70 text-muted hover:bg-elevated hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !rows && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      )}

      {rows && (
        <>
          {meta.notes.length > 0 && <p className="text-xs text-subtle">{meta.notes.join(" ")}</p>}
          {!visible.length && (
            <div className="rounded-xl bg-surface p-6 text-sm text-muted shadow-[var(--shadow-border)]">
              {sources.length === 1 && sources[0] === "mercari"
                ? "No Mercari hits leaked through. Use Open Mercari search, then paste a title here."
                : "Nothing in this filter. Widen the sliders, or scan the whole market."}
              {sources.length === 1 && sources[0] === "mercari" && (
                <a
                  href={mercariSearchPage(q)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex h-11 items-center gap-1 text-sm text-fg"
                >
                  Open Mercari Search <ArrowUpRight className="size-4" />
                </a>
              )}
            </div>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
            {visible.map((row) => (
              <ScanRow key={`${row.listing.marketplace}-${row.listing.id}`} row={row} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 block text-center text-xs uppercase tracking-[0.12em] text-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="filter-select h-9 w-full rounded-md border border-border bg-surface px-2 text-center text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {options.map(([v, name]) => (
          <option key={v} value={v}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScanRow({ row }: { row: ScoredListing }) {
  const { listing, card, appraisal } = row;
  const copy = appraisal ? verdictCopy(appraisal.verdict) : null;
  // Marketplace thumbnails 404 often enough that we need a real fallback: the
  // card art first, then the marketplace mark. Without onError a dead URL just
  // painted the browser's broken-image glyph and the placeholder never ran.
  // Keyed on the URL, so a later scan that returns a working image recovers.
  // A plain boolean latched for the component's lifetime, and rows are keyed by
  // listing id, so one 404 pinned the row to the card art forever.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const cardArt = cardImageUrl(card?.image ?? null, "low");
  const thumb = listing.image && listing.image !== failedSrc ? listing.image : cardArt;
  const ask = listing.price != null ? listing.price + listing.shipping : listing.price;
  const memory = peekListing(listing.marketplace, listing.id);
  const listed = formatAge(listing.listedAt ?? memory?.listedAt);
  const seen = formatAge(memory?.firstSeen);
  const ageLabel = listed ? `Listed ${listed}` : seen ? `Seen ${seen}` : null;
  const confidence =
    appraisal && appraisal.sourcesUsed >= 2
      ? appraisal.conflict
        ? "Desks Differ"
        : `${appraisal.confidence[0]!.toUpperCase()}${appraisal.confidence.slice(1)} · ${appraisal.sourcesUsed} Desks`
      : null;
  return (
    <article className="flex min-w-0 gap-3 overflow-hidden rounded-lg bg-surface p-3 shadow-[var(--shadow-border)] sm:p-4">
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(listing.image ?? null)}
          className="h-[88px] w-16 shrink-0 rounded-sm bg-elevated object-cover"
        />
      ) : (
        <div className="grid h-[88px] w-16 shrink-0 place-items-center rounded-sm bg-elevated">
          <MarketplaceLogo marketplace={listing.marketplace === "ebay" ? "ebay" : "mercari"} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <MarketplaceLogo marketplace={listing.marketplace === "ebay" ? "ebay" : "mercari"} />
          {copy && appraisal && (
            <Badge variant={verdictVariant(appraisal.verdict)}>{copy.label}</Badge>
          )}
          {listing.seller && (
            <SellerBadge seller={listing.seller} />
          )}
          {appraisal?.isSuspiciousRepack && (
            <Badge variant="bad" title={appraisal.repackReason ?? undefined}>
              Repack / Proxy
            </Badge>
          )}
          {appraisal?.grading?.worthGrading && (
            <Badge
              variant="good"
              title={`PSA 10 Net Profit est: $${Math.round(appraisal.grading.psa10NetProfit ?? 0)}`}
            >
              Slab Upside
            </Badge>
          )}
          {confidence && (
            <Badge
              variant={
                appraisal?.conflict ? "bad" : appraisal?.confidence === "high" ? "good" : "fair"
              }
              title={appraisal?.conflictDetail ?? appraisal?.verifyNote ?? undefined}
            >
              {confidence}
            </Badge>
          )}
        </div>
        <a href={listing.url} target="_blank" rel="noreferrer" className="mt-1 block">
          <h3 className="line-clamp-2 text-sm font-medium">{listing.title}</h3>
        </a>
        <p className="truncate text-xs text-subtle">
          {card ? `${card.name} · ${card.setName} #${card.localId}` : "No card match yet"}
        </p>
        {(ageLabel || (memory && memory.prices.length > 1) || listing.seller?.username) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
            {ageLabel && <span>{ageLabel}</span>}
            {memory && <PriceSpark ticks={memory.prices} />}
            {listing.seller?.username && (
              <span className="truncate">Seller: {listing.seller.username}</span>
            )}
          </div>
        )}
        {appraisal?.conflict && appraisal.conflictDetail && (
          <p className="mt-1 text-xs text-deal-bad">{appraisal.conflictDetail}</p>
        )}
        {appraisal ? (
          <>
            <PriceRangeBar
              compact
              ask={ask ?? appraisal.allIn}
              book={appraisal.adjustedMarket}
              low={appraisal.rangeLow}
              high={appraisal.rangeHigh}
            />
            {listing.shippingEstimated && listing.shipping > 0 && (
              <p className="mt-0.5 text-xs text-subtle">
                Ask includes {formatUsd(listing.shipping)} assumed shipping — this listing did not
                quote one.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 font-mono text-sm tabular-nums">
            {formatUsd(listing.price)}
            <span className="text-xs text-subtle"> ask</span>
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          {card && (
            <Link
              to="/card/$cardId"
              params={{ cardId: card.id }}
              className="inline-flex h-8 items-center text-muted hover:text-fg"
            >
              Card Dossier
            </Link>
          )}
          {appraisal && (
            <button
              type="button"
              onClick={() => {
                const spreadPct =
                  appraisal.spread != null
                    ? `${appraisal.spread >= 0 ? "-" : "+"}${Math.abs(Math.round(appraisal.spread * 100))}%`
                    : "";
                const cName = card
                  ? `${card.name} (${card.setName} #${card.localId})`
                  : listing.title;
                const text = `🔥 DealDex: ${cName} · Ask: ${formatUsd(ask ?? appraisal.allIn)} · Book: ${formatUsd(appraisal.adjustedMarket)} (${spreadPct}) · Net Flip: ${formatUsd(appraisal.flipProfit)} · ${listing.url}`;
                void navigator.clipboard.writeText(text);
                toast("Deal link copied to clipboard!");
              }}
              className="inline-flex h-8 items-center gap-1 text-muted hover:text-fg"
            >
              <Copy className="size-3" /> Share
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
