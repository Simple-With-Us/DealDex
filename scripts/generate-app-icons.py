#!/usr/bin/env python3
"""Resize owner artwork into iOS / Android / PWA / favicon slots.

iOS AppIcon: assets/brand/dealdex-dd-icon-1024.png (tiled 3D DD).
Android + PWA 180 + favicon: assets/brand/dealdex-dd-isolated.png
  Isolated transparent DD.  Black in previews is alpha.

Run from the repo root:  python3 scripts/generate-app-icons.py
Requires Pillow (dev-only; generated PNGs are committed).
"""

from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICON_SOURCE = ROOT / "assets/brand/dealdex-dd-icon-1024.png"
MARK_SOURCE = ROOT / "assets/brand/dealdex-dd-isolated.png"

IOS_ICONSET = ROOT / "apps/ios/DealDex/Assets.xcassets/AppIcon.appiconset"
ANDROID_RES = ROOT / "apps/android/app/src/main/res"
WEB_ICON_180 = ROOT / "public/__grok/icon-180.png"
FAVICON_SVG = ROOT / "public/favicon.svg"
FAVICON_PNG = ROOT / "public/favicon.png"
FAVICON_16 = ROOT / "public/favicon-16.png"
FAVICON_32 = ROOT / "public/favicon-32.png"
FAVICON_ICO = ROOT / "public/favicon.ico"

SIZE = 1024

IOS_SIZES: list[tuple[str, int]] = [
    ("Icon-20.png", 20),
    ("Icon-20@2x.png", 40),
    ("Icon-20@3x.png", 60),
    ("Icon-29.png", 29),
    ("Icon-29@2x.png", 58),
    ("Icon-29@3x.png", 87),
    ("Icon-40.png", 40),
    ("Icon-40@2x.png", 80),
    ("Icon-40@3x.png", 120),
    ("Icon-60@2x.png", 120),
    ("Icon-60@3x.png", 180),
    ("Icon-76.png", 76),
    ("Icon-76@2x.png", 152),
    ("Icon-83.5@2x.png", 167),
    ("Icon-1024.png", 1024),
]

ANDROID_MIPMAP = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

FOREGROUND_PX = 432


def resize_square(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb = im.convert("RGB")
    rgb.save(path, format="PNG", optimize=True)


def save_png_rgba(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba = im.convert("RGBA")
    rgba.save(path, format="PNG", optimize=True)


def alpha_crop(im: Image.Image, pad: int = 0, threshold: int = 8) -> Image.Image:
    rgba = im.convert("RGBA")
    mask = rgba.getchannel("A").point(lambda p: 255 if p > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return rgba
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(rgba.width, x1 + pad)
    y1 = min(rgba.height, y1 + pad)
    return rgba.crop((x0, y0, x1, y1))


def fit_mark(mark: Image.Image, box: int) -> Image.Image:
    w, h = mark.size
    scale = min(box / w, box / h)
    nw = max(1, int(w * scale))
    nh = max(1, int(h * scale))
    return mark.resize((nw, nh), Image.Resampling.LANCZOS)


def favicon_mark(mark: Image.Image, size: int, margin_frac: float = 0.08) -> Image.Image:
    cropped = alpha_crop(mark, pad=2)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = max(1, int(size * (1 - 2 * margin_frac)))
    fitted = fit_mark(cropped, inner)
    ox = (size - fitted.width) // 2
    oy = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (ox, oy))
    return canvas


def write_favicon_svg(mark: Image.Image) -> None:
    thumb = favicon_mark(mark, 64)
    buf = BytesIO()
    thumb.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        f'  <image href="data:image/png;base64,{b64}" width="64" height="64"/>\n'
        "</svg>\n"
    )
    FAVICON_SVG.write_text(svg, encoding="utf-8")


def write_favicons(mark: Image.Image) -> None:
    png32 = favicon_mark(mark, 32)
    png16 = favicon_mark(mark, 16)
    save_png_rgba(png32, FAVICON_PNG)
    save_png_rgba(png32, FAVICON_32)
    save_png_rgba(png16, FAVICON_16)
    write_favicon_svg(mark)
    FAVICON_ICO.parent.mkdir(parents=True, exist_ok=True)
    png32.save(FAVICON_ICO, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


def write_contents_json() -> None:
    entries = [
        ("20x20", "iphone", "Icon-20@2x.png", "2x"),
        ("20x20", "iphone", "Icon-20@3x.png", "3x"),
        ("29x29", "iphone", "Icon-29@2x.png", "2x"),
        ("29x29", "iphone", "Icon-29@3x.png", "3x"),
        ("40x40", "iphone", "Icon-40@2x.png", "2x"),
        ("40x40", "iphone", "Icon-40@3x.png", "3x"),
        ("60x60", "iphone", "Icon-60@2x.png", "2x"),
        ("60x60", "iphone", "Icon-60@3x.png", "3x"),
        ("20x20", "ipad", "Icon-20.png", "1x"),
        ("20x20", "ipad", "Icon-20@2x.png", "2x"),
        ("29x29", "ipad", "Icon-29.png", "1x"),
        ("29x29", "ipad", "Icon-29@2x.png", "2x"),
        ("40x40", "ipad", "Icon-40.png", "1x"),
        ("40x40", "ipad", "Icon-40@2x.png", "2x"),
        ("76x76", "ipad", "Icon-76.png", "1x"),
        ("76x76", "ipad", "Icon-76@2x.png", "2x"),
        ("83.5x83.5", "ipad", "Icon-83.5@2x.png", "2x"),
        ("1024x1024", "ios-marketing", "Icon-1024.png", "1x"),
    ]
    lines = ['{\n  "images" : [\n']
    chunks = []
    for size, idiom, filename, scale in entries:
        chunks.append(
            "    {\n"
            f'      "filename" : "{filename}",\n'
            f'      "idiom" : "{idiom}",\n'
            f'      "scale" : "{scale}",\n'
            f'      "size" : "{size}"\n'
            "    }"
        )
    lines.append(",\n".join(chunks))
    lines.append(
        "\n  ],\n"
        '  "info" : {\n'
        '    "author" : "xcode",\n'
        '    "version" : 1\n'
        "  }\n"
        "}\n"
    )
    (IOS_ICONSET / "Contents.json").write_text("".join(lines), encoding="utf-8")


def write_catalog_root() -> None:
    catalog = ROOT / "apps/ios/DealDex/Assets.xcassets/Contents.json"
    catalog.parent.mkdir(parents=True, exist_ok=True)
    catalog.write_text(
        '{\n  "info" : {\n    "author" : "xcode",\n    "version" : 1\n  }\n}\n',
        encoding="utf-8",
    )


def main() -> None:
    if not ICON_SOURCE.is_file():
        raise SystemExit(f"missing AppIcon source: {ICON_SOURCE}")
    if not MARK_SOURCE.is_file():
        raise SystemExit(f"missing isolated favicon mark: {MARK_SOURCE}")

    icon = Image.open(ICON_SOURCE).convert("RGB")
    if icon.size != (SIZE, SIZE):
        icon = resize_square(icon, SIZE)
        save_png(icon, ICON_SOURCE)

    write_catalog_root()
    IOS_ICONSET.mkdir(parents=True, exist_ok=True)
    for name, size in IOS_SIZES:
        save_png(resize_square(icon, size), IOS_ICONSET / name)
    write_contents_json()

    mark = Image.open(MARK_SOURCE).convert("RGBA")
    for folder, size in ANDROID_MIPMAP.items():
        slot = favicon_mark(mark, size)
        save_png_rgba(slot, ANDROID_RES / folder / "ic_launcher.png")
        save_png_rgba(slot, ANDROID_RES / folder / "ic_launcher_round.png")

    save_png_rgba(favicon_mark(mark, FOREGROUND_PX, margin_frac=0.18), ANDROID_RES / "drawable" / "ic_launcher_foreground.png")
    save_png_rgba(favicon_mark(mark, 180), WEB_ICON_180)

    write_favicons(mark)
    mark_path = ROOT / "public/marks/dealdex-dd.png"
    mark_path.parent.mkdir(parents=True, exist_ok=True)
    save_png_rgba(mark, mark_path)
    imageset = ROOT / "apps/ios/DealDex/Assets.xcassets/DealDexMark.imageset/dealdex-dd.png"
    if imageset.parent.is_dir():
        save_png_rgba(mark, imageset)
    print("wrote iOS AppIcon from tiled PNG; Android/PWA/favicon from isolated DD")


if __name__ == "__main__":
    main()
