# DealDex plan

Product direction lives in `README.md` and `native/README.md`.  This file tracks
fleet / delivery posture, not card-desk features.

## Now

- Fleet membership: effort board, agent lanes, CI, Slack/digest/calendar
  registries.  See `docs/rollouts/2026-08-13-fleet-onboard.md`.
- GROK-BUILD standing seat: Mac lane + `fleet-apps.json`.  See
  `docs/rollouts/2026-08-14-grok-build-seat.md`.
- Web identity: public host **https://dealdex.net** on **Vercel**.
  Vercel is current.  GitHub About homepage is that URL, not
  `dealdex-psi.vercel.app`.  Do not migrate copy to Coolify.  Do not
  point people at `dealdex.vercel.app` (different Next.js product).
- Native identity: Android `me.grok.dealdex`.  iOS `net.dealdex`, team
  `CC8UTF7ATG`.  Apple bundle resource id `R2FAW69NPD` is not a team id.
  ASC app DealDex SKU `dealdex`, appleId `6802474288`.  Internal TestFlight
  ships.

## Next (product, not this PR)

- Runtime secrets in Infisical (prod env).  Owner creates the project.  Do
  not invent one.
- Keep `dealdex.net` on Vercel.  Do not invent a replacement hostname
  and do not move the site to Coolify.
- iOS TestFlight via `.github/workflows/ios-ship.yml` on GitHub-hosted
  `macos-latest` (fleet protocol: no local Mac self-hosted runners), app
  key `dealdex`, path `native/ios/`, bundle `net.dealdex`.  Team stays
  `CC8UTF7ATG`.  Apple bundle resource id `R2FAW69NPD` is not a team id.
  In-repo fleet is `scripts/ios-fleet`.  ASC secrets are repo secrets
  imported by `scripts/ios-appstore-gm-prepare.sh`.
- Android Play / sideload pipeline as the owner directs.

## Out of scope until asked

- Preview hostnames, per-agent `next dev` / Vite preview tunnels.
- Mixing DealDex keys into another app's Infisical project.
