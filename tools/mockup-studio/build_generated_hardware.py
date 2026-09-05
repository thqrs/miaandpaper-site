"""Gera a fita raster e chama o gerador matemático das argolas SVG."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps

from build_ring_svg_atlases import build_all as build_ring_svg_atlases


RESAMPLE = Image.Resampling.LANCZOS

ELASTIC_PALETTES = {
    "rose": ("#4b1e24", "#c88386", "#ffe1dc"),
    "pink": ("#6f284d", "#df8eb8", "#ffe2f0"),
    "blue": ("#15394e", "#75b8d7", "#ddf5ff"),
    "green": ("#183d30", "#74a98a", "#def2e4"),
}


def crop_alpha(image: Image.Image, threshold: int = 8, padding: int = 4) -> Image.Image:
    image = image.convert("RGBA")
    mask = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise ValueError("O master não contém pixels visíveis.")
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def recolor(image: Image.Image, palette: tuple[str, str, str]) -> Image.Image:
    source = image.convert("RGBA")
    gray = ImageOps.grayscale(source.convert("RGB"))
    colored = ImageOps.colorize(gray, black=palette[0], mid=palette[1], white=palette[2], midpoint=122)
    colored.putalpha(source.getchannel("A"))
    return colored


def alpha_shadow(image: Image.Image, blur: float, offset: tuple[int, int], opacity: float) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: round(value * opacity))
    shifted = ImageChops.offset(alpha.filter(ImageFilter.GaussianBlur(blur)), offset[0], offset[1])
    if offset[0] > 0:
        shifted.paste(0, (0, 0, offset[0], shifted.height))
    if offset[1] > 0:
        shifted.paste(0, (0, 0, shifted.width, offset[1]))
    shadow = Image.new("RGBA", image.size, (26, 20, 14, 0))
    shadow.putalpha(shifted)
    return shadow


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=7)


def build_elastics(master_path: Path, root: Path) -> None:
    master = crop_alpha(Image.open(master_path), padding=5).resize((32, 780), RESAMPLE)
    variants = {"gold": master}
    variants.update({name: recolor(master, palette) for name, palette in ELASTIC_PALETTES.items()})
    for name, image in variants.items():
        save_png(image, root / "elastic" / f"{name}.png")
    save_png(alpha_shadow(master, 5.5, (5, 4), 0.42), root / "shadows" / "elastic.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--elastic-master", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    build_ring_svg_atlases(args.output)
    build_elastics(args.elastic_master, args.output)


if __name__ == "__main__":
    main()
