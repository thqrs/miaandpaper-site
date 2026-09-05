import { ProductGeometry } from "./product-geometry.js";
import { CoverTransform } from "./cover-transform.js";
import { BindingRenderer } from "./binding-renderer.js";
import { ElasticRenderer } from "./elastic-renderer.js";

function drawBase(context, image, width, height) {
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "white";
  context.fillRect(0, 0, width, height);
  if (!image) return;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export class MockupRenderer {
  constructor() {
    this.coverTransform = new CoverTransform();
    this.bindingRenderer = new BindingRenderer();
    this.elasticRenderer = new ElasticRenderer();
  }

  render(target, definition, assets, width = definition.canvasWidth, height = definition.canvasHeight) {
    target.width = Math.round(width);
    target.height = Math.round(height);
    const context = target.getContext("2d", { alpha: false });
    const geometry = new ProductGeometry(definition, target.width, target.height);
    drawBase(context, assets.baseImage, target.width, target.height);
    this.bindingRenderer.renderRingBack(context, definition, geometry);
    const coverLayer = this.coverTransform.render(assets.coverImage, geometry, target.width, target.height, definition.coverArt);
    context.drawImage(coverLayer, 0, 0);
    this.bindingRenderer.renderHoles(context, definition, geometry);
    this.bindingRenderer.renderRingFront(context, definition, geometry);
    this.elasticRenderer.render(context, definition, geometry);
    return target;
  }
}
