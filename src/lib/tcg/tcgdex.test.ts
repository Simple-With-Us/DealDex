import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTcgdexCard } from "./tcgdex";

test("parseTcgdexCard accepts a card body and rejects a malformed one", () => {
  const card = parseTcgdexCard({
    id: "sv08-238",
    name: "Pikachu",
    localId: 238,
    set: { id: "sv08", name: "Surging Sparks" },
    pricing: { tcgplayer: { holofoil: { marketPrice: 1.2 } }, extra: true },
  });
  assert.equal(card.id, "sv08-238");
  assert.equal(card.localId, "238");
  assert.equal(card.set?.name, "Surging Sparks");
  assert.equal(card.pricing?.tcgplayer?.holofoil && typeof card.pricing.tcgplayer.holofoil === "object" ? (card.pricing.tcgplayer.holofoil as { marketPrice?: number }).marketPrice : null, 1.2);
  assert.throws(() => parseTcgdexCard({ id: "x" }), /did not match/);
  assert.throws(() => parseTcgdexCard(null), /did not match/);
});

test("parseTcgdexCard keeps a null sibling and a numeric string price", () => {
  const card = parseTcgdexCard({
    id: "sv08-238",
    name: "Pikachu",
    hp: "120",
    types: null,
    pricing: {
      cardmarket: { unit: null, trend: "4.5" },
      tcgplayer: { holofoil: { marketPrice: "nope" }, updated: "2026-01-01" },
    },
  });
  assert.equal(card.hp, 120);
  assert.equal(card.types, undefined);
  assert.equal(card.pricing?.cardmarket?.unit ?? null, null);
  assert.equal(card.pricing?.cardmarket?.trend, 4.5);
  const finish = card.pricing?.tcgplayer?.holofoil as { marketPrice?: number | null } | undefined;
  assert.equal(finish?.marketPrice ?? null, null);
  assert.equal(card.pricing?.tcgplayer?.updated, "2026-01-01");
});
