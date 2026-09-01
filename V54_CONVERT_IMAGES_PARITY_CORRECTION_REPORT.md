# v54 Convert Images Parity Correction Report

## Scope
Only the Convert Images implementation was corrected from v53. Other tool implementations were left unchanged.

## Root correction
v53 introduced a converter-specific visibility flow that was described as controller-owned. That wording and implementation path were not aligned with the agreed requirement to follow the existing fixed image-tool lifecycle.

## v54 approach
The Convert Images runtime now follows the same lifecycle structure used by the already-fixed Compress Images tool:

- shared `window.OrivaDialog` popup API with no converter-specific popup system
- queued file validation and add flow
- common `hidden`-state surfaces for files, settings, safety, actions and results
- upload surface remains mounted after files are selected
- `syncReadySurface()` only synchronizes normal existing tool surfaces, matching the fixed image-tool pattern
- processing uses busy locking and the shared `window.__orivaProcessing` guard
- processing and result action transitions follow the same explicit lifecycle style as Compress Images
- Convert More Images asks for confirmation, resets to the upload workflow, and never calls the native file picker automatically
- object URLs are revoked during reset/removal and regenerated safely for downloadable output

## UI corrections retained
- no broad phase CSS rules that hide the upload card after file selection
- file list, settings, safety note and actions appear only when files exist
- mobile header/menu/footer styling remains intact
- format-specific controls continue to react to JPG/PNG/WebP selection

## Validation performed
- JavaScript syntax check: passed
- Convert Images cache references updated to v54
- no old `v=53` references remain in the Convert Images page
- other tool runtime files were not modified
