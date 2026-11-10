# 2026-09-13 — Skip pointless Vercel production deploys

Board `0934111e`.  Branch `fx/vercel-skip-pointless`.

Skip preview auto-deploys.  Skip production when site files did not change.  Cap one READY production deploy per hour.  iOS / docs / effort-log merges must not ship DealDex.net.
