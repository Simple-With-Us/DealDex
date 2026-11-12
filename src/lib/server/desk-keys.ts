import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { cleanDeskKeys } from "@/lib/settings/keys";
import type { DeskKeys } from "@/lib/settings/keys";

export { cleanDeskKeys };

/**
 * Browser-safe server functions. Crypto stays in desk-keys.server.ts and is
 * loaded only inside the handler, which TanStack strips from the client
 * bundle. A top-level import of that file crashes Settings with
 * "node:crypto has been externalized".
 */
export const getAccountKeys = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { fetchUserDeskKeys } = await import("./desk-keys.server");
    return fetchUserDeskKeys(context.userId);
  });

export const saveAccountKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: DeskKeys) => cleanDeskKeys(input))
  .handler(async ({ context, data }) => {
    const { upsertUserDeskKeys } = await import("./desk-keys.server");
    await upsertUserDeskKeys(context.userId, data);
    return { ok: true as const };
  });
