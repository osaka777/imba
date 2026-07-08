#!/usr/bin/env python3
"""Generate launcher icons from favicon for the Android app."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "frontend" / "src" / "shared" / "assets" / "images" / "logo" / "favicon.png"
RES = ROOT / "app" / "src" / "main" / "res"

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def make_icon(size: int) -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), (11, 15, 20, 255))
    src.thumbnail((int(size * 0.72), int(size * 0.72)), Image.Resampling.LANCZOS)
    offset = ((size - src.width) // 2, (size - src.height) // 2)
    canvas.paste(src, offset, src)
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source icon: {SRC}")

    for folder, size in SIZES.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = make_icon(size)
        icon.save(out_dir / "ic_launcher.png")
        icon.save(out_dir / "ic_launcher_round.png")
        print(f"Wrote {out_dir} ({size}px)")


if __name__ == "__main__":
    main()
