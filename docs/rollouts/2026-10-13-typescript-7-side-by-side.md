# TypeScript 7 typecheck beside the v6 API shim

PR #431 asked to move `typescript` from `^5.7.0` to `^7.0.0`.  A direct install cannot go green.  `typescript@7.0.2` publishes `tsc` and only `./unstable/*` exports; the root export is a version stub with no `createProgram`.  `typescript-eslint@8.71.2` still declares `peer typescript@">=4.8.4 <6.1.0"` (`typescript-eslint#10940`).  Strict `npm ci` refuses the peer, and ESLint crashes if the peer is forced.

DealDex does not use tsup.  The repo blocker is typescript-eslint plus `tsc --noEmit`.

## Change

- `@typescript/native` is `npm:typescript@^7.0.2`.  `npm run typecheck` calls that package's `tsc` (7.0.2).
- `typescript` is `npm:@typescript/typescript6@^6.0.2`.  `require("typescript")` is the TypeScript 6 compiler API (resolved 6.0.3) so ESLint keeps working.  Its CLI name is `tsc6`, so it does not replace `tsc`.
- `tsconfig.json` drops `baseUrl`.  TypeScript 7 removed that option (`TS5102`).  `@/*` path mapping is unchanged.
- `renovate.json` keeps the fleet hold on the package named `typescript` (and on `@typescript/typescript6`) below 7, and allows `@typescript/native` on `>=7 <8` so Renovate does not collapse the two compilers into one key.

## Verification

- `npm ci --no-audit --no-fund` on Node 24.10 / npm 11.6.1.
- `npm run lint` (warnings only, exit 0), `npm run typecheck` (tsc 7.0.2), `npm test` (316 pass), `npm run build`.
