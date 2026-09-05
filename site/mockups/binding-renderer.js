function strokePath(context, points, colour, width) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  context.bezierCurveTo(points[1][0], points[1][1], points[2][0], points[2][1], points[3][0], points[3][1]);
  context.strokeStyle = colour;
  context.lineWidth = width;
  context.lineCap = "round";
  context.stroke();
}

function polygon(context, points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
  context.closePath();
}

export class BindingRenderer {
  positions(definition) {
    const binding = definition.binding;
    return Array.from({ length: binding.holeCount }, (_, index) => ({
      index,
      xMm: binding.xMm,
      yMm: binding.firstHoleYMm + index * binding.pitchMm
    }));
  }

  renderRingBack(context, definition, geometry) {
    const scale = definition.rings.scale;
    const lineWidth = Math.max(1.4, Math.hypot(geometry.scaleX, geometry.scaleY) * 2.2 * scale);
    context.save();
    this.positions(definition).forEach((position) => {
      const y = position.yMm + definition.rings.offsetYMm;
      const inner = geometry.point(position.xMm + definition.rings.offsetXMm, y);
      const outer = geometry.point(position.xMm - 13 * scale + definition.rings.offsetXMm, y);
      const lift = 9 * Math.sqrt(geometry.scaleX * geometry.scaleY) * scale;
      strokePath(context, [inner, [inner[0] - lift, inner[1] - lift], [outer[0], outer[1] - lift], outer], "rgba(46, 36, 19, .55)", lineWidth + 2);
      strokePath(context, [inner, [inner[0] - lift, inner[1] - lift], [outer[0], outer[1] - lift], outer], getComputedStyle(document.documentElement).getPropertyValue("--gold").trim(), lineWidth);
    });
    context.restore();
  }

  renderHoles(context, definition, geometry) {
    const binding = definition.binding;
    context.save();
    this.positions(definition).forEach((position) => {
      const points = geometry.rectangle(position.xMm, position.yMm, binding.holeWidthMm, binding.holeHeightMm);
      context.save();
      context.shadowColor = "rgba(34, 24, 12, .65)";
      context.shadowBlur = 3 * Math.sqrt(geometry.scaleX * geometry.scaleY);
      polygon(context, points);
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
      context.fill();
      context.restore();
    });
    context.restore();
  }

  renderRingFront(context, definition, geometry) {
    const scale = definition.rings.scale;
    const lineWidth = Math.max(1.4, Math.hypot(geometry.scaleX, geometry.scaleY) * 2.2 * scale);
    context.save();
    this.positions(definition).forEach((position) => {
      const y = position.yMm + definition.rings.offsetYMm;
      const inner = geometry.point(position.xMm + definition.rings.offsetXMm, y);
      const outer = geometry.point(position.xMm - 13 * scale + definition.rings.offsetXMm, y);
      const drop = 9 * Math.sqrt(geometry.scaleX * geometry.scaleY) * scale;
      strokePath(context, [outer, [outer[0], outer[1] + drop], [inner[0] - drop, inner[1] + drop], inner], "rgba(46, 36, 19, .68)", lineWidth + 2);
      strokePath(context, [outer, [outer[0], outer[1] + drop], [inner[0] - drop, inner[1] + drop], inner], getComputedStyle(document.documentElement).getPropertyValue("--gold-soft").trim(), lineWidth);
      strokePath(context, [outer, [outer[0], outer[1] + drop * .55], [inner[0] - drop, inner[1] + drop * .55], inner], "rgba(255, 244, 180, .78)", Math.max(1, lineWidth * .28));
    });
    context.restore();
  }
}
