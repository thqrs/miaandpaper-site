function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => row.slice().concat(values[index]));
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error("Os quatro pontos não formam uma capa válida.");
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let index = column; index <= size; index += 1) rows[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index += 1) rows[row][index] -= factor * rows[column][index];
    }
  }
  return rows.map((row) => row[size]);
}

export function homographyFromUnitSquare(corners) {
  const sources = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const matrix = [];
  const values = [];
  sources.forEach(([u, v], index) => {
    const [x, y] = corners[index];
    matrix.push([u, v, 1, 0, 0, 0, -x * u, -x * v]); values.push(x);
    matrix.push([0, 0, 0, u, v, 1, -y * u, -y * v]); values.push(y);
  });
  const h = solveLinearSystem(matrix, values);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function invertMatrix3(matrix) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const determinant = a * A + b * B + c * C;
  if (Math.abs(determinant) < 1e-10) throw new Error("Perspectiva inválida: os pontos estão demasiado próximos.");
  return [
    A / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant,
    B / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant,
    C / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant
  ];
}

export function projectPoint(matrix, u, v) {
  const denominator = matrix[6] * u + matrix[7] * v + matrix[8];
  return [
    (matrix[0] * u + matrix[1] * v + matrix[2]) / denominator,
    (matrix[3] * u + matrix[4] * v + matrix[5]) / denominator
  ];
}

export class ProductGeometry {
  constructor(definition, outputWidth = definition.canvasWidth, outputHeight = definition.canvasHeight) {
    this.definition = definition;
    this.scaleX = outputWidth / definition.canvasWidth;
    this.scaleY = outputHeight / definition.canvasHeight;
    const corners = definition.cover.corners;
    this.corners = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]
      .map((point) => [point[0] * this.scaleX, point[1] * this.scaleY]);
    this.matrix = homographyFromUnitSquare(this.corners);
  }

  point(xMm, yMm) {
    return projectPoint(
      this.matrix,
      xMm / this.definition.product.widthMm,
      yMm / this.definition.product.heightMm
    );
  }

  rectangle(centerXMm, centerYMm, widthMm, heightMm) {
    const left = centerXMm - widthMm / 2;
    const right = centerXMm + widthMm / 2;
    const top = centerYMm - heightMm / 2;
    const bottom = centerYMm + heightMm / 2;
    return [this.point(left, top), this.point(right, top), this.point(right, bottom), this.point(left, bottom)];
  }
}
