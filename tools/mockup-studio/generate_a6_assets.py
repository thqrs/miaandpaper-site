"""Gera o kit raster inicial do preset A6 Front.

Os ficheiros resultantes são peças independentes. O compositor não depende
deste script em produção; ele serve apenas para reconstruir os assets base.
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


SCALE = 3
RESAMPLE = Image.Resampling.LANCZOS


def rgba(size: tuple[int, int], color=(0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", size, color)


def save_png(image: Image.Image, path: Path, quality: int = 96) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=7)


def downsample(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    return image.resize(size, RESAMPLE)


def make_background(size=(1200, 1200)) -> Image.Image:
    random.seed(61)
    w, h = size
    image = rgba(size, (244, 240, 229, 255))
    pixels = image.load()
    for y in range(h):
        for x in range(w):
            dx = (x - w * 0.48) / w
            dy = (y - h * 0.43) / h
            vignette = int(18 * min(1, math.sqrt(dx * dx + dy * dy)))
            grain = random.randint(-3, 3)
            pixels[x, y] = (
                max(0, 247 - vignette + grain),
                max(0, 243 - vignette + grain),
                max(0, 233 - vignette + grain),
                255,
            )
    glow = rgba(size)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((90, 55, 1110, 970), fill=(255, 255, 255, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(130))
    return Image.alpha_composite(image, glow)


def make_cover_depth(size=(650, 970)) -> Image.Image:
    w, h = size
    layer = rgba(size)
    shadow = rgba(size)
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((8, 8, w - 2, h - 2), radius=30, fill=(67, 54, 36, 105))
    shadow = shadow.filter(ImageFilter.GaussianBlur(5))
    layer.alpha_composite(shadow)
    d = ImageDraw.Draw(layer)
    for offset, alpha in ((0, 95), (2, 82), (4, 65), (6, 42)):
        d.line((20, h - 9 - offset, w - 18, h - 9 - offset), fill=(91, 72, 44, alpha), width=1)
        d.line((w - 9 - offset, 20, w - 9 - offset, h - 18), fill=(88, 68, 40, alpha), width=1)
    return layer


def make_cover_shadow(size=(700, 1020)) -> Image.Image:
    image = rgba(size)
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((38, 32, 662, 974), radius=31, fill=(43, 36, 27, 115))
    return image.filter(ImageFilter.GaussianBlur(24))


def gold_stroke(draw: ImageDraw.ImageDraw, box, width: int, arcs=None) -> None:
    strokes = [
        (width + 8, (74, 48, 13, 165)),
        (width + 4, (126, 83, 18, 255)),
        (width, (211, 155, 49, 255)),
        (max(2, width - 5), (244, 205, 104, 255)),
        (max(1, width - 10), (255, 234, 154, 215)),
    ]
    for stroke_width, color in strokes:
        if arcs:
            for start, end in arcs:
                draw.arc(box, start=start, end=end, fill=color, width=stroke_width)
        else:
            draw.ellipse(box, outline=color, width=stroke_width)


def make_ring_assets(size=(180, 74)) -> tuple[Image.Image, Image.Image, Image.Image]:
    hi = (size[0] * SCALE, size[1] * SCALE)
    box = tuple(v * SCALE for v in (8, 8, 172, 66))
    width = 13 * SCALE

    shadow = rgba(hi)
    shd = ImageDraw.Draw(shadow)
    shd.ellipse(tuple(v * SCALE for v in (10, 12, 174, 70)), outline=(38, 26, 13, 105), width=18 * SCALE)
    shadow = shadow.filter(ImageFilter.GaussianBlur(5 * SCALE))

    back = rgba(hi)
    bd = ImageDraw.Draw(back)
    gold_stroke(bd, box, width)

    # A metade direita volta a ser desenhada depois da capa: é a parte da
    # argola que passa à frente do furo.
    front = rgba(hi)
    fd = ImageDraw.Draw(front)
    gold_stroke(fd, box, width, arcs=[(286, 360), (0, 74)])
    # Pequeno reflexo frontal, separado do corpo traseiro.
    fd.arc(box, start=314, end=360, fill=(255, 247, 205, 235), width=3 * SCALE)
    fd.arc(box, start=0, end=36, fill=(255, 247, 205, 235), width=3 * SCALE)

    return (
        downsample(back, size),
        downsample(front, size),
        downsample(shadow, size),
    )


def make_hole_shadow(size=(58, 58)) -> Image.Image:
    image = rgba((size[0] * SCALE, size[1] * SCALE))
    d = ImageDraw.Draw(image)
    box = tuple(v * SCALE for v in (14, 14, 44, 44))
    d.rounded_rectangle(box, radius=2 * SCALE, outline=(31, 25, 19, 170), width=5 * SCALE)
    d.line((17 * SCALE, 17 * SCALE, 41 * SCALE, 17 * SCALE), fill=(15, 12, 9, 150), width=4 * SCALE)
    d.line((17 * SCALE, 17 * SCALE, 17 * SCALE, 41 * SCALE), fill=(15, 12, 9, 115), width=4 * SCALE)
    image = image.filter(ImageFilter.GaussianBlur(2.4 * SCALE))
    return downsample(image, size)


def make_elastic(size=(74, 780)) -> tuple[Image.Image, Image.Image]:
    w, h = size
    band = rgba(size)
    d = ImageDraw.Draw(band)
    for x in range(10, w - 10):
        t = (x - 10) / max(1, w - 21)
        edge = abs(t - 0.5) * 2
        r = int(205 - 55 * edge)
        g = int(157 - 63 * edge)
        b = int(58 - 35 * edge)
        d.line((x, 14, x, h - 14), fill=(r, g, b, 255), width=1)
    d.rounded_rectangle((10, 8, w - 11, h - 9), radius=14, outline=(108, 72, 19, 180), width=2)
    d.line((21, 12, 21, h - 13), fill=(255, 224, 142, 125), width=2)
    d.line((27, 12, 27, h - 13), fill=(255, 239, 183, 72), width=1)
    for y in range(22, h - 18, 8):
        d.line((13, y, w - 14, y), fill=(99, 64, 17, 25), width=1)
    band = band.filter(ImageFilter.GaussianBlur(0.35))

    shadow = rgba(size)
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((13, 12, w - 6, h - 4), radius=15, fill=(37, 29, 19, 130))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    return band, shadow


def make_highlights(size=(620, 940)) -> Image.Image:
    image = rgba(size)
    d = ImageDraw.Draw(image)
    d.ellipse((-180, -80, 540, 510), fill=(255, 255, 255, 48))
    d.polygon(((430, 0), (620, 0), (620, 440), (520, 620), (470, 280)), fill=(255, 255, 255, 22))
    return image.filter(ImageFilter.GaussianBlur(70))


def make_reflections(size=(620, 940)) -> Image.Image:
    image = rgba(size)
    d = ImageDraw.Draw(image)
    d.polygon(((75, 0), (180, 0), (560, 940), (430, 940)), fill=(255, 255, 255, 24))
    d.polygon(((260, 0), (306, 0), (620, 635), (620, 760)), fill=(255, 255, 255, 15))
    return image.filter(ImageFilter.GaussianBlur(34))


def make_texture(source: Path | None, size=(620, 940)) -> Image.Image:
    random.seed(113)
    if source and source.exists():
        base = Image.open(source).convert("RGB")
        base = ImageOps.fit(base, size, method=RESAMPLE)
        gray = ImageOps.grayscale(base)
        # Só a micro-variação da imagem gerada é conservada; o fundo opaco é
        # convertido numa layer de baixa opacidade.
        detail = ImageOps.autocontrast(gray, cutoff=3)
        alpha = detail.point(lambda value: max(5, min(42, int(abs(value - 128) * 0.22 + 8))))
        texture = Image.new("RGBA", size, (255, 249, 232, 0))
        texture.putalpha(alpha)
        return texture

    texture = rgba(size)
    d = ImageDraw.Draw(texture)
    for _ in range(7000):
        x = random.randrange(size[0])
        y = random.randrange(size[1])
        alpha = random.randrange(3, 17)
        d.point((x, y), fill=(255, 250, 236, alpha))
    return texture.filter(ImageFilter.GaussianBlur(0.35))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--texture-source", type=Path)
    args = parser.parse_args()
    root: Path = args.output

    save_png(make_background(), root / "background" / "paper.png", 94)
    save_png(make_cover_depth(), root / "base" / "cover-depth.png", 96)
    save_png(make_cover_shadow(), root / "shadows" / "cover.png", 96)

    save_png(make_hole_shadow(), root / "shadows" / "holes.png", 96)

    # Argolas e fitas são derivadas dos masters gerados por IA através de
    # build_generated_hardware.py, para não serem substituídas por desenhos.

    save_png(make_highlights(), root / "overlays" / "highlights.png", 96)
    save_png(make_reflections(), root / "overlays" / "reflections.png", 96)
    save_png(make_texture(args.texture_source), root / "overlays" / "texture.png", 96)


if __name__ == "__main__":
    main()
