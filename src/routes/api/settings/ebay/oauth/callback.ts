/**
 * GET /api/settings/ebay/oauth/callback — eBay redirects the user's
 * browser here with ?code=…&state=…  We verify the state, exchange
 * the code for tokens, persist the refresh token, and redirect to
 * /settings?ebay=connected (or ?ebay=error on failure).
 *
 * The handler is a GET because eBay's authorization-code redirect is
 * always a GET; PKCE on the verifier side still proves the request
 * started here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { callbackEbayOAuth } from "@/lib/server/ebay-oauth";

function settingsRedirect(suffix: string): Response {
  const url = new URL(`/settings${suffix}`, "https://dealdex.net");
  return Response.redirect(url, 302);
}

export const Route = createFileRoute("/api/settings/ebay/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        const result = await callbackEbayOAuth({ data: { code, state } } as never);
        const status = result.status ?? 200;
        if (status >= 400) {
          return settingsRedirect("?ebay=error");
        }
        return settingsRedirect("?ebay=connected");
      },
    },
  },
});