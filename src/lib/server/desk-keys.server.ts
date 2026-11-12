import { getSql } from "@/lib/db";
import { cleanDeskKeys } from "@/lib/settings/keys";
import type { DeskKeys } from "@/lib/settings/keys";
import { decryptSecret, encryptSecret } from "./secret-box";

/**
 * Fetch and decrypt saved price-source keys for a user.
 * Shared by the settings server function and the native keys route.
 * This file is server-only. The `.server.ts` name matches TanStack Start's
 * import-protection rule for files named *.server.*, so a client import is
 * rejected at build time. Importing it from the browser would pull in node:crypto.
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

/** Encrypt and upsert saved price-source keys for a user. */
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
