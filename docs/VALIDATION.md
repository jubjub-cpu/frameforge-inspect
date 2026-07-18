# Validation Evidence

## Local release candidate

Validated on July 17, 2026 before v1.0.0 publication.

- Repository validator: passed. Checked required files, three generated bitmap fixtures, fictional-data and AI-assisted disclosures, privacy patterns, accessibility hooks, and pixel-analysis logic.
- Logic suite: passed. Covered luminance, clipping, contrast, edge detail, regional findings, sensitivity thresholds, comparison deltas, malformed buffers, and privacy-safe export.
- Desktop browser: passed at 1440 x 1000. Inspected actual Canvas pixels, rendered regional overlays, compared a baseline, recorded human revision, and downloaded a local JSON report.
- Mobile browser: passed at 390 x 844 with no horizontal overflow.
- Local image path: passed using a PNG through the browser file control; no upload request occurred.
- Overlay control: passed. Review regions can be hidden and restored without changing analysis.
- Keyboard path: passed. The skip link receives focus first and moves focus to the workspace.
- Loading failure: passed. A failed fixture-manifest request produces a visible recovery state and Retry control.
- Browser health: zero console errors and zero failed normal requests.
- Privacy scan: passed. No personal email address, API key, GitHub token, private-key material, real client asset, or image bytes in export are present.

## Visual evidence

- `docs/screenshots/frameforge-inspection-desktop.png`: 1440 x 2195 full-workflow desktop capture.
- `docs/screenshots/frameforge-inspection-mobile.png`: 390 x 3878 full-workflow mobile capture.

## Deployment verification

Pending GitHub Pages publication. The deployed URL, HTTP checks, repeat browser result, and published commit identity will be added before v1.0.0 is tagged.
