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
  assert.throws(() => parseTcgdexCard({ id: "x" }), /did not match/);
  assert.throws(() => parseTcgdexCard(null), /did not match/);
});
