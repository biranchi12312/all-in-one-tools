# Images to PDF v16 Workflow Fix Report

## Base
- UI/code base: OrivaStudio New v15 Images to PDF package
- Behavioral reference: OrivaStudio v76 `images-to-pdf.js`

## Exact root cause fixed
The Images to PDF progress element was marked with `data-step="status"`.
The shared workflow CSS intentionally forces every `data-step="status"` element to `display:block!important` during the settings phase so normal status messages remain visible. That rule also matched the progress wrapper and overrode its native `hidden` attribute. Result: after upload, a blank progress card/bar appeared before processing began.

## Fix
1. Progress wrapper moved from `data-step="status"` to dedicated `data-step="progress"`.
2. Dedicated v16 CSS now keeps a hidden progress wrapper at `display:none!important`.
3. Progress can render only during the processing phase and only after JS has removed `hidden`.
4. Runtime phase changes explicitly hide stale progress whenever phase is not `processing`.
5. `setProgress(null)` now resets the fill and text in addition to hiding the wrapper, preventing stale visual residue.

## v76 workflow parity rechecked
- JPG/JPEG, PNG and WebP validation
- 30-image maximum
- 100 MB per file and 250 MB total limits
- Empty-file and duplicate rejection
- Serialized upload queue
- Thumbnail previews
- Arrow and drag/drop reordering
- Individual remove and Clear All confirmation
- Fit-to-image, A4 and Letter layout modes
- Orientation-aware fixed pages
- PNG transparency preservation and WebP JPEG conversion
- Safe pixel/source-dimension/embed-dimension limits
- Incremental progress and UI yielding
- PDF result, Download PDF and Create Another
- Object URL cleanup and pagehide cleanup
- Busy-state action locking and recovery to settings on processing error

## Validation
`node qa/regression-tests.mjs` completed successfully: 6/6 checks passed.
