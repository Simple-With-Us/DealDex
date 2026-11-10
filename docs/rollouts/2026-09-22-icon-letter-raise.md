# 2026-09-22 — DD app icon letter raise

Raised the "DD" letter artwork 30 px upward inside the DealDex app icon
so the letters sit closer to the optical center of the 1024×1024 canvas.

## What changed

- **Source of truth** `native/brand/dealdex-dd-icon-1024.png` — the
  canonical app icon.  Letters were previously 59 px below the canvas
  center; the shift moved the centroid to 29 px below center (2.9 % of
  the canvas) without clipping the bottom shadow.
- **Mirrored copy** `personal-muse/site/public/app-icons/dd.png` —
  Personal Site's per-project icon, byte-identical to the canonical
  before, also raised in lockstep.

## How

The shift is composited, not warped: Pillow detects non-white pixels
(any pixel with color-difference > 25 from the (255, 255, 255)
background), copies the content region onto a fresh white canvas, and
slides the rows up by 30 px.  Anti-aliasing on the original edges is
preserved because we copy whole pixels rather than re-sampling.

## Verification

- `md5` of `dealdex-dd-icon-1024.png`: `e03b3ee2…` → `cfcf475c…`
- `md5` of `personal-muse/.../dd.png`: `e03b3ee2…` → `cfcf475c…`
- 4-up before/after comparison saved at `/tmp/icon-edit/dd-shift-grid.png`
  for visual review before commit.

## PRs

- `dealdex-mm` PR #349 — `fix(brand): raise DD letters 30px in app icon
  (closer to optical center)`.  Merged 2026-09-22T06:32Z.
- `personal-muse` PR #86 — `fix(icons): use canonical Socratic.Trade app
  icon + raise DD letters` (consolidated with the ST swap).  Merged
  2026-09-22T06:38Z.

## Sibling work in the same PR

The Personal Site PR also replaced the Socratic.Trade project icon with
the canonical App Store icon (md5 `e7465217…`) and pointed the project
card + `appIcons` map at `/app-icons/st.png` instead of `/app-icons/st.svg`.
This automatically updates the **FleetActivity** surface (the section on
jays.services that shows the live GitHub Activity digest) because that
component renders its per-repo badges through `site.appIcons[ST]`.
