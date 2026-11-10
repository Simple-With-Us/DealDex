# Renovate: hold TypeScript below 7

Jay fleet directive (Oct 2026): do not land TypeScript 7 until downstream tooling supports the TS 7 / Go compiler path.  typescript-eslint peer ranges still cap below TS 7 (`typescript-eslint#10940`), and tsup `--dts` / rollup-plugin-dts still expect the classic `typescript` compiler API.

## Change

- `renovate.json`: `packageRules` entry with `matchPackageNames: ["typescript"]`, `allowedVersions: "<7"`, and a description citing the fleet hold.

## Tracking

- Renovate PR #431 (`renovate/typescript-7.x`) stays open for visibility; merge only after the hold lifts.
- 2026-10-13: #431 keeps `allowedVersions: "<7"` on the package named `typescript` and typechecks with TypeScript 7 through `@typescript/native`.  See `docs/rollouts/2026-10-13-typescript-7-side-by-side.md`.

## Verification

- Config-only; CI lint/typecheck/unit/build unchanged.
