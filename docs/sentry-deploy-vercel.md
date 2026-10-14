# Sentry production deploy records (DealDex)

Org has Sentry↔Vercel integration `494377`.  It creates release versions (full
git SHA) on Vercel builds, but those releases show as `(unreleased)` with **no**
production deploy environment markers.

`.github/workflows/sentry-deploy.yml` therefore **is not skipped**: after a green
`CI` run on `main` (the same SHA Vercel deploys), it runs:

```bash
npx @sentry/cli releases deploys "$VERSION" new -e production
```

with `VERSION=$GITHUB_SHA` (40-char), `SENTRY_ORG=simple-with-us`,
`SENTRY_PROJECT=dealdex`.  It does **not** call `releases new` (avoids fighting
the integration / SDK).  Failures warn and exit 0.

Browser and server SDKs now set `release` from `VERCEL_GIT_COMMIT_SHA` (same
40-char SHA) so those deploy markers attach to events.  `@sentry/vite-plugin`
uploads hidden source maps during `vite build` when `SENTRY_AUTH_TOKEN` is
present on the Vercel project (Production + Preview).  Without that token the
plugin is skipped and maps are not emitted.
