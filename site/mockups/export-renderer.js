export class ExportRenderer {
  constructor(renderer) { this.renderer = renderer; }

  async exportPng(definition, assets, width, height) {
    const canvas = document.createElement("canvas");
    this.renderer.render(canvas, definition, assets, width, height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível criar o PNG.")), "image/png");
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${definition.id || "mockup"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
