# Case Study

## Problem

Small creative teams often review delivery stills by eye without a repeatable first pass. Obvious clipping, low contrast, soft exports, and busy copy zones can survive until handoff. The original FrameForge QA demo described those concerns but used only preset metadata.

## Product Decision

The rebuild narrows the workflow to still-image delivery inspection and makes the technical claim observable. Browser Canvas supplies actual pixels; deterministic metrics expose what was measured; normalized overlays connect findings to regions; and a human owns approval.

## Workflow

The reviewer chooses a fictional bitmap or local image, sets sensitivity, runs inspection, reviews six measurable indicators, toggles regional overlays, optionally compares a baseline, and records approval or revision. A local JSON record preserves the decision evidence without embedding the image.

## Why Deterministic Heuristics

Transparent thresholds make the demo free, repeatable, and explainable while demonstrating the preprocessing and review surfaces that a production vision system would need. This avoids pretending a hosted model is running and makes failure cases testable.

## Privacy and Responsible Scope

Local images are not uploaded or persisted. The app does not identify people, infer sensitive traits, parse EXIF, recognize brands, or decide aesthetic quality. Synthetic fixtures are generated from simple geometric shapes and contain no client material.

## Evidence

- Three generated PNG fixtures with distinct tonal defects.
- Pure logic tests for luminance, clipping, contrast, detail, regions, comparison, and privacy-safe export.
- Desktop and mobile browser checks for Canvas analysis, overlays, baseline comparison, local file loading, human decision, export, keyboard access, and load failure.
- GitHub Pages validation repeats the same workflow against the public deployment.

## Result

FrameForge Inspect replaces a metadata-only creative concept with direct browser media processing, honest computer-vision heuristics, testable failure states, and a professional creative QA workflow.
