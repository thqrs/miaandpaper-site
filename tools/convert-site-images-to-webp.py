#!/usr/bin/env python3
"""Converte imagens do diretório site/ para WebP e atualiza referências.

O processo falha antes de apagar os originais se alguma conversão ou
verificação não for bem-sucedida. Colisões de nomes recebem um sufixo com a
extensão de origem (por exemplo, foto.png -> foto-png.webp).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SITE = (ROOT / "site").resolve()
SOURCE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".avif"}
TEXT_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".json", ".php", ".txt", ".xml",
    ".md", ".yml", ".yaml", ".csv", ".svg", ".sql", ".bat", ".ps1",
}


def relative(path: Path) -> str:
    return path.relative_to(SITE).as_posix()


def target_map(sources: list[Path]) -> dict[Path, Path]:
    mapping: dict[Path, Path] = {}
    claimed = {p.relative_to(SITE).as_posix().casefold() for p in SITE.rglob("*.webp")}
    rank = {".jpg": 0, ".jpeg": 1, ".png": 2, ".gif": 3, ".avif": 4}
    for source in sorted(sources, key=lambda p: (str(p.parent).casefold(), p.stem.casefold(), rank[p.suffix.lower()], p.name.casefold())):
        candidate = source.with_suffix(".webp")
        key = relative(candidate).casefold()
        if key in claimed:
            suffix = source.suffix.lower().lstrip(".")
            candidate = source.with_name(f"{source.stem}-{suffix}.webp")
            number = 2
            while relative(candidate).casefold() in claimed:
                candidate = source.with_name(f"{source.stem}-{suffix}-{number}.webp")
                number += 1
        claimed.add(relative(candidate).casefold())
        mapping[source] = candidate
    return mapping


def convert(source: Path, target: Path) -> tuple[int, int]:
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        size = image.size
        target.parent.mkdir(parents=True, exist_ok=True)
        has_alpha = image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info)
        if has_alpha:
            image = image.convert("RGBA")
            image.save(target, "WEBP", lossless=True, method=4)
        else:
            image = image.convert("RGB")
            image.save(target, "WEBP", quality=86, method=4)
    with Image.open(target) as check:
        if check.format != "WEBP" or check.size != size:
            raise RuntimeError(f"Verificação falhou: {relative(source)}")
    return size


def replacement_variants(old: str, new: str) -> list[tuple[str, str]]:
    pairs = [(old, new), (old.replace("/", "\\"), new.replace("/", "\\"))]
    encoded_old = quote(old, safe="/.:@-_")
    encoded_new = quote(new, safe="/.:@-_")
    if encoded_old != old:
        pairs.append((encoded_old, encoded_new))
    return pairs


def rewrite_references(mapping: dict[Path, Path]) -> tuple[int, int]:
    variants: list[tuple[str, str]] = []
    for source, target in mapping.items():
        variants.extend(replacement_variants(relative(source), relative(target)))
    variants.sort(key=lambda pair: len(pair[0]), reverse=True)

    changed_files = 0
    replacements = 0
    for path in SITE.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        original = text
        for old, new in variants:
            text, count = re.subn(re.escape(old), lambda _match, value=new: value, text, flags=re.IGNORECASE)
            replacements += count
        if text != original:
            path.write_text(text, encoding="utf-8", newline="")
            changed_files += 1
    return changed_files, replacements


def main() -> int:
    if SITE.parent != ROOT or not SITE.is_dir():
        raise RuntimeError("A pasta site/ não foi validada.")

    sources = [p for p in SITE.rglob("*") if p.is_file() and p.suffix.lower() in SOURCE_EXTENSIONS]
    mapping = target_map(sources)
    before_bytes = sum(path.stat().st_size for path in sources)
    created: list[Path] = []
    print(f"A converter {len(sources)} imagens…", flush=True)
    try:
        for index, (source, target) in enumerate(mapping.items(), 1):
            convert(source, target)
            created.append(target)
            if index % 50 == 0 or index == len(mapping):
                print(f"  {index}/{len(mapping)}", flush=True)
    except Exception:
        for target in created:
            if target.is_file():
                target.unlink()
        raise

    changed_files, replacements = rewrite_references(mapping)

    # Só depois de todos os WebP existirem, abrirem e terem as dimensões
    # certas é que os ficheiros de origem são removidos.
    for source, target in mapping.items():
        if not target.is_file():
            raise RuntimeError(f"WebP em falta antes da limpeza: {relative(target)}")
    for source in mapping:
        source.unlink()

    after_bytes = sum(path.stat().st_size for path in created)
    report = {
        "converted": len(mapping),
        "referencesRewritten": replacements,
        "textFilesChanged": changed_files,
        "sourceBytes": before_bytes,
        "webpBytes": after_bytes,
        "savedBytes": before_bytes - after_bytes,
        "collisions": [
            {"source": relative(source), "target": relative(target)}
            for source, target in mapping.items()
            if target.stem != source.stem
        ],
    }
    (ROOT / "webp_migration_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERRO: {error}", file=sys.stderr, flush=True)
        raise
