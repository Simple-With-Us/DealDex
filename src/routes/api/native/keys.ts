import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { NativeDeskKeysSchema } from "@/lib/settings/keys";
import { fetchUserDeskKeys, upsertUserDeskKeys } from "@/lib/server/desk-keys.server";

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
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "invalid payload" }, { status: 400 });
        }
        const parsed = NativeDeskKeysSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "invalid payload" }, { status: 400 });
        }
        await upsertUserDeskKeys(user.id, parsed.data);
        return Response.json({ ok: true });
      },
    },
  },
});
