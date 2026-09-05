"""Gera atlas SVG matemáticos para argolas Wire-O fechadas.

Cada atlas guarda quatro cores com geometria rigorosamente igual. A perspectiva
muda gradualmente ao longo da lombada e os layers traseiro/frontal continuam
separados para a capa passar entre ambos.
"""

from __future__ import annotations

import argparse
from pathlib import Path


COUNTS = (8, 9, 16, 17, 18)
FRAME_WIDTH = 160
UNIT_HEIGHT = 42
PITCH = 81
GAP = 8

PALETTES = (
    ("gold", "#5c3300", "#c77b00", "#fff1a6", "#8b4f00"),
    ("rose", "#52241f", "#bd746b", "#ffe4dc", "#7b3932"),
    ("silver", "#353b40", "#aeb8c0", "#ffffff", "#59636b"),
    ("black", "#050607", "#30363b", "#c2cbd2", "#111519"),
)


def ellipse_path(cx: float, cy: float, rx: float, ry: float, tilt: float) -> str:
    left_y = cy + tilt
    right_y = cy - tilt
    top_left = cy - ry - tilt * 0.35
    top_right = cy - ry + tilt * 0.35
    bottom_right = cy + ry + tilt * 0.35
    bottom_left = cy + ry - tilt * 0.35
    return (
        f"M {cx-rx:.2f} {left_y:.2f} "
        f"C {cx-rx*0.54:.2f} {top_left:.2f}, {cx+rx*0.54:.2f} {top_right:.2f}, {cx+rx:.2f} {right_y:.2f} "
        f"C {cx+rx*0.54:.2f} {bottom_right:.2f}, {cx-rx*0.54:.2f} {bottom_left:.2f}, {cx-rx:.2f} {left_y:.2f} Z"
    )


def ring_paths(count: int) -> list[str]:
    paths: list[str] = []
    for index in range(count):
        position = index / max(1, count - 1)
        vertical = position * 2 - 1
        centre_y = index * PITCH + UNIT_HEIGHT / 2
        radius_x = 74 - abs(vertical) * 1.8
        radius_y = 7.7 + abs(vertical) * 1.5
        separation = 8.0 + abs(vertical) * 0.8
        tilt = vertical * 3.8
        centre_x = 81.5 + vertical * 1.2
        paths.append(ellipse_path(centre_x, centre_y - separation / 2, radius_x, radius_y, tilt))
        paths.append(ellipse_path(centre_x, centre_y + separation / 2, radius_x, radius_y, tilt * 0.92))
    return paths


def gradient_defs() -> str:
    blocks = []
    for name, dark, middle, light, edge in PALETTES:
        blocks.append(
            f"""
    <linearGradient id="{name}-metal" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{edge}"/>
      <stop offset="10%" stop-color="{middle}"/>
      <stop offset="22%" stop-color="{light}"/>
      <stop offset="34%" stop-color="{middle}"/>
      <stop offset="50%" stop-color="{dark}"/>
      <stop offset="66%" stop-color="{middle}"/>
      <stop offset="82%" stop-color="{light}"/>
      <stop offset="91%" stop-color="{middle}"/>
      <stop offset="100%" stop-color="{edge}"/>
    </linearGradient>
    <linearGradient id="{name}-shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="20%" stop-color="#ffffff" stop-opacity="0.88"/>
      <stop offset="38%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="78%" stop-color="#ffffff" stop-opacity="0.76"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
    </linearGradient>"""
        )
    return "".join(blocks)


def wire_group(paths: list[str], palette: tuple[str, str, str, str, str]) -> str:
    name, dark, _middle, _light, _edge = palette
    path_data = " ".join(paths)
    return f"""
    <path d="{path_data}" fill="none" stroke="{dark}" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.94"/>
    <path d="{path_data}" fill="none" stroke="url(#{name}-metal)" stroke-width="4.45" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="{path_data}" fill="none" stroke="url(#{name}-shine)" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>"""


def atlas_svg(count: int, front: bool) -> str:
    height = UNIT_HEIGHT + (count - 1) * PITCH
    width = len(PALETTES) * FRAME_WIDTH + (len(PALETTES) - 1) * GAP
    paths = ring_paths(count)
    clips = []
    groups = []
    for index, palette in enumerate(PALETTES):
        offset = index * (FRAME_WIDTH + GAP)
        clip_id = f"front-{index}"
        if front:
            clips.append(f'<clipPath id="{clip_id}"><rect x="{offset + 83}" y="0" width="35" height="{height}"/></clipPath>')
        clip = f' clip-path="url(#{clip_id})"' if front else ""
        groups.append(f'<g transform="translate({offset} 0)"{clip}>{wire_group(paths, palette)}</g>')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>{gradient_defs()}{''.join(clips)}</defs>
  {''.join(groups)}
</svg>
"""


def shadow_svg(count: int) -> str:
    height = UNIT_HEIGHT + (count - 1) * PITCH
    path_data = " ".join(ring_paths(count))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{FRAME_WIDTH}" height="{height}" viewBox="0 0 {FRAME_WIDTH} {height}">
  <defs>
    <filter id="blur" x="-20%" y="-20%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="3.2"/>
    </filter>
  </defs>
  <path d="{path_data}" transform="translate(4 4)" fill="none" stroke="#17110b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.42" filter="url(#blur)"/>
</svg>
"""


def build_all(root: Path) -> None:
    for count in COUNTS:
        directory = root / "rings" / "atlases" / str(count)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "back-atlas.svg").write_text(atlas_svg(count, front=False), encoding="utf-8")
        (directory / "front-atlas.svg").write_text(atlas_svg(count, front=True), encoding="utf-8")
        (directory / "shadow.svg").write_text(shadow_svg(count), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    build_all(args.output)


if __name__ == "__main__":
    main()
