const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function luminance(red, green, blue) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function summarize(values) {
  if (!values.length) return { mean: 0, deviation: 0, min: 0, max: 0 };
  let sum = 0;
  let sumSquares = 0;
  let min = 255;
  let max = 0;
  for (const value of values) {
    sum += value;
    sumSquares += value * value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const mean = sum / values.length;
  return {
    mean,
    deviation: Math.sqrt(Math.max(0, sumSquares / values.length - mean * mean)),
    min,
    max,
  };
}

function inspectRegion(lumas, width, height, region, highlightLimit, shadowLimit) {
  const startX = Math.floor(region.x * width);
  const startY = Math.floor(region.y * height);
  const endX = Math.max(startX + 1, Math.ceil((region.x + region.w) * width));
  const endY = Math.max(startY + 1, Math.ceil((region.y + region.h) * height));
  const values = [];
  let highlights = 0;
  let shadows = 0;
  for (let y = startY; y < Math.min(endY, height); y += 1) {
    for (let x = startX; x < Math.min(endX, width); x += 1) {
      const value = lumas[y * width + x];
      values.push(value);
      if (value >= highlightLimit) highlights += 1;
      if (value <= shadowLimit) shadows += 1;
    }
  }
  const summary = summarize(values);
  return {
    ...summary,
    highlightPct: values.length ? (highlights / values.length) * 100 : 0,
    shadowPct: values.length ? (shadows / values.length) * 100 : 0,
  };
}

function findRegion(lumas, width, height, metric, direction, highlightLimit, shadowLimit) {
  const columns = 6;
  const rows = 4;
  let best = null;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const region = { x: column / columns, y: row / rows, w: 1 / columns, h: 1 / rows };
      const stats = inspectRegion(lumas, width, height, region, highlightLimit, shadowLimit);
      const value = stats[metric];
      if (!best || (direction === "max" ? value > best.value : value < best.value)) {
        best = { region, value };
      }
    }
  }
  return best?.region || { x: 0, y: 0, w: 1, h: 1 };
}

export function analyzePixels(imageData, sensitivity = 55) {
  const { data, width, height } = imageData || {};
  if (!data || !Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error("A valid ImageData-like object is required.");
  }
  if (data.length < width * height * 4) throw new Error("Pixel buffer is incomplete.");

  const level = clamp(Number(sensitivity) || 55, 0, 100);
  const highlightLimit = 248 - level * 0.12;
  const shadowLimit = 5 + level * 0.13;
  const lumas = new Float32Array(width * height);
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let highlights = 0;
  let shadows = 0;

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const value = luminance(red, green, blue);
    lumas[pixel] = value;
    redTotal += red;
    greenTotal += green;
    blueTotal += blue;
    if (value >= highlightLimit) highlights += 1;
    if (value <= shadowLimit) shadows += 1;
  }

  const summary = summarize(lumas);
  let gradientTotal = 0;
  let gradientSamples = 0;
  for (let y = 0; y < height - 1; y += 2) {
    for (let x = 0; x < width - 1; x += 2) {
      const current = lumas[y * width + x];
      gradientTotal += Math.abs(current - lumas[y * width + x + 1]);
      gradientTotal += Math.abs(current - lumas[(y + 1) * width + x]);
      gradientSamples += 2;
    }
  }

  const pixels = width * height;
  const channelMeans = [redTotal / pixels, greenTotal / pixels, blueTotal / pixels];
  const colorSpread = Math.max(...channelMeans) - Math.min(...channelMeans);
  const highlightPct = (highlights / pixels) * 100;
  const shadowPct = (shadows / pixels) * 100;
  const edgeEnergy = gradientSamples ? (gradientTotal / gradientSamples) * 8 : 0;
  const textZoneRegion = { x: 0.58, y: 0.08, w: 0.34, h: 0.26 };
  const textZone = inspectRegion(lumas, width, height, textZoneRegion, highlightLimit, shadowLimit);

  const issues = [];
  const addIssue = (type, severity, title, detail, region) => {
    issues.push({ id: `${type}-${issues.length + 1}`, type, severity, title, detail, region });
  };
  const clipTolerance = Math.max(2.5, 7 - level * 0.055);
  if (highlightPct > clipTolerance) {
    addIssue(
      "highlight",
      highlightPct > clipTolerance * 2.5 ? "high" : "medium",
      "Clipped highlight area",
      `${highlightPct.toFixed(1)}% of pixels are near white and may have lost recoverable detail.`,
      findRegion(lumas, width, height, "highlightPct", "max", highlightLimit, shadowLimit),
    );
  }
  if (shadowPct > clipTolerance) {
    addIssue(
      "shadow",
      shadowPct > clipTolerance * 2.5 ? "high" : "medium",
      "Crushed shadow area",
      `${shadowPct.toFixed(1)}% of pixels are near black and may hide texture.`,
      findRegion(lumas, width, height, "shadowPct", "max", highlightLimit, shadowLimit),
    );
  }
  const contrastFloor = 16 + level * 0.08;
  if (summary.deviation < contrastFloor) {
    addIssue(
      "contrast",
      summary.deviation < contrastFloor * 0.55 ? "high" : "medium",
      "Low tonal separation",
      `Luminance deviation is ${summary.deviation.toFixed(1)}, below the ${contrastFloor.toFixed(1)} review threshold.`,
      findRegion(lumas, width, height, "deviation", "min", highlightLimit, shadowLimit),
    );
  }
  if (edgeEnergy < 2.2 + level * 0.018) {
    addIssue(
      "detail",
      "medium",
      "Low edge energy",
      `Edge energy is ${edgeEnergy.toFixed(1)}; inspect focus and export compression at full size.`,
      { x: 0.28, y: 0.24, w: 0.44, h: 0.52 },
    );
  }
  if (colorSpread > 58 - level * 0.18) {
    addIssue(
      "color",
      "medium",
      "Strong channel imbalance",
      `Average RGB channels differ by ${colorSpread.toFixed(1)} levels. Confirm that the cast is intentional.`,
      { x: 0, y: 0, w: 1, h: 1 },
    );
  }
  const textZoneClipped = textZone.highlightPct > 18;
  if (textZone.deviation > 52 - level * 0.12 || textZoneClipped) {
    addIssue(
      "safe-zone",
      "medium",
      textZoneClipped ? "Clipped text safe zone" : "Busy text safe zone",
      textZoneClipped
        ? `${textZone.highlightPct.toFixed(1)}% of the upper-right copy zone is near white.`
        : `The upper-right copy zone has ${textZone.deviation.toFixed(1)} luminance deviation.`,
      textZoneRegion,
    );
  }

  const highCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumCount = issues.length - highCount;
  const score = clamp(
    Math.round(
      100 -
        Math.min(32, highlightPct * 1.2) -
        Math.min(28, shadowPct * 1.1) -
        Math.max(0, contrastFloor - summary.deviation) * 1.35 -
        Math.max(0, 3.2 - edgeEnergy) * 3 -
        mediumCount * 3 -
        highCount * 8,
    ),
    0,
    100,
  );

  return {
    width,
    height,
    sensitivity: level,
    score,
    status: highCount ? "revision-required" : issues.length ? "review" : "clear",
    metrics: {
      meanLuminance: summary.mean,
      contrast: summary.deviation,
      dynamicRange: summary.max - summary.min,
      highlightClipPct: highlightPct,
      shadowClipPct: shadowPct,
      edgeEnergy,
      colorSpread,
      textZoneUniformity: clamp(
        100 - textZone.deviation - textZone.highlightPct - textZone.shadowPct,
        0,
        100,
      ),
    },
    issues,
    analyzedAt: "deterministic-local-run",
  };
}

export function compareAnalyses(current, baseline) {
  if (!current || !baseline) return null;
  const keys = ["contrast", "highlightClipPct", "shadowClipPct", "edgeEnergy", "textZoneUniformity"];
  return {
    scoreDelta: current.score - baseline.score,
    metrics: Object.fromEntries(
      keys.map((key) => [key, current.metrics[key] - baseline.metrics[key]]),
    ),
  };
}

export function buildInspectionRecord({ source, analysis, baseline, comparison, decision, events }) {
  if (!analysis) throw new Error("Analysis is required before export.");
  return {
    schema: "frameforge-inspection/v1",
    source: { id: source.id, name: source.name, kind: source.kind },
    analysis,
    baseline: baseline ? { id: baseline.id, name: baseline.name } : null,
    comparison,
    humanDecision: decision || "pending",
    events: [...events],
    privacy: "No image bytes, EXIF data, or external transmission are included.",
  };
}
