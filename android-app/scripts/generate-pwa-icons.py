#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

SRC = Path("/root/onex/frontend/src/shared/assets/images/logo/favicon.png")
OUT = Path("/root/onex/frontend/public/icons")
OUT.mkdir(parents=True, exist_ok=True)

src = Image.open(SRC).convert("RGBA")
for size in (192, 512):
    canvas = Image.new("RGBA", (size, size), (11, 15, 20, 255))
    icon = src.copy()
    icon.thumbnail((int(size * 0.72), int(size * 0.72)), Image.Resampling.LANCZOS)
    canvas.paste(icon, ((size - icon.width) // 2, (size - icon.height) // 2), icon)
    path = OUT / f"app-icon-{size}.png"
    canvas.save(path)
    print(path)
