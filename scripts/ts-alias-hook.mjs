/**
 * ESM resolve hook that teaches plain `node` the `@/*` -> `src/*` path alias
 * from tsconfig.json, and fills in the extension TypeScript lets source files
 * omit.
 *
 * Why this exists: every test in this repo used to read source files as TEXT
 * and grep them, because `node --test` could not import a module that says
 * `import { … } from "@/lib/tcg/types"`. That is why 97 tests could pass while
 * nothing exercised a price, a spread, or a verdict. With this hook plus
 * `--experimental-strip-types`, `src/**\/*.test.ts` can import the real
 * functions and assert on real numbers.
 *
 * Registered by `scripts/register-ts-alias.mjs`, which `npm test` loads via
 * `--import`. Build and dev do NOT use this — Vite resolves the same alias from
 * `vite.config.ts`, and the two must stay in agreement.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);

/** Extension-less specifiers, the way TS writes them. */
const CANDIDATES = ["", ".ts", ".tsx", ".mts", ".js", "/index.ts", "/index.tsx"];

function firstExisting(base) {
  for (const ext of CANDIDATES) {
    const candidate = new URL(base.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = firstExisting(new URL(specifier.slice(2), SRC));
    if (hit) return nextResolve(hit.href, context);
  }
  // Relative TS imports written without an extension (`./types`, `./appraise`),
  // including dotted server names such as `./desk-keys.server`.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.match(/\.(ts|tsx|mts)$/) &&
    !/\.(ts|tsx|mts|js|mjs|cjs|json)$/i.test(specifier)
  ) {
    const hit = firstExisting(new URL(specifier, context.parentURL));
    if (hit) return nextResolve(hit.href, context);
  }
  return nextResolve(specifier, context);
}
