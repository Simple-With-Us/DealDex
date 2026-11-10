/**
 * POST /api/settings/ebay/oauth/start — begin the eBay OAuth Authorization
 * Code + PKCE flow.  Returns a URL the client should open in a system
 * browser (or web view on native); the redirect-back lands on
 * /api/settings/ebay/oauth/callback.
 */
import { createFileRoute } from "@tanstack/react-router";
import { startEbayOAuth } from "@/lib/server/ebay-oauth";

export const Route = createFileRoute("/api/settings/ebay/oauth/start")({
  server: {
    handlers: {
      POST: async () => {
        // startEbayOAuth returns a Response with the consent URL.
        return startEbayOAuth({ data: {} } as never);
      },
    },
  },
});