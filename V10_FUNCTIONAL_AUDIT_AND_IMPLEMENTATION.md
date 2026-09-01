# OrivaStudio New v10 — Functional Parity Audit & Implementation

## Audit basis
- Legacy reference: OrivaStudio v76 Phase 2 Fixed Root Packaging
- New implementation base: OrivaStudio New v9
- Rule: legacy source code was used for functional analysis only. The v10 tool engines and runtime remain separate implementations.

## Root finding
The v9 architecture already had a correct independent-engine direction, but several engines were intentionally minimal. The gap was not mainly in routing or lazy loading; it was in missing per-tool settings and processing branches. Legacy tools contained substantially broader workflows than the v9 engines.

## Implemented functional coverage

### Image tools
- Compress Images: batch processing, quality, output format, max-edge safety, individual results, ZIP download.
- Convert Images: source filtering, JPG/PNG/WebP targets, quality, JPG background handling, batch processing, ZIP download.
- Crop & Rotate: crop region percentages, aspect presets, 90-degree rotation controls, horizontal/vertical flip, output format and quality.
- Resize Images: fit/exact/percentage modes, width/height, aspect protection, no-enlarge guard, output format and quality.

### PDF tools
- Images to PDF: batch images, A4/Letter/natural page sizing, landscape option, reorder controls.
- Merge PDF: multiple input files, reorder controls, output filename, PDF preview action after processing.
- Split PDF: explicit ranges, every-page mode, fixed chunk mode, optional single-page output behavior, ZIP download for multiple results.
- PDF to Images: PNG/JPG choice, JPG quality, render scale, per-page output, PDF thumbnail support, ZIP download.

## Shared runtime behavior
- Only the currently opened tool engine is dynamically imported.
- Initial phase is upload; settings, actions and result surfaces are phase-controlled.
- Processing is disabled while an operation is active.
- File limits and batch limits remain enforced.
- Image and PDF previews are generated only for uploaded files that need them.
- Object URLs are revoked during reset and result cleanup.
- Multi-result workflows expose a ZIP download action.
- Result PDF files expose an Open Preview action.

## Safety additions
- Explicit maximum render-pixel guard: 40,000,000 pixels.
- Image canvas workflows check decoded pixel size before rendering.
- PDF-to-Images uses the centralized PDF.js standard-font configuration to avoid the previous standard-font warning regression.
- Maximum upload and total-batch limits remain centralized in the runtime.

## Regression result
The updated static regression suite checks all eight independent engines, phase surfaces, lazy engine loading, phase transitions, PDF standard-font and render-pixel safeguards, and ZIP support.

Result: 6/6 checks passed.
