#!/usr/bin/env python3
"""
Fast image rename + tag/categorize tool

What it does:
- Opens the first image in the chosen folder, similar to a simple image viewer
- Defaults to the folder where this script is located
- Optional checkbox to include subfolders
- Left / Right arrows move through images
- F1-F12 toggle tags on/off for the current image
- Tags are editable in their own boxes
- File name is editable
- Enter saves the current file name + selected tags, then moves to the next image
- Saves tag data to a companion JSON file named "_image_tags.json" in the chosen root folder

Requirements:
    pip install pillow
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageOps, ImageTk


IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".tif",
    ".tiff",
}

DEFAULT_TAGS = [
    "caderno",
    "capa_principal",
    "capa",
    "interior",
    "matte",
    "glossy",
    "glitter",
    "holografico",
    "marcador",
    "pin",
    "pack_pioneiro",
    "pack_normal",
]

COMPANION_FILENAME = "_image_tags.json"


def script_folder() -> Path:
    return Path(__file__).resolve().parent


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS


def safe_relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def load_companion(path: Path) -> dict:
    if not path.exists():
        return {
            "version": 1,
            "updated": now_iso(),
            "tag_keys": {f"F{i + 1}": tag for i, tag in enumerate(DEFAULT_TAGS)},
            "images": {},
        }

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        backup = path.with_name(path.stem + "_broken_backup" + path.suffix)
        path.rename(backup)
        messagebox.showwarning(
            "Companion file was invalid",
            f"The companion file could not be read, so it was renamed to:\n\n{backup}\n\nA new one will be created."
        )
        return {
            "version": 1,
            "updated": now_iso(),
            "tag_keys": {f"F{i + 1}": tag for i, tag in enumerate(DEFAULT_TAGS)},
            "images": {},
        }

    data.setdefault("version", 1)
    data.setdefault("updated", now_iso())
    data.setdefault("tag_keys", {})
    data.setdefault("images", {})

    for i, tag in enumerate(DEFAULT_TAGS, start=1):
        data["tag_keys"].setdefault(f"F{i}", tag)

    return data


class ImageTaggerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Fast Image Rename + Tagger")
        self.root.geometry("1120x760")
        self.root.minsize(880, 620)

        self.folder_var = tk.StringVar(value=str(script_folder()))
        self.include_subfolders_var = tk.BooleanVar(value=False)
        self.filename_var = tk.StringVar(value="")
        self.status_var = tk.StringVar(value="Ready.")

        self.image_paths: list[Path] = []
        self.current_index = 0
        self.current_photo = None

        self.tag_text_vars: list[tk.StringVar] = []
        self.tag_selected_vars: list[tk.BooleanVar] = []
        self.tag_rows: list[tk.Frame] = []
        self.tag_entries: list[tk.Entry] = []

        self.companion_path = self.current_folder() / COMPANION_FILENAME
        self.companion_data = load_companion(self.companion_path)

        self.build_ui()
        self.bind_keys()
        self.refresh_images(load_first=True)

    def current_folder(self) -> Path:
        return Path(self.folder_var.get()).expanduser().resolve()

    def build_ui(self):
        outer = tk.Frame(self.root, padx=12, pady=12)
        outer.pack(fill="both", expand=True)

        folder_frame = tk.LabelFrame(outer, text="Folder", padx=10, pady=8)
        folder_frame.pack(fill="x")

        folder_entry = tk.Entry(folder_frame, textvariable=self.folder_var)
        folder_entry.pack(side="left", fill="x", expand=True)

        tk.Button(folder_frame, text="Choose folder...", command=self.choose_folder).pack(side="left", padx=(8, 0))

        tk.Checkbutton(
            folder_frame,
            text="Include subfolders",
            variable=self.include_subfolders_var,
            command=self.refresh_keep_current,
        ).pack(side="left", padx=(12, 0))

        tk.Button(folder_frame, text="Refresh", command=self.refresh_keep_current).pack(side="left", padx=(8, 0))

        main = tk.Frame(outer)
        main.pack(fill="both", expand=True, pady=(10, 0))

        viewer_frame = tk.LabelFrame(main, text="Image", padx=8, pady=8)
        viewer_frame.pack(side="left", fill="both", expand=True)

        self.image_label = tk.Label(
            viewer_frame,
            text="No image loaded",
            bg="#222222",
            fg="white",
            anchor="center",
        )
        self.image_label.pack(fill="both", expand=True)

        side = tk.Frame(main)
        side.pack(side="right", fill="y", padx=(10, 0))

        name_frame = tk.LabelFrame(side, text="File name", padx=10, pady=8)
        name_frame.pack(fill="x")

        self.filename_entry = tk.Entry(name_frame, textvariable=self.filename_var, width=42)
        self.filename_entry.pack(fill="x")
        self.filename_entry.bind("<Return>", self.save_and_next_event)

        hint = tk.Label(
            name_frame,
            text="Edit name, then press Enter to save and move next.",
            anchor="w",
            justify="left",
        )
        hint.pack(fill="x", pady=(5, 0))

        tags_frame = tk.LabelFrame(side, text="Tags — F1 to F12 toggles", padx=10, pady=8)
        tags_frame.pack(fill="x", pady=(10, 0))

        for i in range(12):
            fkey = f"F{i + 1}"
            tag_name = self.companion_data["tag_keys"].get(fkey, DEFAULT_TAGS[i])

            selected_var = tk.BooleanVar(value=False)
            text_var = tk.StringVar(value=tag_name)

            self.tag_selected_vars.append(selected_var)
            self.tag_text_vars.append(text_var)

            row = tk.Frame(tags_frame)
            row.pack(fill="x", pady=2)

            tk.Label(row, text=fkey, width=4, anchor="w").pack(side="left")

            cb = tk.Checkbutton(row, variable=selected_var, command=self.update_tag_row_colours)
            cb.pack(side="left")

            entry = tk.Entry(row, textvariable=text_var, width=26)
            entry.pack(side="left", fill="x", expand=True, padx=(4, 0))
            entry.bind("<Return>", self.save_and_next_event)

            self.tag_rows.append(row)
            self.tag_entries.append(entry)

            text_var.trace_add("write", lambda *_: self.save_tag_key_names_only())

        controls_frame = tk.LabelFrame(side, text="Controls", padx=10, pady=8)
        controls_frame.pack(fill="x", pady=(10, 0))

        tk.Button(controls_frame, text="← Previous", command=self.previous_image).pack(side="left", fill="x", expand=True)
        tk.Button(controls_frame, text="Save + Next ↵", command=self.save_and_next).pack(side="left", fill="x", expand=True, padx=(8, 0))
        tk.Button(controls_frame, text="Next →", command=self.next_image).pack(side="left", fill="x", expand=True, padx=(8, 0))

        info = tk.Label(
            side,
            text=(
                "Keyboard:\n"
                "• Left / Right = previous / next image\n"
                "• F1-F12 = add/remove tag\n"
                "• Enter = save + next\n\n"
                "Tags are saved in:\n"
                f"{COMPANION_FILENAME}"
            ),
            anchor="w",
            justify="left",
        )
        info.pack(fill="x", pady=(10, 0))

        self.status_label = tk.Label(outer, textvariable=self.status_var, anchor="w")
        self.status_label.pack(fill="x", pady=(8, 0))

        self.root.bind("<Configure>", self.on_resize)

    def bind_keys(self):
        self.root.bind_all("<F1>", lambda e: self.toggle_tag(0))
        self.root.bind_all("<F2>", lambda e: self.toggle_tag(1))
        self.root.bind_all("<F3>", lambda e: self.toggle_tag(2))
        self.root.bind_all("<F4>", lambda e: self.toggle_tag(3))
        self.root.bind_all("<F5>", lambda e: self.toggle_tag(4))
        self.root.bind_all("<F6>", lambda e: self.toggle_tag(5))
        self.root.bind_all("<F7>", lambda e: self.toggle_tag(6))
        self.root.bind_all("<F8>", lambda e: self.toggle_tag(7))
        self.root.bind_all("<F9>", lambda e: self.toggle_tag(8))
        self.root.bind_all("<F10>", lambda e: self.toggle_tag(9))
        self.root.bind_all("<F11>", lambda e: self.toggle_tag(10))
        self.root.bind_all("<F12>", lambda e: self.toggle_tag(11))

        self.root.bind_all("<Return>", self.save_and_next_event)
        self.root.bind_all("<Left>", self.previous_image_event)
        self.root.bind_all("<Right>", self.next_image_event)

    def focus_is_text_entry(self) -> bool:
        widget = self.root.focus_get()
        return isinstance(widget, tk.Entry)

    def previous_image_event(self, event=None):
        # Let the arrows work normally while editing a text box.
        if self.focus_is_text_entry():
            return None
        self.previous_image()
        return "break"

    def next_image_event(self, event=None):
        # Let the arrows work normally while editing a text box.
        if self.focus_is_text_entry():
            return None
        self.next_image()
        return "break"

    def choose_folder(self):
        selected = filedialog.askdirectory(initialdir=self.folder_var.get() or str(script_folder()))
        if not selected:
            return

        self.save_current_without_moving(show_errors=False)
        self.folder_var.set(selected)
        self.companion_path = self.current_folder() / COMPANION_FILENAME
        self.companion_data = load_companion(self.companion_path)
        self.load_tag_key_names_from_companion()
        self.refresh_images(load_first=True)

    def refresh_keep_current(self):
        current = self.current_path() if self.image_paths else None
        self.save_current_without_moving(show_errors=False)
        self.companion_path = self.current_folder() / COMPANION_FILENAME
        self.companion_data = load_companion(self.companion_path)
        self.load_tag_key_names_from_companion()
        self.refresh_images(load_first=False)

        if current:
            try:
                self.current_index = self.image_paths.index(current)
            except ValueError:
                self.current_index = min(self.current_index, max(0, len(self.image_paths) - 1))

        self.load_current_image()

    def load_tag_key_names_from_companion(self):
        if not self.tag_text_vars:
            return

        for i, text_var in enumerate(self.tag_text_vars, start=1):
            text_var.set(self.companion_data["tag_keys"].get(f"F{i}", DEFAULT_TAGS[i - 1]))

    def refresh_images(self, load_first: bool):
        folder = self.current_folder()
        include_subfolders = self.include_subfolders_var.get()

        if not folder.exists() or not folder.is_dir():
            self.image_paths = []
            self.status_var.set("Folder does not exist.")
            self.load_current_image()
            return

        iterator = folder.rglob("*") if include_subfolders else folder.glob("*")
        self.image_paths = sorted(
            [
                path for path in iterator
                if is_image_file(path) and path.name != COMPANION_FILENAME
            ],
            key=lambda p: safe_relative(p, folder).lower()
        )

        if load_first:
            self.current_index = 0
        else:
            self.current_index = min(self.current_index, max(0, len(self.image_paths) - 1))

        self.load_current_image()

    def current_path(self) -> Path | None:
        if not self.image_paths:
            return None
        if self.current_index < 0 or self.current_index >= len(self.image_paths):
            return None
        return self.image_paths[self.current_index]

    def companion_key_for_current(self) -> str | None:
        path = self.current_path()
        if not path:
            return None
        return safe_relative(path, self.current_folder())

    def selected_tag_names(self) -> list[str]:
        tags = []
        for selected_var, text_var in zip(self.tag_selected_vars, self.tag_text_vars):
            tag = text_var.get().strip()
            if selected_var.get() and tag:
                tags.append(tag)

        # Remove duplicates while preserving order
        seen = set()
        unique = []
        for tag in tags:
            if tag not in seen:
                seen.add(tag)
                unique.append(tag)
        return unique

    def save_tag_key_names_only(self):
        if not hasattr(self, "companion_data"):
            return

        for i, text_var in enumerate(self.tag_text_vars, start=1):
            self.companion_data.setdefault("tag_keys", {})[f"F{i}"] = text_var.get().strip()

        self.companion_data["updated"] = now_iso()

        try:
            self.write_companion()
        except Exception:
            # Avoid interrupting typing if the folder is temporarily unavailable.
            pass

    def write_companion(self):
        self.companion_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.companion_path.with_suffix(".tmp")
        temp_path.write_text(
            json.dumps(self.companion_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        temp_path.replace(self.companion_path)

    def load_tags_for_current(self):
        key = self.companion_key_for_current()
        saved_tags = []

        if key:
            saved_tags = self.companion_data.get("images", {}).get(key, {}).get("tags", [])

        saved_set = set(saved_tags)
        for selected_var, text_var in zip(self.tag_selected_vars, self.tag_text_vars):
            selected_var.set(text_var.get().strip() in saved_set)

        self.update_tag_row_colours()

    def update_tag_row_colours(self):
        # Selected tags get a soft highlight in the editable tag box.
        for selected_var, entry in zip(self.tag_selected_vars, self.tag_entries):
            try:
                if selected_var.get():
                    entry.configure(bg="#fff2b3")
                else:
                    entry.configure(bg="white")
            except tk.TclError:
                pass

    def load_current_image(self):
        path = self.current_path()

        if not path:
            self.image_label.config(image="", text="No image found")
            self.filename_var.set("")
            for selected_var in self.tag_selected_vars:
                selected_var.set(False)
            self.status_var.set("No images found in this folder.")
            return

        self.filename_var.set(path.name)
        self.load_tags_for_current()
        self.render_image()

        key = safe_relative(path, self.current_folder())
        self.status_var.set(f"{self.current_index + 1}/{len(self.image_paths)} — {key}")
        self.root.focus_set()

    def render_image(self):
        path = self.current_path()
        if not path:
            return

        try:
            with Image.open(path) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail(self.available_image_size(), Image.Resampling.LANCZOS)
                self.current_photo = ImageTk.PhotoImage(img)

            self.image_label.config(image=self.current_photo, text="")
        except Exception as exc:
            self.current_photo = None
            self.image_label.config(image="", text=f"Could not load image:\n{path.name}\n\n{exc}")

    def available_image_size(self) -> tuple[int, int]:
        width = max(300, self.image_label.winfo_width() - 20)
        height = max(300, self.image_label.winfo_height() - 20)
        return width, height

    def on_resize(self, event=None):
        # Re-render only after the widget has real dimensions.
        if self.image_label.winfo_width() > 50 and self.image_label.winfo_height() > 50:
            self.root.after_idle(self.render_image)

    def toggle_tag(self, index: int):
        if index < 0 or index >= len(self.tag_selected_vars):
            return "break"

        self.tag_selected_vars[index].set(not self.tag_selected_vars[index].get())
        tag = self.tag_text_vars[index].get().strip() or f"F{index + 1}"
        state = "added" if self.tag_selected_vars[index].get() else "removed"

        path = self.current_path()
        if path:
            self.status_var.set(f"{state}: {tag} — {path.name}")

        return "break"

    def save_and_next_event(self, event=None):
        self.save_and_next()
        return "break"

    def save_current_without_moving(self, show_errors: bool = True) -> bool:
        path = self.current_path()
        if not path:
            return True

        folder = self.current_folder()
        old_key = safe_relative(path, folder)
        new_name = self.filename_var.get().strip()

        if not new_name:
            if show_errors:
                messagebox.showerror("Invalid file name", "The file name cannot be empty.")
            return False

        # Do not allow path separators in the name box.
        if "/" in new_name or "\\" in new_name:
            if show_errors:
                messagebox.showerror(
                    "Invalid file name",
                    "Use only a file name here, not a folder path."
                )
            return False

        # If the user removes the extension, keep the original extension.
        try:
            new_path = path.with_name(new_name)
        except ValueError as exc:
            if show_errors:
                messagebox.showerror("Invalid file name", str(exc))
            return False

        if not new_path.suffix:
            new_path = new_path.with_suffix(path.suffix)

        if new_path != path:
            if new_path.exists():
                if show_errors:
                    messagebox.showerror(
                        "File already exists",
                        f"This file already exists:\n\n{new_path.name}\n\nChoose another name."
                    )
                return False

            try:
                path.rename(new_path)
            except Exception as exc:
                if show_errors:
                    messagebox.showerror("Rename failed", f"Could not rename file:\n\n{exc}")
                return False

            self.image_paths[self.current_index] = new_path

            new_key = safe_relative(new_path, folder)

            # Move existing metadata from old relative path to new relative path.
            images = self.companion_data.setdefault("images", {})
            existing = images.pop(old_key, {})
            images[new_key] = existing

            path = new_path
        else:
            new_key = old_key

        for i, text_var in enumerate(self.tag_text_vars, start=1):
            self.companion_data.setdefault("tag_keys", {})[f"F{i}"] = text_var.get().strip()

        self.companion_data.setdefault("images", {})[new_key] = {
            "file": path.name,
            "relative_path": new_key,
            "folder": safe_relative(path.parent, folder),
            "tags": self.selected_tag_names(),
            "updated": now_iso(),
        }
        self.companion_data["updated"] = now_iso()

        try:
            self.write_companion()
        except Exception as exc:
            if show_errors:
                messagebox.showerror("Save failed", f"Could not save companion file:\n\n{exc}")
            return False

        return True

    def save_and_next(self):
        if not self.save_current_without_moving(show_errors=True):
            return

        self.next_image()

    def previous_image(self):
        if not self.image_paths:
            return

        self.current_index = (self.current_index - 1) % len(self.image_paths)
        self.load_current_image()

    def next_image(self):
        if not self.image_paths:
            return

        self.current_index = (self.current_index + 1) % len(self.image_paths)
        self.load_current_image()


def main():
    try:
        root = tk.Tk()
        app = ImageTaggerApp(root)
        root.mainloop()
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
