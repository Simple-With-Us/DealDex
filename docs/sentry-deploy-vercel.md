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
