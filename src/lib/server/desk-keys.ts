import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { DeskKeys } from "@/lib/settings/keys";
import { decryptSecret, encryptSecret } from "./secret-box";

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

/**
 * Fetch and decrypt desk keys for a given user ID.
 * Shared across server function and native API route.
 */
export async function fetchUserDeskKeys(userId: string): Promise<DeskKeys> {
  const sql = await getSql();
  const rows = await sql<{
    justtcg: string | null;
    pricecharting: string | null;
    pokemontcg: string | null;
  }>`select justtcg, pricecharting, pokemontcg from desk_keys where user_id = ${userId}`;
  const row = rows[0];
  if (!row) return {};
  return cleanDeskKeys({
    justtcg: decryptSecret(row.justtcg),
    pricecharting: decryptSecret(row.pricecharting),
    pokemontcg: decryptSecret(row.pokemontcg),
  });
}

/**
 * Encrypt and upsert desk keys for a given user ID.
 * Shared across server function and native API route.
 */
export async function upsertUserDeskKeys(userId: string, data: DeskKeys): Promise<void> {
  const cleaned = cleanDeskKeys(data);
  const sql = await getSql();
  await sql`
    insert into desk_keys (user_id, justtcg, pricecharting, pokemontcg, updated_at)
    values (
      ${userId},
      ${encryptSecret(cleaned.justtcg ?? "")},
      ${encryptSecret(cleaned.pricecharting ?? "")},
      ${encryptSecret(cleaned.pokemontcg ?? "")},
      now()
    )
    on conflict (user_id) do update set
      justtcg = excluded.justtcg,
      pricecharting = excluded.pricecharting,
      pokemontcg = excluded.pokemontcg,
      updated_at = now()
  `;
}

export const getAccountKeys = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return fetchUserDeskKeys(context.userId);
  });

export const saveAccountKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: DeskKeys) => cleanDeskKeys(input))
  .handler(async ({ context, data }) => {
    await upsertUserDeskKeys(context.userId, data);
    return { ok: true as const };
  });
