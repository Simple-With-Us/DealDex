import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Radar, Settings } from "lucide-react";
import { scanMarketplaces } from "@/lib/server/scan";
import type { ScoredListing } from "@/lib/marketplaces/types";
import { cn, formatUsd } from "@/lib/utils";
import { labelSpread } from "@/lib/tcg/vs-book";
import { MarketplaceLogo, MarketplaceToggle } from "@/components/market-logo";
import { APP_SUBTITLE } from "@/lib/copy";

type Platform = "android" | "ios";

export function NativePhones() {
  const [platform, setPlatform] = useState<Platform>("android");
  const [tab, setTab] = useState<"scan" | "alerts" | "settings">("scan");
  const [rows, setRows] = useState<ScoredListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void scanMarketplaces({ data: { q: "", sources: ["ebay", "mercari"] } })
      .then((res) => {
        if (live) setRows(res.rows);
      })
      .catch(() => {
        if (live) setRows([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPlatform("android")}
          className={cn(
            "h-11 rounded-md px-4 text-sm",
            platform === "android" ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
          )}
        >
          Android
        </button>
        <button
          type="button"
          onClick={() => setPlatform("ios")}
          className={cn(
            "h-11 rounded-md px-4 text-sm",
            platform === "ios" ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
          )}
        >
          iPhone
        </button>
      </div>
      <div className="flex justify-center sm:justify-start">
        <PhoneChrome platform={platform}>
          {tab === "scan" ? (
            <ScanPane platform={platform} rows={rows} loading={loading} />
          ) : tab === "alerts" ? (
            <AlertsPane platform={platform} />
          ) : (
            <SettingsPane platform={platform} />
          )}
          <nav
            className={cn(
              "mt-auto grid grid-cols-3 border-t border-border bg-surface",
              platform === "ios" ? "rounded-b-xl" : "rounded-b-lg",
            )}
          >
            <TabBtn
              active={tab === "scan"}
              onClick={() => setTab("scan")}
              icon={<Radar className="size-4" />}
              label="Scan"
            />
            <TabBtn
              active={tab === "alerts"}
              onClick={() => setTab("alerts")}
              icon={<Bell className="size-4" />}
              label="Alerts"
            />
            <TabBtn
              active={tab === "settings"}
              onClick={() => setTab("settings")}
              icon={<Settings className="size-4" />}
              label="Settings"
            />
          </nav>
        </PhoneChrome>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-0.5 text-xs",
        active ? "text-accent" : "text-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PhoneChrome({ platform, children }: { platform: Platform; children: ReactNode }) {
  const ios = platform === "ios";
  return (
    <div
      className={cn(
        "w-full max-w-xs shrink-0 bg-fg p-2 shadow-[var(--shadow-border)]",
        ios ? "rounded-xl" : "rounded-lg",
      )}
    >
      <div
        className={cn(
          "flex h-[34rem] flex-col overflow-hidden bg-bg",
          ios ? "rounded-lg" : "rounded-md",
        )}
      >
        <div className="flex h-8 items-center justify-between px-4 text-xs text-muted">
          <span>9:41</span>
          {ios ? <span className="h-4 w-20 rounded-full bg-fg/80" /> : <span className="font-mono">DealDex</span>}
          <span>{ios ? "5G" : "LTE"}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ScanPane({
  platform,
  rows,
  loading,
}: {
  platform: Platform;
  rows: ScoredListing[];
  loading: boolean;
}) {
  const deals = useMemo(
    () => rows.filter((r) => r.appraisal?.verdict === "steal" || r.appraisal?.verdict === "good"),
    [rows],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-2">
      <p className="text-xs leading-snug text-muted">{APP_SUBTITLE}</p>
      <p className="mt-1 text-xs text-muted">Scans eBay and Mercari on this phone.</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {(["ebay", "mercari"] as const).map((m) => (
          <MarketplaceToggle
            key={m}
            marketplace={m}
            selected
            onClick={() => {}}
            count={rows.filter((r) => r.listing.marketplace === m).length}
            size="lg"
            className="pointer-events-none h-10 rounded-lg px-2"
          />
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {(["All", "Deals"] as const).map((label, i) => (
          <span
            key={label}
            className={cn(
              "shrink-0 px-2.5 py-1 text-xs",
              platform === "ios" ? "rounded-full" : "rounded-sm",
              i === 0 ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
            )}
          >
            {label}
            {label === "Deals" ? ` ${deals.length}` : ` ${rows.length}`}
          </span>
        ))}
      </div>
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {loading && <p className="py-8 text-center text-xs text-muted">Reading eBay and Mercari…</p>}
        {!loading &&
          rows.slice(0, 8).map((row) => {
            const v = row.appraisal?.verdict;
            const tone =
              v === "steal" || v === "good"
                ? "text-deal-good"
                : v === "high" || v === "avoid"
                  ? "text-deal-bad"
                  : "text-deal-fair";
            return (
              <article
                key={row.listing.marketplace + row.listing.id}
                className={cn(
                  "bg-surface p-2.5 shadow-[var(--shadow-border)]",
                  platform === "ios" ? "rounded-xl" : "rounded-md",
                )}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-subtle flex-wrap">
                  <MarketplaceLogo
                    marketplace={row.listing.marketplace === "ebay" ? "ebay" : "mercari"}
                  />
                  {v && <span className={tone}>{v}</span>}
                  {row.listing.seller?.label && (
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.2 rounded-sm lowercase tracking-normal",
                        row.listing.seller.reputation === "top_rated" ||
                          row.listing.seller.reputation === "trusted"
                          ? "bg-deal-good/15 text-deal-good"
                          : row.listing.seller.reputation === "new"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : row.listing.seller.reputation === "low_rated"
                              ? "bg-deal-bad/15 text-deal-bad"
                              : "text-subtle",
                      )}
                    >
                      {row.listing.seller.label}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug">{row.listing.title}</p>
                {row.card && (
                  <p className="mt-0.5 text-xs text-muted">
                    {row.card.name} · {row.card.setName} #{row.card.localId}
                  </p>
                )}
                <p className="mt-1 font-mono text-xs">
                  {formatUsd((row.listing.price ?? 0) + row.listing.shipping)} ask
                  <span className="mx-1.5 text-subtle">·</span>
                  {formatUsd(row.appraisal?.adjustedMarket)} book
                  <span className={cn("ml-1.5", tone)}>{labelSpread(row.appraisal?.spread)}</span>
                </p>
              </article>
            );
          })}
      </div>
    </div>
  );
}

function SettingsPane({ platform }: { platform: Platform }) {
  const box = platform === "ios" ? "rounded-xl" : "rounded-md";
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-2">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Settings</p>
      <h2 className="font-display text-xl tracking-tight">This Phone</h2>
      <p className="mt-1 text-xs text-muted">Sign in to back up keys. Keys stay on the device.</p>
      <div className={cn("mt-3 space-y-2 bg-surface p-3 text-xs shadow-[var(--shadow-border)]", box)}>
        {/*
          Email and password sign-in is gone from both apps — the endpoint it
          used answers 410. A marketing mock that still shows it advertises a
          screen the download does not have.
        */}
        <p className="text-xs uppercase tracking-[0.12em] text-subtle">Account</p>
        {["Continue with Google", "Continue with Apple", "Continue with X"].map((label) => (
          <span
            key={label}
            className="block rounded-sm bg-elevated px-2 py-1.5 text-center text-muted"
          >
            {label}
          </span>
        ))}
      </div>
      <div className={cn("mt-3 space-y-2 bg-surface p-3 text-xs shadow-[var(--shadow-border)]", box)}>
        <p className="text-xs uppercase tracking-[0.12em] text-subtle">API Desks</p>
        <p>
          JustTCG
          <span className="mt-1 block rounded-sm bg-elevated px-2 py-1.5 text-muted">tcg_…</span>
        </p>
        <p>
          PriceCharting
          <span className="mt-1 block rounded-sm bg-elevated px-2 py-1.5 text-muted">pc_…</span>
        </p>
        <p>
          Pokémon TCG API
          <span className="mt-1 block rounded-sm bg-elevated px-2 py-1.5 text-muted">optional</span>
        </p>
        <span className="inline-flex h-8 items-center rounded-full bg-accent px-3 text-xs text-accent-fg">
          Save on This Phone
        </span>
      </div>
    </div>
  );
}

function AlertsPane({ platform }: { platform: Platform }) {
  return (
    <div className="flex-1 px-3">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Alerts</p>
      <h2 className="font-display text-xl tracking-tight">Native deal pings</h2>
      <p className="mt-2 text-xs text-muted">Pings on this phone after each scan.</p>
      <div
        className={cn(
          "mt-4 space-y-3 bg-surface p-3 text-xs shadow-[var(--shadow-border)]",
          platform === "ios" ? "rounded-xl" : "rounded-md",
        )}
      >
        <p>
          Name
          <span className="mt-1 block text-muted">Steals under $100</span>
        </p>
        <p>
          Keyword
          <span className="mt-1 block text-muted">All Pokémon</span>
        </p>
        <p>
          Min spread
          <span className="mt-1 block text-muted">12%</span>
        </p>
      </div>
    </div>
  );
}
