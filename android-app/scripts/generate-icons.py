#!/usr/bin/env python3
"""Generate launcher icons for the Android app from artwork/ic_launcher_source.png."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "artwork" / "ic_launcher_source.png"
RES = ROOT / "app" / "src" / "main" / "res"

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def make_icon(src: Image.Image, size: int) -> Image.Image:
    # Source is already a full-bleed square brand mark on black — scale 1:1.
    return src.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing source icon: {SRC}")

    src = Image.open(SRC).convert("RGBA")
    if src.width != src.height:
        raise SystemExit(f"Source must be square, got {src.size}")

    for folder, size in SIZES.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = make_icon(src, size)
        icon.save(out_dir / "ic_launcher.png", optimize=True)
        icon.save(out_dir / "ic_launcher_round.png", optimize=True)
        print(f"Wrote {out_dir} ({size}px)")


if __name__ == "__main__":
    main()
