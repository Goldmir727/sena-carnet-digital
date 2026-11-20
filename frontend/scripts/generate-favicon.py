"""Genera el favicon a partir del logo existente (requiere Pillow)."""

from pathlib import Path

from PIL import Image

public = Path(__file__).resolve().parents[1] / "public"
with Image.open(public / "logo-sena.png") as source:
    logo = source.convert("RGBA")
    logo.thumbnail((88, 88), Image.Resampling.LANCZOS)
    favicon = Image.new("RGBA", (96, 96), "white")
    favicon.alpha_composite(logo, ((96 - logo.width) // 2, (96 - logo.height) // 2))
    favicon.convert("RGB").save(public / "favicon-sena.png", optimize=True)
