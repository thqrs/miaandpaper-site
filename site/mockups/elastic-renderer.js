export class ElasticRenderer {
  render(context, definition, geometry) {
    if (!definition.elastic || !definition.elastic.enabled) return;
    const elastic = definition.elastic;
    const topLeft = geometry.point(elastic.xMm - elastic.widthMm / 2, 0);
    const topRight = geometry.point(elastic.xMm + elastic.widthMm / 2, 0);
    const bottomRight = geometry.point(elastic.xMm + elastic.widthMm / 2, definition.product.heightMm);
    const bottomLeft = geometry.point(elastic.xMm - elastic.widthMm / 2, definition.product.heightMm);
    context.save();
    context.globalAlpha = elastic.opacity;
    context.beginPath();
    context.moveTo(topLeft[0], topLeft[1]);
    context.lineTo(topRight[0], topRight[1]);
    context.lineTo(bottomRight[0], bottomRight[1]);
    context.lineTo(bottomLeft[0], bottomLeft[1]);
    context.closePath();
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim();
    context.shadowColor = "rgba(44, 30, 12, .36)";
    context.shadowBlur = 5 * Math.sqrt(geometry.scaleX * geometry.scaleY);
    context.fill();
    context.restore();
  }
}
