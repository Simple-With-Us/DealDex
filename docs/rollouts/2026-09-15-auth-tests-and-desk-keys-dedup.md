# 2026-09-15 — Native Auth Tests, Desk Keys Deduplication & Dependabot

Seat: ANTIGRAVITY, branch `ag/fleet-board-and-auth-tests` in `~/apps/dealdex-antigravity`.

## What changed

### 1. Functional test coverage for `native-auth-codes.ts` (`src/lib/server/native-auth-codes.test.ts`)
- Added comprehensive functional test suite testing `storePendingAuth`, `takePendingAuth`, `storeCode`, and `redeemCode`.
- Verified single-use replay protection, wrong-verifier burn semantics, and timestamp expiration for both pending challenges and issued authorization codes.
- Added Node.js filesystem fallback for PGLite migrations in `src/lib/db.ts` when running outside Vite bundler environments.

### 2. Desk Keys deduplication (`src/lib/server/desk-keys.ts` & `src/routes/api/native/keys.ts`)
- Extracted shared `fetchUserDeskKeys(userId)`, `upsertUserDeskKeys(userId, data)`, and `cleanDeskKeys(input)` helpers into `desk-keys.ts`.
- Refactored native API `/api/native/keys` to use the shared helpers, eliminating duplicate encryption, decryption, and SQL upsert statements.
- Added comprehensive unit and functional tests in `src/lib/server/desk-keys.test.ts`.

### 3. Automated CVE & Dependency scanning (`.github/dependabot.yml`)
- Added `.github/dependabot.yml` configured for weekly npm and GitHub Actions ecosystem scans with pinned compiler updates and logical groups.

## Verification

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 errors, 8 pre-existing warnings
npm test            # 227/227 pass
npm run build       # clean
```
