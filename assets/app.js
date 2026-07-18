import { analyzePixels, buildInspectionRecord, compareAnalyses } from "./analysis.mjs";

const workspace = document.querySelector("#workspace");
const state = {
  fixtures: [],
  source: null,
  image: null,
  analysis: null,
  baseline: null,
  baselineAnalysis: null,
  comparison: null,
  decision: null,
  overlay: true,
  events: [],
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function renderShell() {
  workspace.innerHTML = `
    <div class="inspection-shell">
      <aside class="asset-rail" aria-labelledby="asset-heading">
        <div class="rail-heading">
          <p class="eyebrow">Fixture studio</p>
          <h1 id="asset-heading">Delivery assets</h1>
          <p>Choose a generated bitmap or inspect one local image.</p>
        </div>
        <div id="fixture-list" class="fixture-list"></div>
        <label class="upload-control" for="local-image">
          <span>Load local image</span>
          <small>PNG, JPG, or WebP; browser memory only</small>
        </label>
        <input id="local-image" type="file" accept="image/png,image/jpeg,image/webp">
        <p class="privacy-note">No file leaves this browser. The report excludes image bytes, filenames from your device path, and EXIF metadata.</p>
      </aside>

      <section class="workbench" aria-labelledby="workbench-title">
        <div class="workbench-heading">
          <div>
            <p class="eyebrow" id="source-kind">Synthetic fixture</p>
            <h2 id="workbench-title">Select an asset</h2>
            <p id="source-requirement">Choose a fixture to begin pixel inspection.</p>
          </div>
          <button id="export-report" class="secondary" type="button" disabled>Download report</button>
        </div>

        <div class="inspection-toolbar" aria-label="Inspection settings">
          <label for="sensitivity">Sensitivity <output id="sensitivity-value">55</output></label>
          <input id="sensitivity" type="range" min="0" max="100" value="55">
          <label class="check-control" for="show-overlay"><input id="show-overlay" type="checkbox" checked> Issue overlay</label>
          <label for="baseline-select">Compare with</label>
          <select id="baseline-select"><option value="">No baseline</option></select>
          <button id="run-analysis" type="button" disabled>Inspect pixels</button>
        </div>

        <div class="visual-grid">
          <section class="canvas-panel" aria-labelledby="canvas-heading">
            <div class="panel-heading">
              <div><p class="eyebrow">Browser Canvas</p><h3 id="canvas-heading">Pixel view</h3></div>
              <span id="image-dimensions">No image loaded</span>
            </div>
            <div class="canvas-stage" id="canvas-stage">
              <canvas id="image-canvas" width="960" height="600" aria-label="Selected image for pixel inspection"></canvas>
              <canvas id="overlay-canvas" width="960" height="600" aria-label="Detected issue regions"></canvas>
              <p id="canvas-empty">Choose a fixture or local image.</p>
            </div>
            <div class="legend" aria-label="Overlay legend"><span><i class="high"></i> High</span><span><i class="medium"></i> Review</span></div>
          </section>

          <aside class="metric-panel" aria-labelledby="metric-heading">
            <div class="panel-heading"><div><p class="eyebrow">Inspection run</p><h3 id="metric-heading">Measured output</h3></div><span id="analysis-status" class="status-badge idle">Idle</span></div>
            <div id="score-block" class="score-block"><strong>--</strong><span>delivery score</span></div>
            <div id="metric-list" class="metric-list"><p class="empty-copy">Run pixel inspection to calculate local metrics.</p></div>
          </aside>
        </div>

        <section class="findings-section" aria-labelledby="findings-heading">
          <div class="panel-heading"><div><p class="eyebrow">Regional review</p><h3 id="findings-heading">Findings</h3></div><span id="finding-count">0 findings</span></div>
          <div id="finding-list" class="finding-list"><p class="empty-copy">Detected clipping, contrast, detail, color, and safe-zone concerns will appear here.</p></div>
        </section>

        <section class="comparison-section" aria-labelledby="comparison-heading">
          <div class="panel-heading"><div><p class="eyebrow">Baseline delta</p><h3 id="comparison-heading">Comparison</h3></div></div>
          <div id="comparison-output" class="comparison-output"><p class="empty-copy">Select a different fixture as a baseline to compare measurable changes.</p></div>
        </section>

        <section class="decision-section" aria-labelledby="decision-heading">
          <div>
            <p class="eyebrow">Human gate</p>
            <h3 id="decision-heading">Delivery decision</h3>
            <p>Heuristics flag review areas; the creative reviewer owns the delivery decision.</p>
            <p id="decision-summary" class="decision-summary">No human decision recorded.</p>
          </div>
          <div class="decision-actions">
            <button id="approve-delivery" type="button" disabled>Approve delivery</button>
            <button id="request-revision" class="return" type="button" disabled>Request revision</button>
          </div>
        </section>

        <section class="event-section" aria-labelledby="event-heading">
          <div class="panel-heading"><div><p class="eyebrow">Local evidence</p><h3 id="event-heading">Decision log</h3></div></div>
          <ol id="event-list"><li>FrameForge Inspect opened in local deterministic mode.</li></ol>
        </section>
      </section>
    </div>`;
}

function renderFixtureList() {
  document.querySelector("#fixture-list").innerHTML = state.fixtures.map((fixture) => `
    <button class="fixture-button" type="button" data-fixture="${fixture.id}" aria-pressed="${state.source?.id === fixture.id}">
      <img src="${fixture.file}" alt="" width="128" height="80">
      <span><strong>${escapeHtml(fixture.name)}</strong><small>${escapeHtml(fixture.channel)}</small></span>
    </button>`).join("");
  const select = document.querySelector("#baseline-select");
  select.innerHTML = `<option value="">No baseline</option>${state.fixtures
    .filter((fixture) => fixture.id !== state.source?.id)
    .map((fixture) => `<option value="${fixture.id}">${escapeHtml(fixture.name)}</option>`)
    .join("")}`;
}

function addEvent(message) {
  state.events.push(message);
  document.querySelector("#event-list").innerHTML = state.events.map((event) => `<li>${escapeHtml(event)}</li>`).join("");
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be decoded."));
    image.src = url;
  });
}

async function chooseSource(source, url) {
  setBusy(true);
  try {
    state.image = await loadImage(url);
    state.source = source;
    state.analysis = null;
    state.baseline = null;
    state.baselineAnalysis = null;
    state.comparison = null;
    state.decision = null;
    drawImage();
    renderFixtureList();
    resetOutputs();
    document.querySelector("#source-kind").textContent = source.kind === "local" ? "Local browser file" : "Synthetic fixture";
    document.querySelector("#workbench-title").textContent = source.name;
    document.querySelector("#source-requirement").textContent = source.requirement;
    document.querySelector("#image-dimensions").textContent = `${state.image.naturalWidth} x ${state.image.naturalHeight} px`;
    document.querySelector("#run-analysis").disabled = false;
    addEvent(`${source.name} loaded; no external request was made for analysis.`);
  } catch (error) {
    showImageError(error.message);
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  const button = document.querySelector("#run-analysis");
  if (button) {
    button.disabled = busy || !state.image;
    button.textContent = busy ? "Loading image..." : "Inspect pixels";
  }
}

function drawImage() {
  const canvas = document.querySelector("#image-canvas");
  const overlay = document.querySelector("#overlay-canvas");
  const width = state.image.naturalWidth;
  const height = state.image.naturalHeight;
  canvas.width = width;
  canvas.height = height;
  overlay.width = width;
  overlay.height = height;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(state.image, 0, 0, width, height);
  overlay.getContext("2d").clearRect(0, 0, width, height);
  document.querySelector("#canvas-empty").hidden = true;
}

function resetOutputs() {
  document.querySelector("#analysis-status").className = "status-badge idle";
  document.querySelector("#analysis-status").textContent = "Idle";
  document.querySelector("#score-block").innerHTML = "<strong>--</strong><span>delivery score</span>";
  document.querySelector("#metric-list").innerHTML = '<p class="empty-copy">Run pixel inspection to calculate local metrics.</p>';
  document.querySelector("#finding-count").textContent = "0 findings";
  document.querySelector("#finding-list").innerHTML = '<p class="empty-copy">Detected clipping, contrast, detail, color, and safe-zone concerns will appear here.</p>';
  document.querySelector("#comparison-output").innerHTML = '<p class="empty-copy">Select a different fixture as a baseline to compare measurable changes.</p>';
  document.querySelector("#decision-summary").textContent = "No human decision recorded.";
  document.querySelector("#approve-delivery").disabled = true;
  document.querySelector("#request-revision").disabled = true;
  document.querySelector("#export-report").disabled = true;
}

function format(value, suffix = "") {
  return `${Number(value).toFixed(1)}${suffix}`;
}

function renderAnalysis() {
  const { analysis } = state;
  const status = document.querySelector("#analysis-status");
  const label = analysis.status === "revision-required" ? "Revision required" : analysis.status === "review" ? "Review" : "Clear";
  status.className = `status-badge ${analysis.status}`;
  status.textContent = label;
  document.querySelector("#score-block").innerHTML = `<strong>${analysis.score}</strong><span>delivery score</span>`;
  const metrics = [
    ["Mean luminance", format(analysis.metrics.meanLuminance), "Average image brightness"],
    ["Tonal contrast", format(analysis.metrics.contrast), "Luminance standard deviation"],
    ["Highlight clip", format(analysis.metrics.highlightClipPct, "%"), "Pixels near white"],
    ["Shadow clip", format(analysis.metrics.shadowClipPct, "%"), "Pixels near black"],
    ["Edge energy", format(analysis.metrics.edgeEnergy), "Local pixel transitions"],
    ["Text-zone uniformity", format(analysis.metrics.textZoneUniformity, "%"), "Upper-right copy area"],
  ];
  document.querySelector("#metric-list").innerHTML = metrics.map(([name, value, note]) => `
    <div class="metric"><span>${name}<small>${note}</small></span><strong>${value}</strong></div>`).join("");
  document.querySelector("#finding-count").textContent = `${analysis.issues.length} finding${analysis.issues.length === 1 ? "" : "s"}`;
  document.querySelector("#finding-list").innerHTML = analysis.issues.length
    ? analysis.issues.map((issue, index) => `
      <article class="finding ${issue.severity}">
        <span class="finding-index">${String(index + 1).padStart(2, "0")}</span>
        <div><p>${escapeHtml(issue.type)}</p><h4>${escapeHtml(issue.title)}</h4><span>${escapeHtml(issue.detail)}</span></div>
        <strong>${escapeHtml(issue.severity)}</strong>
      </article>`).join("")
    : '<p class="clear-copy">No threshold findings. Human visual review is still required.</p>';
  document.querySelector("#approve-delivery").disabled = false;
  document.querySelector("#request-revision").disabled = false;
  document.querySelector("#export-report").disabled = false;
  drawOverlay();
  renderComparison();
}

function drawOverlay() {
  const canvas = document.querySelector("#overlay-canvas");
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvas.hidden = !state.overlay;
  if (!state.overlay || !state.analysis) return;
  for (const [index, issue] of state.analysis.issues.entries()) {
    const { x, y, w, h } = issue.region;
    const high = issue.severity === "high";
    context.fillStyle = high ? "rgba(255, 91, 77, 0.2)" : "rgba(184, 243, 65, 0.16)";
    context.strokeStyle = high ? "#ff5b4d" : "#b8f341";
    context.lineWidth = Math.max(3, canvas.width / 320);
    context.setLineDash([12, 8]);
    context.fillRect(x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height);
    context.strokeRect(x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height);
    context.setLineDash([]);
    context.fillStyle = high ? "#ff5b4d" : "#b8f341";
    context.font = `bold ${Math.max(18, canvas.width / 32)}px Arial`;
    context.fillText(String(index + 1).padStart(2, "0"), x * canvas.width + 10, y * canvas.height + 34);
  }
}

async function runAnalysis() {
  if (!state.image) return;
  const canvas = document.querySelector("#image-canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  state.analysis = analyzePixels(imageData, document.querySelector("#sensitivity").value);
  state.decision = null;
  await analyzeBaseline();
  renderAnalysis();
  addEvent(`${state.source.name} inspected: ${state.analysis.issues.length} finding(s), score ${state.analysis.score}.`);
}

async function analyzeBaseline() {
  const id = document.querySelector("#baseline-select").value;
  state.baseline = state.fixtures.find((fixture) => fixture.id === id) || null;
  state.baselineAnalysis = null;
  state.comparison = null;
  if (!state.baseline) return;
  const image = await loadImage(state.baseline.file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  state.baselineAnalysis = analyzePixels(context.getImageData(0, 0, canvas.width, canvas.height), document.querySelector("#sensitivity").value);
  state.comparison = compareAnalyses(state.analysis, state.baselineAnalysis);
}

function renderComparison() {
  const output = document.querySelector("#comparison-output");
  if (!state.comparison) {
    output.innerHTML = '<p class="empty-copy">Select a different fixture as a baseline to compare measurable changes.</p>';
    return;
  }
  const score = state.comparison.scoreDelta;
  const rows = [
    ["Score", score],
    ["Contrast", state.comparison.metrics.contrast],
    ["Highlight clip", state.comparison.metrics.highlightClipPct],
    ["Edge energy", state.comparison.metrics.edgeEnergy],
    ["Text-zone uniformity", state.comparison.metrics.textZoneUniformity],
  ];
  output.innerHTML = `<p><strong>${escapeHtml(state.source.name)}</strong> compared with <strong>${escapeHtml(state.baseline.name)}</strong>.</p><div class="delta-grid">${rows.map(([label, value]) => `
    <div><span>${label}</span><strong class="${value > 0 ? "positive" : value < 0 ? "negative" : ""}">${value > 0 ? "+" : ""}${value.toFixed(1)}</strong></div>`).join("")}</div>`;
}

function recordDecision(decision) {
  state.decision = decision;
  const approved = decision === "approved";
  document.querySelector("#decision-summary").className = `decision-summary ${approved ? "approved" : "revision"}`;
  document.querySelector("#decision-summary").textContent = approved
    ? "Delivery approved by the human reviewer."
    : "Revision requested by the human reviewer.";
  addEvent(approved ? "Human reviewer approved delivery." : "Human reviewer requested a revision.");
}

function exportReport() {
  const record = buildInspectionRecord({
    source: state.source,
    analysis: state.analysis,
    baseline: state.baseline,
    comparison: state.comparison,
    decision: state.decision,
    events: state.events,
  });
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "frameforge-inspection.json";
  link.click();
  URL.revokeObjectURL(link.href);
  addEvent("Local inspection record downloaded; image bytes were excluded.");
}

function showImageError(message) {
  document.querySelector("#canvas-empty").hidden = false;
  document.querySelector("#canvas-empty").textContent = message;
  addEvent(`Image load error: ${message}`);
}

function bindEvents() {
  document.querySelector("#fixture-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-fixture]");
    if (!button) return;
    const fixture = state.fixtures.find((item) => item.id === button.dataset.fixture);
    chooseSource({ ...fixture, kind: "fixture" }, fixture.file);
  });
  document.querySelector("#local-image").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const url = URL.createObjectURL(file);
    chooseSource({ id: "local-image", name: file.name, kind: "local", requirement: "Apply your own delivery requirements before making a decision." }, url)
      .finally(() => URL.revokeObjectURL(url));
  });
  document.querySelector("#sensitivity").addEventListener("input", (event) => {
    document.querySelector("#sensitivity-value").textContent = event.target.value;
  });
  document.querySelector("#show-overlay").addEventListener("change", (event) => {
    state.overlay = event.target.checked;
    drawOverlay();
  });
  document.querySelector("#baseline-select").addEventListener("change", async () => {
    if (!state.analysis) return;
    await analyzeBaseline();
    renderComparison();
  });
  document.querySelector("#run-analysis").addEventListener("click", runAnalysis);
  document.querySelector("#approve-delivery").addEventListener("click", () => recordDecision("approved"));
  document.querySelector("#request-revision").addEventListener("click", () => recordDecision("revision-requested"));
  document.querySelector("#export-report").addEventListener("click", exportReport);
}

async function start() {
  try {
    const response = await fetch("data/fixtures.json");
    if (!response.ok) throw new Error(`Fixture request failed with ${response.status}.`);
    const payload = await response.json();
    state.fixtures = payload.fixtures;
    state.events = ["FrameForge Inspect opened in local deterministic mode."];
    renderShell();
    renderFixtureList();
    bindEvents();
    await chooseSource({ ...state.fixtures[0], kind: "fixture" }, state.fixtures[0].file);
  } catch (error) {
    workspace.innerHTML = `<section class="startup error"><p class="eyebrow">Fixture load failed</p><h1>The synthetic image studio could not be loaded.</h1><p>${escapeHtml(error.message)}</p><button type="button" id="retry-start">Retry</button></section>`;
    document.querySelector("#retry-start").addEventListener("click", () => location.reload());
  }
}

start();
