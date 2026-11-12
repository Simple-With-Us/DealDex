#!/usr/bin/env python3
"""Preview AppIcon options — does NOT replace the live catalog.

The live mark is assets/brand/dealdex-dd-icon-1024.png (DD on the ST tiled field).
This writes assets/brand/icon-options/ as leftover scale previews:

  ct-gray-90 / ct-gray-80  — Congress.Trade light gray + oval ground shadow
  st-grid-90 / st-grid-80  — Socratic.Trade light grid + oval ground shadow
  ct-gray-72              — extra CT-like padding (28% smaller)

90 = 10% smaller than an edge-to-edge DD.  80 = 20% smaller.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/brand/dealdex-dd-isolated.png"
OUT = ROOT / "assets/brand/icon-options"
SIZE = 1024


def isolate_mark(im: Image.Image) -> Image.Image:
    """Return the DD on a transparent canvas (already isolated, or flood-fill white)."""
    rgba = im.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema()[0] < 255:
        return rgba
    w, h = rgba.size
    px = rgba.load()
    mask = Image.new("L", (w, h), 255)
    ap = mask.load()
    visited = bytearray(w * h)

    def is_bg(x: int, y: int) -> bool:
        r, g, b, _a = px[x, y]
        return r > 245 and g > 245 and b > 245

    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if visited[i]:
            continue
        visited[i] = 1
        if not is_bg(x, y):
            continue
        ap[x, y] = 0
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    rgba.putalpha(mask)
    return rgba


def ct_background(size: int = SIZE) -> Image.Image:
    im = Image.new("RGB", (size, size))
    px = im.load()
    cx = cy = size / 2
    maxd = math.hypot(cx, cy)
    for y in range(size):
        for x in range(size):
            t = math.hypot(x - cx, y - cy) / maxd
            v = int(248 - (t * t) * 20)
            px[x, y] = (v, v, v + 1)
    return im


def st_background(size: int = SIZE) -> Image.Image:
    im = Image.new("RGB", (size, size), (245, 246, 248))
    draw = ImageDraw.Draw(im)
    step = 64
    line = (226, 228, 232)
    for i in range(0, size + 1, step):
        draw.line([(i, 0), (i, size)], fill=line, width=2)
        draw.line([(0, i), (size, i)], fill=line, width=2)
    return im


def oval_shadow_layer(size: int, box: tuple[int, int, int, int]) -> Image.Image:
    """Soft ellipse under the mark, like the CT money-bag ground shadow."""
    x0, y0, x1, y1 = box
    cx = (x0 + x1) / 2
    cy = y1 - 6
    rw = max(8, (x1 - x0) * 0.42)
    rh = 38
    pad = 90
    bw = int(rw * 2) + pad * 2
    bh = int(rh * 2) + pad * 2
    blob = Image.new("L", (bw, bh), 0)
    d = ImageDraw.Draw(blob)
    d.ellipse((pad, pad, pad + int(rw * 2), pad + int(rh * 2)), fill=150)
    blob = blob.filter(ImageFilter.GaussianBlur(radius=28))
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = int(cx - bw / 2)
    oy = int(cy - bh / 2) + 18
    colored = Image.merge(
        "RGBA",
        (
            Image.new("L", blob.size, 0),
            Image.new("L", blob.size, 0),
            Image.new("L", blob.size, 0),
            blob,
        ),
    )
    layer.paste(colored, (ox, oy), colored)
    return layer


def compose(bg: Image.Image, mark: Image.Image, scale: float) -> Image.Image:
    canvas = bg.convert("RGBA")
    size = canvas.size[0]
    mw = max(1, int(mark.width * scale))
    mh = max(1, int(mark.height * scale))
    mark_s = mark.resize((mw, mh), Image.Resampling.LANCZOS)
    ox = (size - mw) // 2
    oy = (size - mh) // 2 - 8
    canvas = Image.alpha_composite(canvas, oval_shadow_layer(size, (ox, oy, ox + mw, oy + mh)))
    canvas.alpha_composite(mark_s, (ox, oy))
    return canvas.convert("RGB")


def contact_sheet(items: list[tuple[str, Image.Image]]) -> Image.Image:
    cols = 3
    rows = math.ceil(len(items) / cols)
    cell = 340
    pad = 24
    label_h = 36
    w = cols * cell + (cols + 1) * pad
    h = rows * (cell + label_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, im) in enumerate(items):
        r, c = divmod(i, cols)
        x = pad + c * (cell + pad)
        y = pad + r * (cell + label_h + pad)
        thumb = im.resize((cell, cell), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))
        draw.rectangle([x, y, x + cell, y + cell], outline=(210, 210, 210), width=1)
        draw.text((x, y + cell + 8), name, fill=(30, 30, 30), font=font)
    return sheet


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True)


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"missing {SOURCE}")
    src = Image.open(SOURCE)
    mark = isolate_mark(src)
    ct = ct_background()
    st = st_background()
    options = [
        ("ct-gray-90", compose(ct, mark, 0.90)),
        ("ct-gray-80", compose(ct, mark, 0.80)),
        ("ct-gray-72", compose(ct, mark, 0.72)),
        ("st-grid-90", compose(st, mark, 0.90)),
        ("st-grid-80", compose(st, mark, 0.80)),
        ("st-grid-72", compose(st, mark, 0.72)),
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    for name, im in options:
        save_png(im, OUT / f"{name}.png")
    save_png(contact_sheet(options), OUT / "sheet.png")
    (OUT / "README.md").write_text(
        "# DealDex AppIcon options (not live)\n\n"
        "Live launcher is `assets/brand/dealdex-dd-icon-1024.png` (DD on the ST tiled "
        "field).  Rebuild it with `python3 scripts/generate-app-icons.py`.\n\n"
        "These files are leftover scale/background previews from before the owner "
        "picked the ST grid.\n\n"
        "| File | Background | DD scale vs current |\n"
        "|------|------------|---------------------|\n"
        "| `ct-gray-90.png` | Congress.Trade light gray + oval shadow | 10% smaller |\n"
        "| `ct-gray-80.png` | same | 20% smaller |\n"
        "| `ct-gray-72.png` | same | extra padding (closer to the CT eagle) |\n"
        "| `st-grid-90.png` | Socratic.Trade light grid + oval shadow | 10% smaller |\n"
        "| `st-grid-80.png` | same | 20% smaller |\n"
        "| `st-grid-72.png` | same | extra padding |\n"
        "| `sheet.png` | contact sheet of all six | — |\n\n"
        "Regenerate this folder: `python3 scripts/generate-icon-options.py`\n",
        encoding="utf-8",
    )
    print(f"wrote {len(options)} options + sheet to {OUT}")


if __name__ == "__main__":
    main()
