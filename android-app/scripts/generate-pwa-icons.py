#!/usr/bin/env python3
from pathlib import Path
from PIL import Image

SRC = Path("/root/onex/android-app/artwork/ic_launcher_source.png")
OUT = Path("/root/onex/frontend/public/icons")
OUT.mkdir(parents=True, exist_ok=True)

src = Image.open(SRC).convert("RGBA")
for size in (192, 512):
    icon = src.resize((size, size), Image.Resampling.LANCZOS)
    path = OUT / f"app-icon-{size}.png"
    icon.save(path, optimize=True)
    print(path)
