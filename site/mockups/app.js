import { MockupRenderer } from "./mockup-renderer.js";
import { ExportRenderer } from "./export-renderer.js";
import { MockupEditor } from "./mockup-editor.js";

const root = document.querySelector("[data-mockup-app]");

if (root) {
  try {
    const renderer = new MockupRenderer();
    const exporter = new ExportRenderer(renderer);
    const editor = new MockupEditor(root, renderer, exporter);
    editor.start().catch((error) => {
      const status = root.querySelector("[data-status]");
      status.textContent = error.message;
      status.classList.add("is-error");
    });
  } catch (error) {
    const status = root.querySelector("[data-status]");
    status.textContent = error.message;
    status.classList.add("is-error");
  }
}
