# Owner source marks (2026-08-20)

Jay supplied two 3D PNGs:

- `dealdex-wordmark-owner.png` — glossy title (red Deal + blue Dex, yellow rim).
- `dealdex-dd-owner.png` — interlocking DD. Counters are transparent so the
  page color shows through.  Not the home-screen AppIcon.

Both already had an alpha channel (black in the chat preview is the viewer
background).  Isolated crops land at:

- `public/marks/dealdex-wordmark.png` — website + login title
- `public/marks/dealdex-dd.png` — isolated DD (not wired as the header)
- `apps/ios/DealDex/Assets.xcassets/DealDexWordmark.imageset`
- `apps/ios/DealDex/Assets.xcassets/DealDexMark.imageset`
- `apps/android/.../drawable-nodpi/dealdex_wordmark.png`

Live AppIcon catalog is the DD on the ST tiled field
(`scripts/generate-app-icons.py`).  Older scale previews remain in
`assets/brand/icon-options/`.
