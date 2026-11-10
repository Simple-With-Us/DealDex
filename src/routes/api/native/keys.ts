import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import {
  cleanDeskKeys,
  fetchUserDeskKeys,
  upsertUserDeskKeys,
} from "@/lib/server/desk-keys";

function bearer(request: Request): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim();
}

export const Route = createFileRoute("/api/native/keys")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(bearer(request));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const keys = await fetchUserDeskKeys(user.id);
        return Response.json({
          justtcg: keys.justtcg ?? "",
          pricecharting: keys.pricecharting ?? "",
          pokemontcg: keys.pokemontcg ?? "",
        });
      },
      POST: async ({ request }) => {
        const user = await getSessionUser(bearer(request));
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const raw = await request.json().catch(() => ({}));
        const data = cleanDeskKeys(raw);
        await upsertUserDeskKeys(user.id, data);
        return Response.json({ ok: true });
      },
    },
  },
});
