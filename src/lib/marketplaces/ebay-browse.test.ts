import assert from "node:assert/strict";
import { afterEach, describe, it, test } from "node:test";
import {
  EBAY_CONDITION_IDS,
  broadQuery,
  clearEbayBrowseTokenCache,
  getEbayBrowseToken,
  parseEbayBrowseItem,
  readEbayBrowseConfig,
  searchEbayBrowse,
  searchEbayBrowsePage,
  searchEbayBrowseEnabled,
} from "./ebay-browse";
import { ASSUMED_SHIPPING } from "./html";

afterEach(() => {
  clearEbayBrowseTokenCache();
});

type FetchLike = typeof fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ebay-browse config", () => {
  it("is inert without both keys", () => {
    assert.equal(readEbayBrowseConfig({ EBAY_APP_ID: "a" }), null);
    assert.equal(readEbayBrowseConfig({ EBAY_CERT_ID: "b" }), null);
    assert.equal(readEbayBrowseConfig({ EBAY_ENV: "sandbox" }), null);
    assert.equal(searchEbayBrowseEnabled({}), false);
  });

  it("returns sandbox urls when EBAY_ENV=sandbox", () => {
    const cfg = readEbayBrowseConfig({
      EBAY_APP_ID: "a",
      EBAY_CERT_ID: "b",
      EBAY_ENV: "sandbox",
    });
    assert.match(cfg!.tokenUrl!, /sandbox\.ebay\.com/);
    assert.match(cfg!.searchUrl!, /sandbox\.ebay\.com/);
  });
});

describe("getEbayBrowseToken", () => {
  it("caches a fresh token in-process", async () => {
    const cfg = readEbayBrowseConfig({ EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" })!;
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ access_token: "tok-1", expires_in: 7200 });
    };
    const t1 = await getEbayBrowseToken(cfg, fetchImpl);
    const t2 = await getEbayBrowseToken(cfg, fetchImpl);
    assert.equal(t1, "tok-1");
    assert.equal(t2, "tok-1");
    assert.equal(calls, 1);
  });

  it("refreshes after the cache is cleared (cache key is app id)", async () => {
    const cfg = readEbayBrowseConfig({ EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" })!;
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ access_token: `tok-${calls}`, expires_in: 1 });
    };
    const t1 = await getEbayBrowseToken(cfg, fetchImpl);
    clearEbayBrowseTokenCache();
    const t2 = await getEbayBrowseToken(cfg, fetchImpl);
    assert.equal(t1, "tok-1");
    assert.equal(t2, "tok-2");
    assert.equal(calls, 2);
  });

  it("uses a 60s floor so a near-zero expires_in still keeps a valid entry", async () => {
    const cfg = readEbayBrowseConfig({ EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" })!;
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ access_token: `tok-${calls}`, expires_in: 1 });
    };
    const t1 = await getEbayBrowseToken(cfg, fetchImpl);
    // Sleep a tiny moment; the 60-second floor means we should NOT refresh yet.
    await new Promise((r) => setTimeout(r, 5));
    const t2 = await getEbayBrowseToken(cfg, fetchImpl);
    assert.equal(t1, t2);
    assert.equal(calls, 1);
  });

  it("throws on a non-2xx token response", async () => {
    const cfg = readEbayBrowseConfig({ EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" })!;
    const fetchImpl: FetchLike = async () => new Response("boom", { status: 401 });
    await assert.rejects(getEbayBrowseToken(cfg, fetchImpl), /HTTP 401/);
  });

  it("throws when the token body has no access_token", async () => {
    const cfg = readEbayBrowseConfig({ EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" })!;
    const fetchImpl: FetchLike = async () => jsonResponse({ expires_in: 7200 });
    await assert.rejects(getEbayBrowseToken(cfg, fetchImpl), /access_token/);
  });
});

describe("parseEbayBrowseItem", () => {
  test("maps a healthy item summary to LiveListing", () => {
    const row = parseEbayBrowseItem({
      itemId: "v1|123|0",
      title: "Charizard PSA 10 Base Set Holo",
      price: { value: "425.00", currency: "USD" },
      shippingOptions: [{ shippingCost: { value: "0" } }],
      image: { imageUrl: "https://i.ebayimg.com/images/g/abc.jpg" },
      itemWebUrl: "https://www.ebay.com/itm/123",
      itemCreationDate: "2026-09-19T12:00:00Z",
      buyingOptions: ["FIXED"],
    });
    assert.ok(row);
    assert.equal(row!.marketplace, "ebay");
    assert.equal(row!.title, "Charizard PSA 10 Base Set Holo");
    assert.equal(row!.url, "https://www.ebay.com/itm/123");
    assert.equal(row!.price, 425);
    assert.equal(row!.shipping, 0);
    assert.equal(row!.image, "https://i.ebayimg.com/images/g/abc.jpg");
    assert.equal(row!.listedAt, "2026-09-19T12:00:00Z");
  });

  test("parses seller information and maps reputation", () => {
    const row = parseEbayBrowseItem({
      itemId: "v1|456|0",
      title: "Pikachu Illustrator Holo",
      price: { value: "1000.00", currency: "USD" },
      itemWebUrl: "https://www.ebay.com/itm/456",
      seller: {
        username: "pro_tcg",
        feedbackPercentage: "99.8",
        feedbackScore: 3200,
      },
      topRatedBuyingExperience: true,
    });
    assert.ok(row);
    assert.ok(row!.seller);
    assert.equal(row!.seller!.username, "pro_tcg");
    assert.equal(row!.seller!.feedbackScore, 3200);
    assert.equal(row!.seller!.feedbackPercent, 99.8);
    assert.equal(row!.seller!.reputation, "top_rated");
    assert.equal(row!.seller!.label, "Top Rated (99.8% · 3.2k)");
  });

  it("rejects SKIP_LISTING titles", () => {
    assert.equal(
      parseEbayBrowseItem({ itemId: "1", title: "Choose Your Own Booster Box", price: { value: "10" } }),
      null,
    );
  });

  it("rejects missing price", () => {
    assert.equal(parseEbayBrowseItem({ itemId: "1", title: "Real Card" }), null);
  });

  it("rejects price outside the safe band", () => {
    assert.equal(
      parseEbayBrowseItem({ itemId: "1", title: "Real Card", price: { value: "1.5" } }),
      null,
    );
    assert.equal(
      parseEbayBrowseItem({ itemId: "1", title: "Real Card", price: { value: "9999999" } }),
      null,
    );
  });

  it("falls back to ASSUMED_SHIPPING when shippingOptions is empty", () => {
    const row = parseEbayBrowseItem({
      itemId: "1",
      title: "Card",
      price: { value: "5" },
      shippingOptions: [],
    });
    assert.ok(row);
    assert.equal(row!.shipping, ASSUMED_SHIPPING.ebay);
    assert.equal(row!.shippingEstimated, true);
  });

  it("uses itemWebUrl and falls back to /itm/{id}", () => {
    const fromUrl = parseEbayBrowseItem({
      itemId: "999",
      title: "Card",
      price: { value: "5" },
      itemWebUrl: "https://www.ebay.com/itm/999",
    });
    assert.equal(fromUrl!.url, "https://www.ebay.com/itm/999");
    const fallback = parseEbayBrowseItem({
      itemId: "777",
      title: "Card",
      price: { value: "5" },
    });
    assert.equal(fallback!.url, "https://www.ebay.com/itm/777");
  });
});

describe("broadQuery", () => {
  it("returns a workable q for blank input", () => {
    assert.equal(broadQuery(""), "pokemon");
    assert.equal(broadQuery("pokemon"), "pokemon");
    assert.equal(broadQuery("tcg"), "pokemon");
  });
  it("appends pokemon to non-tcg terms", () => {
    assert.equal(broadQuery("Charizard"), "Charizard pokemon");
  });
  it("keeps tcg terms unchanged", () => {
    assert.equal(broadQuery("pokemon tcg charizard"), "pokemon tcg charizard");
  });
});

describe("searchEbayBrowsePage", () => {
  it("returns empty listings when keys are absent", async () => {
    const r = await searchEbayBrowsePage("charizard", {}, {});
    assert.deepEqual(r, { listings: [], offset: 0, hadResponse: false });
  });

  it("calls eBay with buyingOptions:FIXED + condition filter + Bearer token", async () => {
    const env = { EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" };
    let lastUrl = "";
    let lastAuth: string | null = null;
    const fetchImpl: FetchLike = async (input, init) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const u = new URL(url);
      lastUrl = url;
      lastAuth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? null;
      if (u.pathname.endsWith("/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 7200 });
      }
      return jsonResponse({
        total: 2,
        itemSummaries: [
          {
            itemId: "1",
            title: "Charizard PSA 10",
            price: { value: "200", currency: "USD" },
            shippingOptions: [{ shippingCost: { value: "0" } }],
            image: { imageUrl: "https://i.ebayimg.com/x.jpg" },
            itemWebUrl: "https://www.ebay.com/itm/1",
            itemCreationDate: "2026-09-20T10:00:00Z",
            buyingOptions: ["FIXED"],
          },
        ],
      });
    };
    const r = await searchEbayBrowsePage(
      "charizard",
      { conditionIds: [EBAY_CONDITION_IDS.NEW] },
      env,
      fetchImpl,
    );
    assert.equal(r.hadResponse, true);
    assert.equal(r.listings.length, 1);
    assert.equal(r.listings[0]!.title, "Charizard PSA 10");
    assert.equal(lastAuth, "Bearer tok");
    const u = new URL(lastUrl);
    const filters = u.searchParams.getAll("filter");
    assert.ok(
      filters.some((f) => /buyingOptions:\{FIXED\}/.test(f)),
      `expected buyingOptions filter in ${JSON.stringify(filters)}`,
    );
    assert.ok(
      filters.some((f) => /conditionIds:\{1000\}/.test(f)),
      `expected conditionIds filter in ${JSON.stringify(filters)}`,
    );
    assert.equal(u.searchParams.get("sort"), "pricePlusShipping");
    assert.equal(u.searchParams.get("q"), "charizard pokemon");
  });

  it("appends price-range filter when minPrice/maxPrice are set", async () => {
    const env = { EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" };
    let lastUrl = "";
    const fetchImpl: FetchLike = async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const u = new URL(url);
      if (u.pathname.endsWith("/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 7200 });
      }
      lastUrl = url;
      return jsonResponse({ total: 0, itemSummaries: [] });
    };
    await searchEbayBrowsePage("charizard", { minPrice: 5, maxPrice: 250 }, env, fetchImpl);
    const u = new URL(lastUrl);
    const filters = u.searchParams.getAll("filter");
    assert.ok(
      filters.some((f) => /price:\[5\.\.\],price:\[\.\.250\]/.test(f)),
      `expected combined price-range filter in ${JSON.stringify(filters)}`,
    );
  });
});

describe("searchEbayBrowse (high-level)", () => {
  it("stops early on empty pages and never exceeds cap", async () => {
    const env = { EBAY_APP_ID: "id", EBAY_CERT_ID: "secret" };
    let calls = 0;
    const fetchImpl: FetchLike = async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const u = new URL(url);
      if (u.pathname.endsWith("/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 7200 });
      }
      calls += 1;
      return jsonResponse({ total: 0, itemSummaries: [] });
    };
    const out = await searchEbayBrowse("charizard", 50, env, fetchImpl);
    assert.deepEqual(out, []);
    assert.equal(calls, 1);
  });

  it("returns 0 on cap <= 0 without doing any network work", async () => {
    let called = false;
    const fetchImpl: FetchLike = async () => {
      called = true;
      return new Response("", { status: 200 });
    };
    const out = await searchEbayBrowse("charizard", 0, {}, fetchImpl);
    assert.deepEqual(out, []);
    assert.equal(called, false);
  });
});