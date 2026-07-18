import assert from "node:assert/strict";
import { analyzePixels, buildInspectionRecord, compareAnalyses, luminance } from "../assets/analysis.mjs";

function image(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [red, green, blue] = pixel(x, y);
      data.set([red, green, blue, 255], offset);
    }
  }
  return { data, width, height };
}

assert.equal(Math.round(luminance(255, 255, 255)), 255);
assert.ok(luminance(0, 255, 0) > luminance(255, 0, 0));

const balanced = analyzePixels(image(48, 32, (x, y) => ((x + y) % 2 ? [45, 70, 90] : [205, 220, 165])));
assert.ok(balanced.metrics.contrast > 50, "Balanced fixture should retain tonal separation");
assert.equal(balanced.issues.some((issue) => issue.severity === "high"), false);

const blown = analyzePixels(image(48, 32, (x) => (x > 20 ? [255, 255, 255] : [190, 175, 135])));
assert.ok(blown.metrics.highlightClipPct > 50);
assert.ok(blown.issues.some((issue) => issue.type === "highlight" && issue.severity === "high"));
assert.equal(blown.status, "revision-required");

const flat = analyzePixels(image(48, 32, () => [128, 130, 129]));
assert.ok(flat.metrics.contrast < 2);
assert.ok(flat.issues.some((issue) => issue.type === "contrast"));
assert.ok(flat.issues.some((issue) => issue.type === "detail"));

assert.throws(() => analyzePixels({ data: [], width: 0, height: 0 }), /valid ImageData/);
assert.throws(() => analyzePixels({ data: new Uint8Array(4), width: 4, height: 4 }), /incomplete/);

const comparison = compareAnalyses(blown, balanced);
assert.ok(comparison.scoreDelta < 0);
assert.ok(comparison.metrics.highlightClipPct > 0);

const record = buildInspectionRecord({
  source: { id: "fixture", name: "Fixture", kind: "fixture" },
  analysis: balanced,
  baseline: null,
  comparison: null,
  decision: "approved",
  events: ["inspected", "approved"],
});
assert.equal(record.schema, "frameforge-inspection/v1");
assert.equal(record.humanDecision, "approved");
assert.equal("imageData" in record, false);
assert.match(record.privacy, /No image bytes/);

console.log("FRAMEFORGE LOGIC TESTS PASSED");
console.log("Checked luminance, clipping, contrast, detail, regional findings, comparison, errors, and privacy-safe export.");
