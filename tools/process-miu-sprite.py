#!/usr/bin/env python3
"""Recorta e optimiza as folhas de sprites do Míu.

Uso:
    python tools/process-miu-sprite.py caminho/folha.png
    python tools/process-miu-sprite.py caminho/folha.png --small-input caminho/folha-small.png
    python tools/process-miu-sprite.py caminho/folha.png --sleep-input caminho/folha-sono.png

Guarda cópias WebP das fontes em tools/assets/ e publica as folhas compactas,
os oito frames de cada variante e os manifestos em site/content/brand/miu/.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "site" / "content" / "brand" / "miu"
DEFAULT_SOURCE_COPY = ROOT / "tools" / "assets" / "miu-sprite-source.webp"
DEFAULT_SMALL_SOURCE_COPY = ROOT / "tools" / "assets" / "miu-sprite-small-source.webp"
DEFAULT_SLEEP_SOURCE_COPY = ROOT / "tools" / "assets" / "miu-sprite-sleep-source.webp"
FRAME_NAMES = (
    "calmo",
    "piscar-inicio",
    "piscar-fechado",
    "piscar-fim",
    "inclina-esquerda",
    "inclina-direita",
    "sorriso",
    "orelha",
)
FRAME_DURATIONS_MS = (900, 110, 100, 150, 420, 420, 320, 760)
SLEEP_FRAME_NAMES = ("sonolento", "dorme-abre", "dorme-fecha", "dorme-fundo")
SLEEP_FRAME_DURATIONS_MS = (650, 700, 650, 1100)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Processa a folha 4x2 do Míu para WebP.")
    parser.add_argument("input", type=Path, help="Imagem fonte com transparência.")
    parser.add_argument(
        "--small-input",
        type=Path,
        help="Variante 4x2 de traço pesado para ícones pequenos.",
    )
    parser.add_argument(
        "--sleep-input",
        type=Path,
        help="Folha 4x1 da animação de sono, incluindo os zzz.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-copy", type=Path, default=DEFAULT_SOURCE_COPY)
    parser.add_argument("--small-source-copy", type=Path, default=DEFAULT_SMALL_SOURCE_COPY)
    parser.add_argument("--sleep-source-copy", type=Path, default=DEFAULT_SLEEP_SOURCE_COPY)
    parser.add_argument("--frame-size", type=int, default=192)
    return parser.parse_args()


def square_cell(image: Image.Image, column: int, row: int) -> Image.Image:
    left = round(column * image.width / 4)
    right = round((column + 1) * image.width / 4)
    top = round(row * image.height / 2)
    bottom = round((row + 1) * image.height / 2)
    cell = image.crop((left, top, right, bottom))
    side = min(cell.size)
    x = (cell.width - side) // 2
    y = (cell.height - side) // 2
    return cell.crop((x, y, x + side, y + side))


def remove_light_checkerboard(image: Image.Image) -> Image.Image:
    """Retira um fundo quadriculado neutro muito claro.

    Alguns geradores exportam a grelha de transparência dentro do PNG. A
    ilustração usa cremes, verdes e rosas com crominância; só os cinzentos
    quase brancos da grelha são removidos. Nos painéis claros do Míu, os raros
    brilhos brancos dos olhos que coincidam com esse intervalo mantêm o mesmo
    aspecto visual através da transparência.
    """
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, _ = pixels[x, y]
            if min(red, green, blue) >= 235 and max(red, green, blue) - min(red, green, blue) <= 6:
                pixels[x, y] = (red, green, blue, 0)

    return rgba


def load_source(path: Path, allow_checkerboard: bool) -> Image.Image:
    source = Image.open(path)
    if source.mode in {"RGBA", "LA"} and source.convert("RGBA").getextrema()[3][0] < 255:
        return source.convert("RGBA")
    if allow_checkerboard:
        source = remove_light_checkerboard(source)
        if source.getextrema()[3][0] < 255:
            return source
    raise SystemExit(f"A folha fonte não tem transparência: {path}")


def process_variant(
    source: Image.Image,
    output: Path,
    source_copy: Path,
    frame_size: int,
    variant: str,
) -> None:
    suffix = "" if variant == "normal" else f"-{variant}"
    frame_prefix = "miu" if variant == "normal" else f"miu-{variant}"

    source_copy.parent.mkdir(parents=True, exist_ok=True)
    source.save(source_copy, "WEBP", lossless=True, method=6)

    frames: list[Image.Image] = []
    manifest_frames: list[dict[str, object]] = []
    for index, name in enumerate(FRAME_NAMES):
        cell = square_cell(source, index % 4, index // 4)
        frame = cell.resize((frame_size, frame_size), Image.Resampling.LANCZOS)
        frame_path = output / f"{frame_prefix}-{index + 1:02d}-{name}.webp"
        frame.save(frame_path, "WEBP", quality=90, method=6)
        frames.append(frame)
        manifest_frames.append(
            {
                "index": index,
                "name": name,
                "durationMs": FRAME_DURATIONS_MS[index],
                "file": frame_path.name,
            }
        )

    sheet = Image.new("RGBA", (frame_size * 4, frame_size * 2), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, ((index % 4) * frame_size, (index // 4) * frame_size))
    sheet_path = output / f"miu-sprite{suffix}.webp"
    sheet.save(sheet_path, "WEBP", quality=90, method=6)

    manifest = {
        "schemaVersion": 1,
        "variant": variant,
        "sheet": sheet_path.name,
        "columns": 4,
        "rows": 2,
        "frameWidth": frame_size,
        "frameHeight": frame_size,
        "frames": manifest_frames,
    }
    (output / f"miu-sprite{suffix}.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Fonte ({variant}): {source_copy}")
    print(f"Folha ({variant}): {sheet_path} ({sheet.width}x{sheet.height})")
    print(f"Frames ({variant}): {len(frames)} × {frame_size}px")


def process_sleep_variant(source: Image.Image, output: Path, source_copy: Path, frame_size: int) -> None:
    """Publica a folha 4x1 de sono com o mesmo enquadramento nos quatro frames."""
    source_copy.parent.mkdir(parents=True, exist_ok=True)
    source.save(source_copy, "WEBP", lossless=True, method=6)

    cells = []
    boxes = []
    for column in range(4):
        left = round(column * source.width / 4)
        right = round((column + 1) * source.width / 4)
        cell = source.crop((left, 0, right, source.height))
        box = cell.getchannel("A").getbbox()
        if box is None:
            raise SystemExit(f"O frame de sono {column + 1} está vazio.")
        cells.append(cell)
        boxes.append(box)

    union = (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )
    crop_width = union[2] - union[0]
    crop_height = union[3] - union[1]
    padding = max(8, round(max(crop_width, crop_height) * 0.04))
    side = max(crop_width, crop_height) + padding * 2

    frames = []
    manifest_frames = []
    for index, (name, cell) in enumerate(zip(SLEEP_FRAME_NAMES, cells)):
        crop = cell.crop(union)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.alpha_composite(crop, ((side - crop_width) // 2, (side - crop_height) // 2))
        frame = square.resize((frame_size, frame_size), Image.Resampling.LANCZOS)
        frame_path = output / f"miu-sleep-{index + 1:02d}-{name}.webp"
        frame.save(frame_path, "WEBP", quality=90, method=6)
        frames.append(frame)
        manifest_frames.append(
            {
                "index": index,
                "name": name,
                "durationMs": SLEEP_FRAME_DURATIONS_MS[index],
                "file": frame_path.name,
            }
        )

    sheet = Image.new("RGBA", (frame_size * 4, frame_size), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * frame_size, 0))
    sheet_path = output / "miu-sprite-sleep.webp"
    sheet.save(sheet_path, "WEBP", quality=90, method=6)
    manifest = {
        "schemaVersion": 1,
        "variant": "sleep",
        "sheet": sheet_path.name,
        "columns": 4,
        "rows": 1,
        "frameWidth": frame_size,
        "frameHeight": frame_size,
        "frames": manifest_frames,
    }
    (output / "miu-sprite-sleep.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Fonte (sleep): {source_copy}")
    print(f"Folha (sleep): {sheet_path} ({sheet.width}x{sheet.height})")
    print(f"Frames (sleep): {len(frames)} × {frame_size}px")


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    source = load_source(args.input, allow_checkerboard=False)
    process_variant(source, args.output, args.source_copy, args.frame_size, "normal")

    if args.small_input:
        small_source = load_source(args.small_input, allow_checkerboard=True)
        process_variant(
            small_source,
            args.output,
            args.small_source_copy,
            args.frame_size,
            "small",
        )

    if args.sleep_input:
        sleep_source = load_source(args.sleep_input, allow_checkerboard=True)
        process_sleep_variant(sleep_source, args.output, args.sleep_source_copy, args.frame_size)


if __name__ == "__main__":
    main()
