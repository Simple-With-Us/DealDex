import type { ScanSource } from "./types";

/**
 * How many live listings one scan keeps per marketplace.
 *
 * 16 dropped real rows on a query like "Charizard PSA 10" before the desk
 * ever scored them.  50 is still bounded, and the parsers apply the skip
 * list and the query check before this cap so junk does not consume it.
 */
export const EBAY_SCAN_CAP = 50;
export const MERCARI_SCAN_CAP = 50;

export function scanCapFor(marketplace: ScanSource): number {
  switch (marketplace) {
    case "ebay":
      return EBAY_SCAN_CAP;
    case "mercari":
      return MERCARI_SCAN_CAP;
    default: {
      const unreachable: never = marketplace;
      return unreachable;
    }
  }
}
