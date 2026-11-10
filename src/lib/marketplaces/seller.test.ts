import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveSellerReputation,
  formatFeedbackCount,
  parseEbaySellerFromText,
  parseMercariSellerFromText,
} from "./seller";

describe("formatFeedbackCount", () => {
  it("formats numbers cleanly with abbreviations", () => {
    assert.equal(formatFeedbackCount(0), "0");
    assert.equal(formatFeedbackCount(42), "42");
    assert.equal(formatFeedbackCount(999), "999");
    assert.equal(formatFeedbackCount(1000), "1k");
    assert.equal(formatFeedbackCount(1450), "1.5k");
    assert.equal(formatFeedbackCount(12400), "12.4k");
    assert.equal(formatFeedbackCount(100000), "100k");
    assert.equal(formatFeedbackCount(1200000), "1.2m");
  });
});

describe("deriveSellerReputation - eBay", () => {
  it("identifies high-rated high-volume sellers as top_rated", () => {
    const res = deriveSellerReputation({
      marketplace: "ebay",
      username: "poke_power",
      feedbackScore: 1500,
      feedbackPercent: 99.8,
    });
    assert.equal(res.reputation, "top_rated");
    assert.equal(res.label, "Top Rated (99.8% · 1.5k)");
    assert.ok(res.detail?.includes("Top rated"));
  });

  it("identifies explicit topRated flag as top_rated", () => {
    const res = deriveSellerReputation({
      marketplace: "ebay",
      username: "vintage_vault",
      isTopRated: true,
    });
    assert.equal(res.reputation, "top_rated");
    assert.equal(res.label, "Top Rated Seller");
  });

  it("identifies established sellers with solid feedback as trusted", () => {
    const res = deriveSellerReputation({
      marketplace: "ebay",
      username: "collector_joe",
      feedbackScore: 45,
      feedbackPercent: 98.5,
    });
    assert.equal(res.reputation, "trusted");
    assert.equal(res.label, "Trusted (98.5% · 45)");
  });

  it("flags brand new accounts (<= 5 feedback) as new", () => {
    const res0 = deriveSellerReputation({
      marketplace: "ebay",
      username: "fresh_acc",
      feedbackScore: 0,
    });
    assert.equal(res0.reputation, "new");
    assert.equal(res0.label, "New Seller (0 sales)");

    const res2 = deriveSellerReputation({
      marketplace: "ebay",
      username: "almost_fresh",
      feedbackScore: 2,
      feedbackPercent: 100,
    });
    assert.equal(res2.reputation, "new");
    assert.equal(res2.label, "New Seller (2 sales)");
  });

  it("flags low-rated sellers (< 95% positive feedback) as low_rated", () => {
    const res = deriveSellerReputation({
      marketplace: "ebay",
      username: "shady_card",
      feedbackScore: 50,
      feedbackPercent: 91.2,
    });
    assert.equal(res.reputation, "low_rated");
    assert.equal(res.label, "Low Rated (91.2%)");
    assert.ok(res.detail?.includes("below-average"));
  });

  it("treats average moderate sellers as standard", () => {
    const res = deriveSellerReputation({
      marketplace: "ebay",
      username: "regular_joe",
      feedbackScore: 12,
      feedbackPercent: 96.0,
    });
    assert.equal(res.reputation, "standard");
    assert.equal(res.label, "12 · 96.0%");
  });
});

describe("deriveSellerReputation - Mercari", () => {
  it("identifies high-volume top-rated Mercari sellers", () => {
    const res = deriveSellerReputation({
      marketplace: "mercari",
      username: "tcg_mercari",
      feedbackScore: 120,
      feedbackPercent: 4.9,
    });
    assert.equal(res.reputation, "top_rated");
    assert.equal(res.label, "Top Seller (4.9★ · 120)");
  });

  it("identifies trusted Mercari sellers", () => {
    const res = deriveSellerReputation({
      marketplace: "mercari",
      username: "card_fan",
      feedbackScore: 25,
      feedbackPercent: 4.8,
    });
    assert.equal(res.reputation, "trusted");
    assert.equal(res.label, "Trusted Seller (25)");
  });

  it("flags brand new Mercari sellers (<= 3 reviews)", () => {
    const res = deriveSellerReputation({
      marketplace: "mercari",
      username: "new_seller",
      feedbackScore: 0,
    });
    assert.equal(res.reputation, "new");
    assert.equal(res.label, "New Seller (0 reviews)");
  });

  it("flags low-rated Mercari sellers (< 4.5 stars)", () => {
    const res = deriveSellerReputation({
      marketplace: "mercari",
      username: "poor_shipper",
      feedbackScore: 20,
      feedbackPercent: 3.8,
    });
    assert.equal(res.reputation, "low_rated");
    assert.equal(res.label, "Low Rated (3.8★)");
  });
});

describe("parseEbaySellerFromText", () => {
  it("extracts username, score, and percent from search result strings", () => {
    const text = 'seller: card_empire (2,450) 99.7% positive feedback';
    const seller = parseEbaySellerFromText(text);
    assert.ok(seller);
    assert.equal(seller!.username, "card_empire");
    assert.equal(seller!.feedbackScore, 2450);
    assert.equal(seller!.feedbackPercent, 99.7);
    assert.equal(seller!.reputation, "top_rated");
  });

  it("recognizes new sellers with 0 feedback", () => {
    const text = 'Seller: newbie_cards (0) 0% positive';
    const seller = parseEbaySellerFromText(text);
    assert.ok(seller);
    assert.equal(seller!.reputation, "new");
    assert.equal(seller!.label, "New Seller (0 sales)");
  });

  it("recognizes low-rated sellers", () => {
    const text = 'Seller: risky_deals (15) 89.5% positive';
    const seller = parseEbaySellerFromText(text);
    assert.ok(seller);
    assert.equal(seller!.reputation, "low_rated");
    assert.equal(seller!.label, "Low Rated (89.5%)");
  });

  it("handles Top Rated Plus text without raw numbers", () => {
    const text = 'Free shipping. Top-Rated Seller. Authenticity Guarantee.';
    const seller = parseEbaySellerFromText(text);
    assert.ok(seller);
    assert.equal(seller!.reputation, "top_rated");
  });
});

describe("parseMercariSellerFromText", () => {
  it("extracts Mercari seller rating and reviews from snippets", () => {
    const text = 'Sold by PokeVault. 4.9 ★ 250 reviews. Ships within 24 hours.';
    const seller = parseMercariSellerFromText(text);
    assert.ok(seller);
    assert.equal(seller!.username, "PokeVault");
    assert.equal(seller!.feedbackScore, 250);
    assert.equal(seller!.feedbackPercent, 4.9);
    assert.equal(seller!.reputation, "top_rated");
  });

  it("recognizes new Mercari sellers", () => {
    const text = 'Sold by JustJoined. 0 reviews. New seller on Mercari.';
    const seller = parseMercariSellerFromText(text);
    assert.ok(seller);
    assert.equal(seller!.reputation, "new");
  });
});
