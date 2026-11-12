export type DeskKeyId = "justtcg" | "pricecharting" | "pokemontcg";

export type DeskKeys = Partial<Record<DeskKeyId, string>>;

export const DESK_KEY_META: {
  id: DeskKeyId;
  label: string;
  blurb: string;
  href: string;
  hrefLabel: string;
  placeholder: string;
}[] = [
  {
    id: "justtcg",
    label: "JustTCG",
    blurb:
      "Listed and in-store Pokémon prices for each printing. A free key is available at justtcg.com.",
    href: "https://justtcg.com/dashboard",
    hrefLabel: "Get a JustTCG key",
    placeholder: "tcg_…",
  },
  {
    id: "pricecharting",
    label: "PriceCharting",
    blurb:
      "Sold prices for raw cards, PSA 9, and PSA 10. Use the token from your PriceCharting subscription.",
    href: "https://www.pricecharting.com/api-documentation",
    hrefLabel: "Get a PriceCharting token",
    placeholder: "40-character token",
  },
  {
    id: "pokemontcg",
    label: "Pokémon TCG API",
    blurb: "pokemontcg.io. A key lets DealDex load TCGPlayer and Cardmarket prices more often.",
    href: "https://dev.pokemontcg.io",
    hrefLabel: "Get a Pokémon TCG API key",
    placeholder: "X-Api-Key",
  },
];

const STORAGE = "dealdex:desk-keys";
const LEGACY = "spreaddex:desk-keys";

export function loadDeskKeys(): DeskKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE) ?? localStorage.getItem(LEGACY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DeskKeys;
    const out: DeskKeys = {};
    for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
      const v = parsed[id]?.trim();
      if (v) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDeskKeys(keys: DeskKeys) {
  const clean: DeskKeys = {};
  for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
    const v = keys[id]?.trim();
    if (v) clean[id] = v;
  }
  localStorage.setItem(STORAGE, JSON.stringify(clean));
}

export function countDeskKeys(keys: DeskKeys) {
  return Object.values(keys).filter((v) => v && v.trim()).length;
}

/** Drop unknown fields and blank values. Safe to run in the browser. */
export function cleanDeskKeys(input: unknown): DeskKeys {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: DeskKeys = {};
  for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
    const v = raw[id];
    if (typeof v === "string") {
      const trimmed = v.trim().slice(0, 200);
      if (trimmed) out[id] = trimmed;
    }
  }
  return out;
}

export function publicKeys(keys: DeskKeys): DeskKeys {
  const out: DeskKeys = {};
  for (const id of ["justtcg", "pricecharting", "pokemontcg"] as const) {
    const v = keys[id]?.trim();
    if (v) out[id] = v.slice(0, 200);
  }
  return out;
}
