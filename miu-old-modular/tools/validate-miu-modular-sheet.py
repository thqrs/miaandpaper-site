#!/usr/bin/env python3
"""Valida PNGs e manifestos do protótipo modular da cara do Míu."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def alpha_bbox(alpha: Image.Image) -> tuple[int, int, int, int] | None:
    return alpha.getbbox()


def validate_manifest(manifest_path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"não foi possível ler o JSON: {exc}"]

    if data.get("schemaVersion") != 1:
        fail(errors, "schemaVersion tem de ser 1")

    grid = data.get("grid") or {}
    columns = grid.get("columns")
    rows = grid.get("rows")
    cell_width = grid.get("cellWidth")
    cell_height = grid.get("cellHeight")
    canvas_width = grid.get("canvasWidth")
    canvas_height = grid.get("canvasHeight")
    margin = grid.get("minimumCellMarginPx", 2)

    expected = (8, 8, 128, 128, 1024, 1024)
    actual = (columns, rows, cell_width, cell_height, canvas_width, canvas_height)
    if actual != expected:
        fail(errors, f"grelha incompatível: {actual}; esperado {expected}")
        return errors

    sheets = {sheet.get("id"): sheet for sheet in data.get("sheets", []) if sheet.get("id")}
    if not sheets:
        fail(errors, "o manifesto não declara nenhuma sheet")
        return errors

    part_cells: dict[tuple[str, int, int], str] = {}
    for group_id, group in (data.get("parts") or {}).items():
        for part_id, part in (group or {}).items():
            full_id = f"{group_id}.{part_id}"
            sheet_id = part.get("sheet")
            cell = part.get("cell")
            if sheet_id not in sheets:
                fail(errors, f"{full_id}: sheet desconhecida {sheet_id!r}")
                continue
            if not isinstance(cell, list) or len(cell) != 2:
                fail(errors, f"{full_id}: cell deve ser [linha, coluna]")
                continue
            row, column = cell
            if not isinstance(row, int) or not isinstance(column, int) or not (0 <= row < rows and 0 <= column < columns):
                fail(errors, f"{full_id}: célula fora da grelha: {cell!r}")
                continue
            key = (sheet_id, row, column)
            if key in part_cells:
                fail(errors, f"{full_id}: célula já usada por {part_cells[key]}")
            part_cells[key] = full_id

    reserved = data.get("reservedCells") or []
    reserved_cells: set[tuple[int, int]] = set()
    for cell in reserved:
        if not isinstance(cell, list) or len(cell) != 2 or not all(isinstance(value, int) for value in cell):
            fail(errors, f"reservedCells contém valor inválido: {cell!r}")
            continue
        row, column = cell
        if not (0 <= row < rows and 0 <= column < columns):
            fail(errors, f"célula reservada fora da grelha: {cell!r}")
            continue
        if (row, column) in reserved_cells:
            fail(errors, f"célula reservada repetida: {cell!r}")
        reserved_cells.add((row, column))

    for sheet_id, sheet in sheets.items():
        image_path = manifest_path.parent / str(sheet.get("file", ""))
        if not image_path.is_file():
            fail(errors, f"{sheet_id}: PNG inexistente: {image_path}")
            continue

        if sheet.get("format") != "png" or image_path.suffix.lower() != ".png":
            fail(errors, f"{sheet_id}: o formato tem de ser PNG")
        if sheet.get("width") != canvas_width or sheet.get("height") != canvas_height:
            fail(errors, f"{sheet_id}: dimensões declaradas não são 1024 × 1024")
        declared_hash = str(sheet.get("sha256", "")).lower()
        actual_hash = sha256(image_path)
        if declared_hash != actual_hash:
            fail(errors, f"{sheet_id}: SHA-256 não coincide ({actual_hash})")

        with Image.open(image_path) as source:
            if source.size != (canvas_width, canvas_height):
                fail(errors, f"{sheet_id}: dimensão real {source.size}; esperado {(canvas_width, canvas_height)}")
                continue
            if source.mode != "RGBA":
                fail(errors, f"{sheet_id}: modo {source.mode}; esperado RGBA")
                rgba = source.convert("RGBA")
            else:
                rgba = source.copy()

        alpha = rgba.getchannel("A")
        extrema = alpha.getextrema()
        if extrema[0] != 0 or extrema[1] != 255:
            fail(errors, f"{sheet_id}: alfa sem transparência real completa: extremos {extrema}")

        for row in range(rows):
            for column in range(columns):
                key = (sheet_id, row, column)
                box = (
                    column * cell_width,
                    row * cell_height,
                    (column + 1) * cell_width,
                    (row + 1) * cell_height,
                )
                local_bbox = alpha_bbox(alpha.crop(box))
                mapped = key in part_cells
                is_reserved = (row, column) in reserved_cells

                if mapped and is_reserved:
                    fail(errors, f"{sheet_id} [{row}, {column}]: simultaneamente mapeada e reservada")
                if mapped and local_bbox is None:
                    fail(errors, f"{part_cells[key]}: célula mapeada está vazia")
                if not mapped and not is_reserved and local_bbox is not None:
                    fail(errors, f"{sheet_id} [{row}, {column}]: conteúdo sem peça no JSON")
                if is_reserved and local_bbox is not None:
                    fail(errors, f"{sheet_id} [{row}, {column}]: célula reservada não está vazia")

                if mapped and local_bbox is not None:
                    left, top, right, bottom = local_bbox
                    margins = (left, top, cell_width - right, cell_height - bottom)
                    if min(margins) < margin:
                        fail(
                            errors,
                            f"{part_cells[key]}: margem {margins}; mínimo {margin}px em todos os lados",
                        )

    return errors


def default_manifests() -> list[Path]:
    folder = Path("site/content/brand/miu/experimental")
    return sorted(folder.glob("miu-modular-sheet_*.json"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifests", nargs="*", type=Path, help="manifestos JSON a validar")
    args = parser.parse_args()
    manifests = args.manifests or default_manifests()
    if not manifests:
        print("ERRO: não foram encontrados manifestos.", file=sys.stderr)
        return 2

    has_errors = False
    for manifest in manifests:
        errors = validate_manifest(manifest)
        if errors:
            has_errors = True
            print(f"FALHOU {manifest}")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK {manifest}")
    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
