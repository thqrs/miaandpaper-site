#!/usr/bin/env python3
"""Recorta uma grelha 5x5 de ícones e normaliza cada célula num PNG quadrado."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ICON_NAMES = (
    "inicio",
    "grupo-personalizados",
    "grupo-cadernos-papelaria",
    "grupo-crachas-imanes",
    "grupo-colecoes-ofertas",
    "personalizacao",
    "molduras",
    "cadernos",
    "mini-cadernos",
    "blocos-a6",
    "bloquinhos",
    "postais",
    "agendas",
    "stickers",
    "marcadores",
    "crachas",
    "imanes",
    "imanes-recortados",
    "congressos",
    "ofertas",
    "catalogo",
    "contacto",
    "instagram",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--canvas", type=int, default=128)
    parser.add_argument("--padding", type=int, default=10)
    parser.add_argument("--cell-guard", type=int, default=8)
    parser.add_argument("--min-component-area", type=int, default=24)
    parser.add_argument("--drop-edge-components", action="store_true")
    parser.add_argument("--adaptive-grid", action="store_true")
    return parser.parse_args()


def cell_bounds(
    index: int,
    width: int,
    height: int,
    x_boundaries: list[int] | None = None,
    y_boundaries: list[int] | None = None,
) -> tuple[int, int, int, int]:
    column = index % 5
    row = index // 5
    if x_boundaries is not None and y_boundaries is not None:
        return (
            x_boundaries[column],
            y_boundaries[row],
            x_boundaries[column + 1],
            y_boundaries[row + 1],
        )
    return (
        round(column * width / 5),
        round(row * height / 5),
        round((column + 1) * width / 5),
        round((row + 1) * height / 5),
    )


def adaptive_axis_boundaries(
    alpha: Image.Image,
    axis: str,
    sections: int = 5,
    search_radius: int = 110,
) -> list[int]:
    width, height = alpha.size
    length = width if axis == "x" else height
    cross_length = height if axis == "x" else width
    pixels = alpha.load()
    projection: list[int] = []

    for position in range(length):
        if axis == "x":
            projection.append(sum(pixels[position, cross] > 24 for cross in range(cross_length)))
        else:
            projection.append(sum(pixels[cross, position] > 24 for cross in range(cross_length)))

    boundaries = [0]
    for section in range(1, sections):
        expected = round(section * length / sections)
        start = max(boundaries[-1] + 1, expected - search_radius)
        stop = min(length - 1, expected + search_radius)
        runs: list[tuple[int, int]] = []
        run_start: int | None = None
        for position in range(start, stop + 1):
            if projection[position] == 0 and run_start is None:
                run_start = position
            elif projection[position] != 0 and run_start is not None:
                runs.append((run_start, position - 1))
                run_start = None
        if run_start is not None:
            runs.append((run_start, stop))

        if runs:
            longest = max(end - begin for begin, end in runs)
            candidates = [run for run in runs if run[1] - run[0] == longest]
            begin, end = min(
                candidates,
                key=lambda run: abs(((run[0] + run[1]) / 2) - expected),
            )
            boundary = round((begin + end) / 2)
        else:
            boundary = min(range(start, stop + 1), key=lambda position: projection[position])
        boundaries.append(boundary)
    boundaries.append(length)
    return boundaries


def remove_tiny_components(
    image: Image.Image,
    minimum_area: int,
    drop_edge_components: bool,
) -> Image.Image:
    if minimum_area <= 1 and not drop_edge_components:
        return image

    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = image.size
    visited: set[tuple[int, int]] = set()
    remove: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            if (x, y) in visited or pixels[x, y] <= 12:
                continue
            stack = [(x, y)]
            component: list[tuple[int, int]] = []
            visited.add((x, y))
            while stack:
                current_x, current_y = stack.pop()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        point = (next_x, next_y)
                        if point in visited or pixels[next_x, next_y] <= 12:
                            continue
                        visited.add(point)
                        stack.append(point)
            touches_edge = any(
                point_x == 0 or point_y == 0 or point_x == width - 1 or point_y == height - 1
                for point_x, point_y in component
            )
            if len(component) < minimum_area or (drop_edge_components and touches_edge):
                remove.extend(component)

    if remove:
        cleaned_alpha = alpha.copy()
        cleaned_pixels = cleaned_alpha.load()
        for x, y in remove:
            cleaned_pixels[x, y] = 0
        image = image.copy()
        image.putalpha(cleaned_alpha)
    return image


def normalized_icon(
    cell: Image.Image,
    canvas_size: int,
    padding: int,
    minimum_component_area: int,
    drop_edge_components: bool,
) -> Image.Image:
    cell = remove_tiny_components(cell, minimum_component_area, drop_edge_components)
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("A célula não contém píxeis visíveis.")

    icon = cell.crop(bounds)
    available = max(1, canvas_size - 2 * padding)
    scale = min(available / icon.width, available / icon.height)
    target = (
        max(1, round(icon.width * scale)),
        max(1, round(icon.height * scale)),
    )
    icon = icon.resize(target, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    position = ((canvas_size - icon.width) // 2, (canvas_size - icon.height) // 2)
    canvas.alpha_composite(icon, position)
    return canvas


def main() -> None:
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    x_boundaries = None
    y_boundaries = None
    if args.adaptive_grid:
        alpha = source.getchannel("A")
        x_boundaries = adaptive_axis_boundaries(alpha, "x")
        y_boundaries = adaptive_axis_boundaries(alpha, "y")
        print(f"Limites adaptativos X={x_boundaries} Y={y_boundaries}")

    for index, name in enumerate(ICON_NAMES):
        cell = source.crop(
            cell_bounds(
                index,
                source.width,
                source.height,
                x_boundaries,
                y_boundaries,
            )
        )
        guard = max(0, min(args.cell_guard, (min(cell.size) - 1) // 2))
        if guard:
            cell = cell.crop((guard, guard, cell.width - guard, cell.height - guard))
        icon = normalized_icon(
            cell,
            args.canvas,
            args.padding,
            args.min_component_area,
            args.drop_edge_components,
        )
        icon.save(args.output_dir / f"{name}.png", optimize=True)

    print(f"Criados {len(ICON_NAMES)} ícones em {args.output_dir}")


if __name__ == "__main__":
    main()
