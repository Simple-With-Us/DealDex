import assert from "node:assert/strict";
import { test } from "node:test";
import { getSql } from "@/lib/db";
import {
  cleanDeskKeys,
  fetchUserDeskKeys,
  upsertUserDeskKeys,
} from "./desk-keys";

test("cleanDeskKeys sanitizes keys and trims whitespace", () => {
  assert.deepEqual(cleanDeskKeys(null), {});
  assert.deepEqual(cleanDeskKeys("not-an-object"), {});
  assert.deepEqual(cleanDeskKeys({}), {});
  assert.deepEqual(
    cleanDeskKeys({
      justtcg: "  key_justtcg_123  ",
      pricecharting: " token_pc_456 ",
      pokemontcg: "  x_api_key_789  ",
      unknown: "ignored",
    }),
    {
      justtcg: "key_justtcg_123",
      pricecharting: "token_pc_456",
      pokemontcg: "x_api_key_789",
    },
  );
});

test("fetchUserDeskKeys returns empty object for user without saved keys", async () => {
  const userId = `user_${Date.now()}_empty`;
  const keys = await fetchUserDeskKeys(userId);
  assert.deepEqual(keys, {});
});

test("upsertUserDeskKeys stores encrypted keys and fetchUserDeskKeys decrypts accurately", async () => {
  const userId = `user_${Date.now()}_test`;
  const originalKeys = {
    justtcg: "tcg_secret_12345",
    pricecharting: "pc_secret_67890",
    pokemontcg: "poke_secret_abcde",
  };

  await upsertUserDeskKeys(userId, originalKeys);

  // Verify decrypted retrieval through helper
  const fetched = await fetchUserDeskKeys(userId);
  assert.deepEqual(fetched, originalKeys);

  // Verify underlying database row holds encrypted ciphertexts (prefixed with sbox:)
  const sql = await getSql();
  const rawRows = await sql<{
    justtcg: string | null;
    pricecharting: string | null;
    pokemontcg: string | null;
  }>`select justtcg, pricecharting, pokemontcg from desk_keys where user_id = ${userId}`;

  assert.equal(rawRows.length, 1);
  const rawRow = rawRows[0]!;
  assert.match(rawRow.justtcg ?? "", /^v1\./, "stored justtcg must be encrypted with v1 scheme");
  assert.match(rawRow.pricecharting ?? "", /^v1\./, "stored pricecharting must be encrypted with v1 scheme");
  assert.match(rawRow.pokemontcg ?? "", /^v1\./, "stored pokemontcg must be encrypted with v1 scheme");
  assert.ok(!rawRow.justtcg?.includes(originalKeys.justtcg), "plaintext must not be stored");

  // Update keys on conflict
  const updatedKeys = {
    justtcg: "tcg_updated_999",
    pricecharting: "pc_secret_67890",
  };
  await upsertUserDeskKeys(userId, updatedKeys);
  const refetched = await fetchUserDeskKeys(userId);
  assert.equal(refetched.justtcg, "tcg_updated_999");
  assert.equal(refetched.pricecharting, "pc_secret_67890");
});
