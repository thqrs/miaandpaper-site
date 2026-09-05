import { homographyFromUnitSquare, invertMatrix3 } from "./product-geometry.js";

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Erro no shader.");
  return shader;
}

function createProgram(gl) {
  const vertex = compile(gl, gl.VERTEX_SHADER, `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, `
    precision highp float;
    uniform sampler2D u_texture;
    uniform mat3 u_inverse;
    uniform float u_canvasHeight;
    void main() {
      vec3 source = u_inverse * vec3(gl_FragCoord.x, u_canvasHeight - gl_FragCoord.y, 1.0);
      vec2 uv = source.xy / source.z;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      gl_FragColor = texture2D(u_texture, uv);
    }
  `);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Erro ao iniciar WebGL.");
  return program;
}

function rowMajorToColumnMajor(matrix) {
  return new Float32Array([
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8]
  ]);
}

export class CoverTransform {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!this.gl) throw new Error("Este browser não disponibiliza WebGL, necessário para a perspectiva exacta.");
    this.program = createProgram(this.gl);
    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), this.gl.STATIC_DRAW);
  }

  prepareArt(image, width, height, settings) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(width));
    canvas.height = Math.max(2, Math.round(height));
    const context = canvas.getContext("2d", { alpha: true });
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--card").trim() || "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!image) return canvas;

    const baseScale = settings.fit === "contain"
      ? Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
      : Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const scale = baseScale * settings.zoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.save();
    context.translate(
      canvas.width / 2 + canvas.width * settings.offsetX / 100,
      canvas.height / 2 + canvas.height * settings.offsetY / 100
    );
    context.rotate(settings.rotation * Math.PI / 180);
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
    return canvas;
  }

  render(image, geometry, outputWidth, outputHeight, settings) {
    this.canvas.width = outputWidth;
    this.canvas.height = outputHeight;
    const gl = this.gl;
    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const position = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // O shader já converte gl_FragCoord (origem inferior) para coordenadas de
    // canvas (origem superior). Não voltar a inverter a imagem no upload.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const art = this.prepareArt(image, outputWidth, outputHeight, settings);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art);

    const inverse = invertMatrix3(homographyFromUnitSquare(geometry.corners));
    gl.uniformMatrix3fv(gl.getUniformLocation(this.program, "u_inverse"), false, rowMajorToColumnMajor(inverse));
    gl.uniform1f(gl.getUniformLocation(this.program, "u_canvasHeight"), outputHeight);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_texture"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.deleteTexture(texture);
    return this.canvas;
  }
}
