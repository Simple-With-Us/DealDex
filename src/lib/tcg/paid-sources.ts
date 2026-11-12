import type { DeskKeys } from "@/lib/settings/keys";
import { gradeMultiplier } from "./appraise";
import type { TcgCard } from "./types";
import type { ValuationQuote } from "./comps";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1_000_000) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0 && n < 1_000_000) return n;
  }
  return null;
}

function cents(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 500 ? n / 100 : n;
}

function walkMoney(obj: unknown, keys: string[], depth = 0): number | null {
  if (!obj || typeof obj !== "object" || depth > 4) return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const n = num(rec[k]);
    if (n != null) return n;
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      const n = walkMoney(v, keys, depth + 1);
      if (n != null) return n;
    }
  }
  return null;
}

export async function fetchJustTcg(card: TcgCard, key: string): Promise<ValuationQuote | null> {
  const q = encodeURIComponent(`${card.name} ${card.setName}`);
  const res = await fetch(`https://api.justtcg.com/v1/cards?game=pokemon&q=${q}&limit=5`, {
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  if (!res.ok)
    return {
      source: "justtcg",
      desk: "justtcg",
      label: "JustTCG",
      usd: null,
      note: `JustTCG ${res.status}`,
      family: "listed",
      weight: 0.16,
    };
  const json = (await res.json()) as { data?: unknown[] };
  const rows = Array.isArray(json.data)
    ? json.data
    : Array.isArray(json)
      ? (json as unknown[])
      : [];
  const usd = rows.length
    ? walkMoney(rows[0], ["marketPrice", "market", "price", "avgPrice", "nm"])
    : null;
  return {
    source: "justtcg",
    desk: "justtcg",
    label: "JustTCG market",
    usd,
    note: usd != null ? "JustTCG blended listed + shop sales" : "No JustTCG print matched",
    url: "https://justtcg.com",
    family: "listed",
    weight: 0.16,
  };
}

export async function fetchPriceChartingApi(
  card: TcgCard,
  token: string,
): Promise<ValuationQuote[]> {
  const q = encodeURIComponent(`${card.name} ${card.setName} pokemon`);
  const res = await fetch(
    `https://www.pricecharting.com/api/product?t=${encodeURIComponent(token)}&q=${q}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (!res.ok) {
    return [
      {
        source: "pricecharting-api",
        desk: "pricecharting",
        label: "PriceCharting API",
        usd: null,
        note: `PriceCharting ${res.status}`,
        family: "sold",
        weight: 0,
      },
    ];
  }
  const json = (await res.json()) as Record<string, unknown>;
  const product = (json.product ?? json) as Record<string, unknown>;
  const loose = cents(product["loose-price"] ?? product.loosePrice ?? product["ungraded-price"]);
  const psa9 = cents(product["cib-price"] ?? product["psa-9-price"] ?? product.manualOnlyPrice);
  const psa10 = cents(
    product["new-price"] ??
      product["psa-10-price"] ??
      product["bgs-10-price"] ??
      product["manual-only-price"],
  );
  const href =
    typeof product["product-url"] === "string"
      ? product["product-url"]
      : typeof json.url === "string"
        ? json.url
        : undefined;
  return [
    {
      source: "pricecharting-api",
      desk: "pricecharting",
      label: "PriceCharting API (ungraded)",
      usd: loose,
      note: "Official sold-comp API — replaces the public scrape when a token is set",
      url: href,
      family: "sold",
      weight: 0.16,
    },
    {
      source: "pricecharting-api-psa9",
      desk: "pricecharting",
      label: "PriceCharting API PSA 9",
      usd: psa9,
      // Graded slabs live on a different basis to the raw book. Weight is 0
      // today, but keep the raw-equivalent so giving them weight is safe.
      basisUsd: psa9 == null ? null : psa9 / (gradeMultiplier(card, "PSA 9") || 1),
      note: "Graded slab from the API",
      url: href,
      family: "sold",
      weight: 0,
    },
    {
      source: "pricecharting-api-psa10",
      desk: "pricecharting",
      label: "PriceCharting API PSA 10",
      usd: psa10,
      basisUsd: psa10 == null ? null : psa10 / (gradeMultiplier(card, "PSA 10") || 1),
      note: "Graded slab from the API",
      url: href,
      family: "sold",
      weight: 0,
    },
  ];
}

export async function fetchPokemonTcgIo(card: TcgCard, key: string): Promise<ValuationQuote[]> {
  const q = encodeURIComponent(`name:"${card.name}" set.name:"${card.setName}"`);
  const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=3`, {
    headers: { "X-Api-Key": key, Accept: "application/json" },
  });
  if (!res.ok) {
    return [
      {
        source: "pokemontcg",
        desk: "pokemontcg",
        label: "Pokémon TCG API",
        usd: null,
        note: `pokemontcg.io ${res.status}`,
        family: "listed",
        weight: 0,
      },
    ];
  }
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  const row = json.data?.[0];
  const tcg = row?.tcgplayer as
    { prices?: Record<string, { market?: number }>; url?: string } | undefined;
  const cm = row?.cardmarket as
    { prices?: { averageSellPrice?: number; trendPrice?: number }; url?: string } | undefined;
  const market =
    tcg?.prices?.holofoil?.market ??
    tcg?.prices?.normal?.market ??
    tcg?.prices?.reverseHolofoil?.market ??
    walkMoney(tcg?.prices, ["market"]);
  const cmUsd = cm?.prices?.averageSellPrice ?? cm?.prices?.trendPrice ?? null;
  return [
    {
      source: "pokemontcg",
      desk: "pokemontcg",
      label: "pokemontcg.io TCGPlayer",
      usd: market ?? null,
      note: "Second TCGPlayer snapshot via Pokémon TCG API / Scrydex",
      url: tcg?.url,
      family: "listed",
      weight: 0.1,
    },
    {
      source: "pokemontcg-cm",
      desk: "pokemontcg",
      label: "pokemontcg.io Cardmarket",
      usd: typeof cmUsd === "number" ? cmUsd : null,
      note: "Cardmarket average sell (already USD or EUR-close on this feed)",
      url: cm?.url,
      family: "sold",
      weight: 0.08,
    },
  ];
}

export async function fetchKeyedQuotes(card: TcgCard, keys: DeskKeys): Promise<ValuationQuote[]> {
  const jobs: Promise<ValuationQuote | ValuationQuote[] | null>[] = [];
  if (keys.justtcg) jobs.push(fetchJustTcg(card, keys.justtcg).catch(() => null));
  if (keys.pricecharting)
    jobs.push(fetchPriceChartingApi(card, keys.pricecharting).catch(() => []));
  if (keys.pokemontcg) jobs.push(fetchPokemonTcgIo(card, keys.pokemontcg).catch(() => []));
  const settled = await Promise.all(jobs);
  return settled.flatMap((row) => (row == null ? [] : Array.isArray(row) ? row : [row]));
}

export async function pingDeskKey(
  id: keyof DeskKeys,
  key: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (id === "justtcg") {
      const res = await fetch("https://api.justtcg.com/v1/games", {
        headers: { "x-api-key": key, Accept: "application/json" },
      });
      return res.ok
        ? { ok: true, message: "JustTCG accepted the key." }
        : { ok: false, message: `JustTCG returned ${res.status}. Check the key.` };
    }
    if (id === "pricecharting") {
      const res = await fetch(
        `https://www.pricecharting.com/api/product?t=${encodeURIComponent(key)}&q=pokemon`,
      );
      const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (res.ok && json.status !== "error")
        return { ok: true, message: "PriceCharting accepted the token." };
      return { ok: false, message: json.error || `PriceCharting returned ${res.status}.` };
    }
    const res = await fetch("https://api.pokemontcg.io/v2/cards?pageSize=1", {
      headers: { "X-Api-Key": key, Accept: "application/json" },
    });
    return res.ok
      ? { ok: true, message: "Pokémon TCG API accepted the key." }
      : { ok: false, message: `pokemontcg.io returned ${res.status}.` };
  } catch {
    return { ok: false, message: "Could not reach that price source." };
  }
}
