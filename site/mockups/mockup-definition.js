const CORNER_KEYS = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function builtInA6() {
  return {
    schemaVersion: 1,
    id: "a6-front",
    name: "A6 - Frente",
    canvasWidth: 1600,
    canvasHeight: 1600,
    baseImage: { dataUrl: "", name: "" },
    product: { widthMm: 112, heightMm: 164 },
    cover: {
      corners: {
        topLeft: [390, 220], topRight: [1250, 300],
        bottomRight: [1160, 1390], bottomLeft: [320, 1300]
      }
    },
    coverArt: { fit: "cover", zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
    binding: {
      holeCount: 8, holeShape: "square", pitchMm: 18,
      holeWidthMm: 4, holeHeightMm: 4, xMm: 7,
      firstHoleYMm: 18, topMarginMm: 16, bottomMarginMm: 16
    },
    rings: { scale: 1, offsetXMm: -5, offsetYMm: 0, asset: "test-gold" },
    elastic: { enabled: false, xMm: 96, widthMm: 5, color: "gold", opacity: 1 }
  };
}

function builtInLarge() {
  const definition = builtInA6();
  definition.id = "large-front";
  definition.name = "Grande / Revistas - Frente";
  definition.product = { widthMm: 235, heightMm: 315 };
  definition.cover.corners = {
    topLeft: [350, 150], topRight: [1280, 240],
    bottomRight: [1190, 1450], bottomLeft: [260, 1350]
  };
  definition.binding = {
    holeCount: 17, holeShape: "square", pitchMm: 17.5,
    holeWidthMm: 4, holeHeightMm: 4, xMm: 8,
    firstHoleYMm: 17.5, topMarginMm: 15.5, bottomMarginMm: 15.5
  };
  definition.rings = { scale: 1, offsetXMm: -6, offsetYMm: 0, asset: "test-gold" };
  definition.elastic.xMm = 211;
  return definition;
}

export class MockupDefinition {
  static builtIns() {
    return { "a6-front": builtInA6(), "large-front": builtInLarge() };
  }

  static create(id = "a6-front") {
    const presets = MockupDefinition.builtIns();
    return MockupDefinition.normalize(clone(presets[id] || presets["a6-front"]));
  }

  static normalize(source) {
    const fallback = builtInA6();
    const value = source && typeof source === "object" ? clone(source) : fallback;
    value.schemaVersion = 1;
    value.id = String(value.id || fallback.id).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    value.name = String(value.name || fallback.name).slice(0, 120);
    value.canvasWidth = Math.round(finite(value.canvasWidth, fallback.canvasWidth, 200, 10000));
    value.canvasHeight = Math.round(finite(value.canvasHeight, fallback.canvasHeight, 200, 10000));
    value.baseImage = value.baseImage && typeof value.baseImage === "object" ? value.baseImage : { dataUrl: "", name: "" };
    value.baseImage.dataUrl = typeof value.baseImage.dataUrl === "string" ? value.baseImage.dataUrl : "";
    value.baseImage.name = String(value.baseImage.name || "").slice(0, 240);

    value.product = value.product || {};
    value.product.widthMm = finite(value.product.widthMm, fallback.product.widthMm, 1, 1000);
    value.product.heightMm = finite(value.product.heightMm, fallback.product.heightMm, 1, 1000);

    value.cover = value.cover || {};
    value.cover.corners = value.cover.corners || {};
    CORNER_KEYS.forEach((key) => {
      const point = Array.isArray(value.cover.corners[key]) ? value.cover.corners[key] : fallback.cover.corners[key];
      value.cover.corners[key] = [
        finite(point[0], fallback.cover.corners[key][0], -value.canvasWidth, value.canvasWidth * 2),
        finite(point[1], fallback.cover.corners[key][1], -value.canvasHeight, value.canvasHeight * 2)
      ];
    });

    value.coverArt = value.coverArt || {};
    value.coverArt.fit = value.coverArt.fit === "contain" ? "contain" : "cover";
    value.coverArt.zoom = finite(value.coverArt.zoom, 1, .1, 8);
    value.coverArt.offsetX = finite(value.coverArt.offsetX, 0, -200, 200);
    value.coverArt.offsetY = finite(value.coverArt.offsetY, 0, -200, 200);
    value.coverArt.rotation = finite(value.coverArt.rotation, 0, -180, 180);

    value.binding = value.binding || {};
    value.binding.holeCount = Math.round(finite(value.binding.holeCount, fallback.binding.holeCount, 1, 50));
    value.binding.holeShape = "square";
    value.binding.pitchMm = finite(value.binding.pitchMm, fallback.binding.pitchMm, .2, 100);
    value.binding.holeWidthMm = finite(value.binding.holeWidthMm, fallback.binding.holeWidthMm, .2, 30);
    value.binding.holeHeightMm = finite(value.binding.holeHeightMm, fallback.binding.holeHeightMm, .2, 30);
    value.binding.xMm = finite(value.binding.xMm, fallback.binding.xMm, -100, 1000);
    value.binding.firstHoleYMm = finite(value.binding.firstHoleYMm, fallback.binding.firstHoleYMm, -100, 1000);
    MockupDefinition.updateMargins(value);

    value.rings = value.rings || {};
    value.rings.scale = finite(value.rings.scale, 1, .1, 5);
    value.rings.offsetXMm = finite(value.rings.offsetXMm, -5, -100, 100);
    value.rings.offsetYMm = finite(value.rings.offsetYMm, 0, -100, 100);
    value.rings.asset = "test-gold";

    value.elastic = value.elastic || fallback.elastic;
    value.elastic.enabled = Boolean(value.elastic.enabled);
    value.elastic.xMm = finite(value.elastic.xMm, fallback.elastic.xMm, -100, 1000);
    value.elastic.widthMm = finite(value.elastic.widthMm, fallback.elastic.widthMm, .1, 100);
    value.elastic.color = String(value.elastic.color || "gold");
    value.elastic.opacity = finite(value.elastic.opacity, 1, 0, 1);
    return value;
  }

  static updateMargins(definition) {
    const binding = definition.binding;
    const lastCentre = binding.firstHoleYMm + (binding.holeCount - 1) * binding.pitchMm;
    binding.topMarginMm = binding.firstHoleYMm - binding.holeHeightMm / 2;
    binding.bottomMarginMm = definition.product.heightMm - lastCentre - binding.holeHeightMm / 2;
  }

  static clone(value) { return clone(value); }
}

export { CORNER_KEYS };
