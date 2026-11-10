import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  LoaderCircle,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { searchMarket, getValuationBook } from "@/lib/server/tcg";
import type { ValuationBook } from "@/lib/tcg/comps";
import { applyVerification } from "@/lib/tcg/verify";
import { loadDeskKeys } from "@/lib/settings/keys";
import { saveAppraisal } from "@/lib/server/saved";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  appraise,
  ebaySoldUrl,
  mercariSearchUrl,
  tcgplayerUrl,
  verdictCopy,
} from "@/lib/tcg/appraise";
import { parseListingBlob, SAMPLE_LISTINGS } from "@/lib/tcg/parse-listing";
import type { Condition, Grade, ListingInput, Marketplace, TcgCard, Verdict } from "@/lib/tcg/types";
import { CONDITIONS, GRADES } from "@/lib/tcg/types";
import { cardImageUrl, cn, formatUsd } from "@/lib/utils";
import { PriceRangeBar } from "@/components/price-range";
import { MarketplaceLogo } from "@/components/market-logo";
import { describeVsBook } from "@/lib/tcg/vs-book";

const LOCAL_KEY = "dealdex:saved";
const LEGACY_KEYS = ["spreaddex:saved", "trueask:saved"];

function verdictVariant(v: Verdict) {
  if (v === "steal" || v === "good") return "good" as const;
  if (v === "fair") return "fair" as const;
  return "bad" as const;
}

function persistLocal(row: Record<string, unknown>) {
  try {
    let raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      for (const legacy of LEGACY_KEYS) {
        const v = localStorage.getItem(legacy);
        if (v) {
          raw = v;
          localStorage.setItem(LOCAL_KEY, v);
          localStorage.removeItem(legacy);
          break;
        }
      }
    }
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    localStorage.setItem(LOCAL_KEY, JSON.stringify([row, ...list].slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function Evaluator({
  initialQuery,
  initialCardId,
}: {
  initialQuery?: string;
  initialCardId?: string;
}) {
  const { user } = useCurrentUserState();
  const [blob, setBlob] = useState(initialQuery ?? "");
  const [price, setPrice] = useState("");
  const [shipping, setShipping] = useState("4.50");
  const [marketplace, setMarketplace] = useState<Marketplace>("ebay");
  const [condition, setCondition] = useState<Condition>("NM");
  const [grade, setGrade] = useState<Grade>("raw");
  const [finish, setFinish] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialCardId ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [book, setBook] = useState<ValuationBook | null>(null);

  const parsedPreview = useMemo(() => parseListingBlob(blob), [blob]);
  const active = cards.find((c) => c.id === activeId) ?? cards[0] ?? null;
  const activeKey = active?.id ?? null;
  const [prevActiveKey, setPrevActiveKey] = useState<string | null>(activeKey);
  if (prevActiveKey !== activeKey) {
    setPrevActiveKey(activeKey);
    setBook(null);
    if (active?.finishes.length) {
      const preferred = active.finishes.find((f) => f.key === finish) ?? active.finishes[0];
      if (preferred && preferred.key !== finish) setFinish(preferred.key);
    }
  }

  useEffect(() => {
    if (initialQuery) void runSearch(initialQuery);
    // mount-only hydrate from a card dossier
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listing: ListingInput | null = useMemo(() => {
    const n = Number(price);
    if (!active || !Number.isFinite(n) || n < 0) return null;
    return {
      title: parsedPreview.title || blob,
      url: parsedPreview.url,
      marketplace,
      price: n,
      shipping: Number(shipping) || 0,
      condition,
      grade,
      finish,
    };
  }, [active, blob, condition, finish, grade, marketplace, parsedPreview, price, shipping]);

  const raw = active && listing ? appraise(active, listing) : null;
  const result = raw && active ? applyVerification(raw, active, { book }) : raw;

  useEffect(() => {
    if (!active?.id) return;
    let live = true;
    getValuationBook({ data: { id: active.id, grade, keys: loadDeskKeys() } })
      .then((row) => {
        if (live) setBook(row);
      })
      .catch(() => {
        if (live) setBook(null);
      });
    return () => {
      live = false;
    };
  }, [active?.id, grade]);

  async function runSearch(source = blob) {
    const q = source.trim();
    if (!q) {
      toast("Paste a listing or a card name first.");
      return;
    }
    setLoading(true);
    setSaved(false);
    try {
      const res = await searchMarket({ data: { q } });
      const found = res.cards ?? [];
      setCards(found);
      setActiveId(res.parsed && found[0] ? found[0].id : null);
      const nextPrice = res.parsed.price;
      if (nextPrice != null) setPrice(String(nextPrice));
      if (res.parsed.shipping != null) setShipping(String(res.parsed.shipping));
      setMarketplace(res.parsed.marketplace);
      setCondition(res.parsed.condition);
      setGrade(res.parsed.grade);
      if (res.parsed.finishHint) setFinish(res.parsed.finishHint);
      if (!found.length) toast("No matching Pokémon cards. Try a name + set, like “Charizard 151”.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function applySample(blobText: string) {
    setBlob(blobText);
    const p = parseListingBlob(blobText);
    if (p.price != null) setPrice(String(p.price));
    if (p.shipping != null) setShipping(String(p.shipping));
    setMarketplace(p.marketplace);
    setCondition(p.condition);
    setGrade(p.grade);
    void runSearch(blobText);
  }

  async function onSave() {
    if (!active || !listing || !result) return;
    setSaving(true);
    const row = {
      id: crypto.randomUUID(),
      marketplace: listing.marketplace,
      listingTitle: listing.title || active.name,
      listingUrl: listing.url,
      listingPrice: listing.price,
      shipping: listing.shipping,
      condition: listing.condition,
      grade: listing.grade,
      finish: result.finish?.key ?? null,
      cardId: active.id,
      cardName: active.name,
      setName: active.setName,
      marketPrice: result.adjustedMarket,
      allIn: result.allIn,
      spread: result.spread,
      verdict: result.verdict,
    };
    persistLocal({ ...row, createdAt: new Date().toISOString() });
    if (user) {
      try {
        await saveAppraisal({ data: row });
      } catch {
        toast("Saved on this device. Sign in again to sync.");
      }
    }
    setSaved(true);
    setSaving(false);
    toast(user ? "Saved to your ledger." : "Saved on this device. Sign in to keep it across sessions.");
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
        <div className="mb-4 flex flex-col gap-1">
          <Label htmlFor="listing">Listing or card</Label>
          <p className="text-xs text-subtle">
            Paste an eBay / Mercari title (and URL if you have it), or just search a card.
            Marketplaces block automated page reads, so the title and ask are what we match.
          </p>
        </div>
        <textarea
          id="listing"
          value={blob}
          onChange={(e) => setBlob(e.target.value)}
          rows={3}
          placeholder="e.g. eBay Charizard Base Set Holofoil 4/102 NM $620"
          className="w-full resize-y rounded-md border border-border bg-elevated px-3 py-3 text-sm text-fg placeholder:text-subtle outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Ask price">
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="Shipping">
            <Input
              inputMode="decimal"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </Field>
          <Field label="Marketplace">
            <div className="flex h-11 items-center gap-1 rounded-md border border-border bg-elevated px-1">
              {(["ebay", "mercari"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarketplace(m)}
                  aria-label={m === "ebay" ? "eBay" : "Mercari"}
                  aria-pressed={marketplace === m}
                  className={cn(
                    "grid h-9 flex-1 place-items-center overflow-hidden rounded-sm transition-[background-color,opacity] duration-150",
                    marketplace === m ? "bg-surface shadow-[var(--shadow-border)]" : "opacity-60 hover:opacity-100",
                  )}
                >
                  <MarketplaceLogo marketplace={m} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMarketplace("other")}
                aria-pressed={marketplace === "other"}
                className={cn(
                  "h-9 flex-1 rounded-sm text-xs transition-[background-color,color] duration-150",
                  marketplace === "other" ? "bg-surface text-fg shadow-[var(--shadow-border)]" : "text-muted",
                )}
              >
                Other
              </button>
            </div>
          </Field>
          <Field label="Condition">
            <Select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grade">
            <Select value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g === "raw" ? "Raw" : g}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => void runSearch()} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
              Appraise
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SAMPLE_LISTINGS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => applySample(s.blob)}
              className="h-9 rounded-full border border-border px-3 text-xs text-muted transition-[background-color,color] duration-150 hover:bg-elevated hover:text-fg"
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Skeleton className="aspect-[63/88] w-full max-w-[220px]" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      )}

      {!loading && active && (
        <AppraisalPanel
          card={active}
          cards={cards}
          result={result}
          listing={listing}
          finish={finish}
          onFinish={setFinish}
          onPick={setActiveId}
          onSave={() => void onSave()}
          saving={saving}
          saved={saved}
          needsPrice={!listing}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AppraisalPanel({
  card,
  cards,
  result,
  listing,
  finish,
  onFinish,
  onPick,
  onSave,
  saving,
  saved,
  needsPrice,
}: {
  card: TcgCard;
  cards: TcgCard[];
  result: ReturnType<typeof appraise> | null;
  listing: ListingInput | null;
  finish: string | null;
  onFinish: (v: string) => void;
  onPick: (id: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  needsPrice: boolean;
}) {
  const copy = result ? verdictCopy(result.verdict) : null;
  const img = cardImageUrl(card.image);
  const fallbackFinish = card.finishes.find((f) => f.key === finish) ?? card.finishes[0] ?? null;
  const usedFinish = result?.finish ?? fallbackFinish;

  function shareDeal() {
    if (!result || !listing) return;
    const spreadPct =
      result.spread != null
        ? `${result.spread >= 0 ? "-" : "+"}${Math.abs(Math.round(result.spread * 100))}%`
        : "";
    const text = `🔥 DealDex Appraisal: ${card.name} (${card.setName} #${card.localId}) · Ask: ${formatUsd(result.allIn)} · Book: ${formatUsd(result.adjustedMarket)} (${spreadPct} vs Book) · Verdict: ${copy?.label ?? "Fair"} · Net Flip: ${formatUsd(result.flipProfit)} · https://dealdex.net/card/${card.id}`;
    void navigator.clipboard.writeText(text);
    toast("Deal card copied to clipboard!");
  }

  return (
    <section className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        <div className="mx-auto w-full max-w-[220px]">
          {img ? (
            <img
              src={img}
              alt={card.name}
              className="aspect-[600/825] w-full rounded-lg bg-elevated object-cover"
            />
          ) : (
            <div className="grid aspect-[600/825] place-items-center rounded-lg bg-elevated text-sm text-subtle">
              No scan
            </div>
          )}
        </div>
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-subtle">{card.setName}</p>
              <h2 className="font-display text-3xl tracking-tight sm:text-4xl">{card.name}</h2>
              <p className="mt-1 text-sm text-muted">
                #{card.localId}
                {card.rarity ? ` · ${card.rarity}` : ""}
                {card.illustrator ? ` · ${card.illustrator}` : ""}
              </p>
            </div>
            {copy && result && (
              <Badge variant={verdictVariant(result.verdict)} className="text-sm">
                {copy.label}
              </Badge>
            )}
          </div>

          {result?.isSuspiciousRepack && (
            <div className="flex items-center gap-2.5 rounded-lg border border-deal-bad/30 bg-deal-bad/10 p-3 text-sm text-deal-bad">
              <ShieldAlert className="size-5 shrink-0" />
              <span>
                <strong>Listing Warning:</strong> {result.repackReason ?? "Potential proxy, repack lot, or non-card listing."}
              </span>
            </div>
          )}

          {needsPrice && (
            <p className="rounded-md bg-elevated px-3 py-2 text-sm text-muted">
              Card matched. Enter the listing ask to score the deal.
            </p>
          )}

          {result && listing && copy && (
            <>
              <PriceRangeBar
                ask={result.allIn}
                book={result.adjustedMarket}
                low={result.rangeLow}
                high={result.rangeHigh}
              />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Desk range"
                  value={
                    result.rangeLow != null && result.rangeHigh != null
                      ? `${formatUsd(result.rangeLow, 0)}–${formatUsd(result.rangeHigh, 0)}`
                      : formatUsd(result.adjustedMarket)
                  }
                  hint={`${result.sourcesUsed} desk${result.sourcesUsed === 1 ? "" : "s"}`}
                />
                <Stat
                  label="Book middle"
                  value={formatUsd(result.adjustedMarket)}
                  hint={listing.grade === "raw" ? listing.condition : `${listing.grade} estimate`}
                />
                <Stat label="This ask, all-in" value={formatUsd(result.allIn)} hint={`${formatUsd(listing.price)} + ship`} />
                <Stat
                  label="Vs the book"
                  value={describeVsBook(result.allIn, result.adjustedMarket, result.rangeLow, result.rangeHigh).short}
                  hint={
                    result.dollarsOff == null
                      ? undefined
                      : result.dollarsOff >= 0
                        ? `${formatUsd(result.dollarsOff)} cheaper than the middle`
                        : `${formatUsd(-result.dollarsOff)} more than the middle`
                  }
                  tone={result.verdict}
                />
              </div>

              <p className="text-sm text-muted">{copy.blurb}</p>
              {result.verifyNote && (
                <p className="text-sm text-muted">
                  <span className="text-fg">
                    {result.confidence} confidence · {result.sourcesUsed} desks
                    {result.conflict ? " · Desks Differ" : ""}.
                  </span>{" "}
                  {result.verifyNote}
                </p>
              )}

              {listing.grade !== "raw" && (
                <p className="text-xs text-subtle">
                  Graded value is an estimate ({result.gradeMult}× raw NM book). Check sold slabs
                  before you buy a PSA / BGS / CGC / ACE copy.
                </p>
              )}

              <div className="grid gap-3 rounded-lg bg-elevated p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-subtle">
                    If you flip after ~{Math.round(result.sellFeeRate * 1000) / 10}% fees
                    {result.netMarginRate != null ? ` (${Math.round(result.netMarginRate * 100)}% margin)` : ""}
                  </p>
                  <p className="font-mono text-lg tabular-nums">
                    {formatUsd(result.flipProfit)}{" "}
                    <span className="text-sm text-muted">net vs this ask</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-subtle">TCGPlayer listed band (one desk)</p>
                  <p className="font-mono text-sm tabular-nums text-muted">
                    Low {formatUsd(result.finish?.low)} · Mid {formatUsd(result.finish?.mid)} · High{" "}
                    {formatUsd(result.finish?.high)}
                  </p>
                  {card.cardmarketEur != null && (
                    <p className="mt-1 text-xs text-subtle">
                      Cardmarket trend €{card.cardmarketEur.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {result.grading && (
                <div className="rounded-lg border border-border bg-elevated/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-fg">
                      <Sparkles className="size-3.5 text-accent" /> PSA Grading Arbitrage (Raw → Slab)
                    </p>
                    {result.grading.worthGrading && (
                      <Badge variant="good" className="text-xs">
                        High Slab Upside
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-subtle">PSA 10 Book Est.</p>
                      <p className="font-mono text-sm font-medium tabular-nums">{formatUsd(result.grading.psa10Value)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">Grading + Ship</p>
                      <p className="font-mono text-sm tabular-nums text-muted">{formatUsd(result.grading.gradingCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">PSA 10 Net Profit</p>
                      <p
                        className={cn(
                          "font-mono text-sm font-medium tabular-nums",
                          (result.grading.psa10NetProfit ?? 0) > 0 ? "text-deal-good" : "text-muted",
                        )}
                      >
                        {formatUsd(result.grading.psa10NetProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">PSA 10 Target ROI</p>
                      <p className="font-mono text-sm tabular-nums text-fg">
                        {result.grading.psa10Roi != null ? `${Math.round(result.grading.psa10Roi * 100)}%` : "—"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-subtle">
                    Considers a ~${result.grading.gradingCost.toFixed(0)} grading & shipping fee. PSA 9 net upside is{" "}
                    {formatUsd(result.grading.psa9NetProfit)}.
                  </p>
                </div>
              )}
            </>
          )}

          {!result && (
            <div className="rounded-lg bg-elevated p-4">
              <p className="text-xs text-subtle">TCGPlayer market</p>
              <p className="font-mono text-2xl tabular-nums">{formatUsd(usedFinish?.market)}</p>
              <p className="font-mono text-sm tabular-nums text-muted">
                Low {formatUsd(usedFinish?.low)} · Mid {formatUsd(usedFinish?.mid)} · High{" "}
                {formatUsd(usedFinish?.high)}
              </p>
            </div>
          )}

          {card.finishes.length > 1 && (
            <div className="space-y-1.5">
              <Label>Finish</Label>
              <div className="flex flex-wrap gap-2">
                {card.finishes.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => onFinish(f.key)}
                    className={cn(
                      "h-9 rounded-full border px-3 text-xs transition-colors duration-150",
                      finish === f.key
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {f.label} {f.market != null ? formatUsd(f.market) : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={tcgplayerUrl(card, usedFinish)} target="_blank" rel="noreferrer">
                TCGPlayer <ArrowUpRight />
              </a>
            </Button>
            <Button variant="secondary" asChild className="[&_svg]:h-3.5 [&_svg]:w-auto [&_svg]:size-auto">
              <a href={ebaySoldUrl(card, listing?.grade ?? "raw")} target="_blank" rel="noreferrer">
                <MarketplaceLogo marketplace="ebay" />
                sold
              </a>
            </Button>
            <Button variant="secondary" asChild className="[&_svg]:h-3.5 [&_svg]:w-auto [&_svg]:size-auto">
              <a href={mercariSearchUrl(card, listing?.grade ?? "raw")} target="_blank" rel="noreferrer">
                <MarketplaceLogo marketplace="mercari" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/card/$cardId" params={{ cardId: card.id }}>
                Card Dossier
              </Link>
            </Button>
            {listing && result && (
              <Button variant="outline" onClick={shareDeal}>
                <Share2 /> Share Deal
              </Button>
            )}
            {listing && result && (
              <Button variant="ghost" onClick={onSave} disabled={saving || saved}>
                {saved ? <BookmarkCheck /> : <Bookmark />}
                {saved ? "Saved" : "Save"}
              </Button>
            )}
          </div>
        </div>
      </div>


      {cards.length > 1 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted">Other matches</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((c) => {
              const thumb = cardImageUrl(c.image, "low");
              const market = c.finishes.find((f) => f.market != null)?.market;
              const on = c.id === card.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onPick(c.id)}
                  className={cn(
                    "flex gap-3 rounded-lg p-2 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]",
                    on && "bg-elevated",
                  )}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="h-[66px] w-12 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <div className="h-[66px] w-12 shrink-0 rounded-sm bg-elevated" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{c.name}</span>
                    <span className="block truncate text-xs text-subtle">{c.setName}</span>
                    <span className="block font-mono text-xs tabular-nums text-muted">
                      {formatUsd(market)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Verdict;
}) {
  return (
    <div className="rounded-lg bg-elevated p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-xl tabular-nums",
          tone === "steal" || tone === "good"
            ? "text-deal-good"
            : tone === "high" || tone === "avoid"
              ? "text-deal-bad"
              : "",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  );
}
