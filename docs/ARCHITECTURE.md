# Architecture

## Runtime Shape

FrameForge Inspect is a static local-first browser application. GitHub Pages serves HTML, CSS, JavaScript, JSON, and generated PNG fixtures. There is no backend, database, analytics service, or model endpoint.

## Pixel Pipeline

1. The browser decodes a synthetic fixture or local file into an `HTMLImageElement`.
2. `assets/app.js` draws it at natural resolution to Canvas.
3. Canvas `getImageData` exposes the RGBA pixel buffer locally.
4. `assets/analysis.mjs` calculates luminance distribution, clipping, edge energy, channel spread, and upper-right text-zone uniformity.
5. Threshold findings retain normalized regions so the overlay can map them back to any responsive canvas size.
6. A separate overlay canvas renders review regions without altering source pixels.

## Trust Boundary

The fixture manifest is the only data request. Local files are decoded with an object URL and never leave browser memory. The app does not parse EXIF metadata. Exported records contain only source labels, metrics, findings, comparison deltas, event text, and a human decision.

## Human Control

Analysis never marks a delivery as approved. Approve and Request revision are explicit human actions recorded after inspection. Findings are transparent heuristics and can be overridden by the reviewer.

## Failure Model

- Fixture manifest failure produces a visible Retry state.
- Image decode failure is shown in the canvas panel and event log.
- Analysis rejects incomplete pixel buffers.
- Export remains disabled until an analysis exists.

## Deployment

Static files are published from `main` to GitHub Pages. Local and deployed browser checks use the same test script and workflow assertions.
