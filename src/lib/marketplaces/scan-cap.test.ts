import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseBraveListings } from "./brave";
import { EBAY_SCAN_CAP, MERCARI_SCAN_CAP } from "./caps";
import { clearEbayBrowseTokenCache, searchEbayBrowse } from "./ebay-browse";
import { parseJinaEbay, parseJinaMercari } from "./jina";
import { resetSentryServerForTests, setSentryServerForTests } from "@/lib/observability/sentry-server";

afterEach(() => {
  clearEbayBrowseTokenCache();
  resetSentryServerForTests();
});

type FetchLike = typeof fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function summary(id: string, title: string) {
  return {
    itemId: id,
    title,
    price: { value: "25", currency: "USD" },
    buyingOptions: ["FIXED"],
  };
}

describe("marketplace scan caps", () => {
  it("keeps the per-market cap at 50", () => {
    assert.equal(EBAY_SCAN_CAP, 50);
    assert.equal(MERCARI_SCAN_CAP, 50);
  });

  it("lets Jina eBay keep matches past the old 16 cap and ignores junk first", () => {
    const junk = Array.from({ length: 8 }, (_, i) => {
      const id = String(100000000000 + i);
      return `[Charizard booster box ${i}](https://www.ebay.com/itm/${id})\n$12.00\n`;
    }).join("");
    const good = Array.from({ length: 55 }, (_, i) => {
      const id = String(200000000000 + i);
      return `[Charizard PSA 10 ${i}](https://www.ebay.com/itm/${id})\n$40.00\n`;
    }).join("");
    const rows = parseJinaEbay(`${junk}${good}`, "charizard");
    assert.equal(rows.length, EBAY_SCAN_CAP);
    assert.ok(rows.every((row) => /charizard psa 10/i.test(row.title)));
  });

  it("lets Jina Mercari keep matches past the old 16 cap", () => {
    const md = Array.from({ length: 20 }, (_, i) => {
      return `[Charizard holo ${i}](https://www.mercari.com/us/item/m${300000000 + i}/)\n`;
    }).join("");
    const rows = parseJinaMercari(md, "charizard");
    assert.equal(rows.length, 20);
    assert.ok(rows.length > 16);
  });

  it("lets Brave keep matches past the old 12 cap", () => {
    const blocks = Array.from({ length: 18 }, (_, i) => {
      const title = i < 3 ? `Charizard booster box ${i}` : `Charizard PSA 10 ${i}`;
      const id = String(400000000000 + i);
      return (
        `<div class="snippet ">` +
        `<a href="https://www.ebay.com/itm/${id}">x</a>` +
        `<div class="title search-snippet-title" title="${title}">${title}</div>` +
        `$25.00</div>`
      );
    }).join("");
    const html = blocks.length >= 4000 ? blocks : `${blocks}${"<!-- pad -->".repeat(400)}`;
    assert.ok(html.length >= 4000);
    const rows = parseBraveListings(html, "charizard", "ebay");
    assert.equal(rows.length, 15);
    assert.ok(rows.every((row) => /psa 10/i.test(row.title)));
  });
});

describe("searchEbayBrowse paging", () => {
  it("requests a second page at the raw offset and emits scan.ebay.page2", async () => {
    const env = { EBAY_APP_ID: "scan-cap", EBAY_CERT_ID: "secret" };
    const calls: Array<{ name: string; attributes: Record<string, unknown> }> = [];
    setSentryServerForTests({
      init() {},
      startSpan(opts, callback) {
        const rec = { name: opts.name, attributes: { ...(opts.attributes ?? {}) } };
        calls.push(rec);
        return callback({
          setAttribute(key, value) {
            rec.attributes[key] = value;
          },
          updateName(name) {
            rec.name = name;
          },
        });
      },
    });

    const searchUrls: URL[] = [];
    const fetchImpl: FetchLike = async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const u = new URL(url);
      if (u.pathname.endsWith("/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 7200 });
      }
      searchUrls.push(u);
      const offset = Number(u.searchParams.get("offset"));
      if (offset === 0) {
        return jsonResponse({
          total: 4,
          itemSummaries: [
            summary("111", "Charizard booster box sealed"),
            summary("222", "Blastoise base"),
          ],
        });
      }
      return jsonResponse({
        total: 4,
        itemSummaries: [summary("333", "Charizard PSA 10"), summary("444", "Charizard PSA 9")],
      });
    };

    const rows = await searchEbayBrowse("charizard", 2, env, fetchImpl);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["333", "444"],
    );
    assert.equal(searchUrls.length, 2);
    assert.equal(searchUrls[0]?.searchParams.get("offset"), "0");
    assert.equal(searchUrls[1]?.searchParams.get("offset"), "2");
    assert.equal(searchUrls[1]?.searchParams.get("limit"), "2");
    assert.ok(searchUrls.every((u) => u.searchParams.getAll("filter").some((f) => f.includes("FIXED"))));
    assert.equal(calls.filter((call) => call.name === "scan.ebay.api").length, 1);
    const page2 = calls.filter((call) => call.name === "scan.ebay.page2");
    assert.equal(page2.length, 1);
    assert.equal(page2[0]?.attributes["scan.page"], 2);
    assert.equal(page2[0]?.attributes["listing.count"], 2);
    assert.equal(calls[0]?.attributes["scan.pages"], 2);
    for (const call of calls) {
      for (const key of Object.keys(call.attributes)) {
        assert.equal(/url|query|title|token|key/i.test(key), false);
      }
    }
  });

  it("does not fetch page 2 when the first page already fills the cap", async () => {
    const env = { EBAY_APP_ID: "scan-cap-full", EBAY_CERT_ID: "secret" };
    const names: string[] = [];
    setSentryServerForTests({
      init() {},
      startSpan(opts, callback) {
        names.push(opts.name);
        return callback({
          setAttribute() {},
          updateName() {},
        });
      },
    });
    let searches = 0;
    const fetchImpl: FetchLike = async (input) => {
      const url = input instanceof URL ? input.toString() : String(input);
      const u = new URL(url);
      if (u.pathname.endsWith("/oauth2/token")) {
        return jsonResponse({ access_token: "tok", expires_in: 7200 });
      }
      searches += 1;
      return jsonResponse({
        total: 2,
        itemSummaries: [summary("555", "Charizard PSA 10"), summary("666", "Charizard PSA 9")],
      });
    };
    const rows = await searchEbayBrowse("charizard", 2, env, fetchImpl);
    assert.equal(rows.length, 2);
    assert.equal(searches, 1);
    assert.deepEqual(names, ["scan.ebay.api"]);
  });
});
