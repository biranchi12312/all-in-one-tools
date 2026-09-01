# Images to PDF v15 parity hardening

## Source baseline

- Functional reference: `OrivaStudio_v76_Phase2_FixedRootPackaging(1)` Images to PDF workflow.
- UI base: New v14 Images to PDF page and v14 tool-v2 visual system.

## Workflow audited end to end

1. File input and drop-zone upload
2. Serialized file ingestion for rapid/repeated selections
3. Type, empty-file, per-file, total-batch and duplicate validation
4. Partial acceptance with skipped-file feedback
5. Image queue rendering with thumbnail, metadata and page number
6. Up/down reordering and drag reordering
7. Individual removal and automatic return to upload state when the last image is removed
8. Batch totals, remaining capacity and ready-state calculation
9. Fit-to-image, A4 and Letter page layout
10. PDF library loading and failure handling
11. Pixel/dimension safeguards and image downscaling
12. JPEG/PNG embedding and WebP conversion to JPEG
13. Incremental processing progress with UI yielding
14. Result blob/object URL lifecycle
15. PDF download with output filename
16. Clear All confirmation
17. Create Another confirmation
18. Reset of file input, controls, results, previews and object URLs
19. Processing lock and duplicate runtime initialization guard
20. Error recovery back to the settings phase

## v15 corrections

The dedicated v14 runtime already covered the core conversion algorithm, but several v76 behavioral details were incomplete or weaker. v15 restores those behaviors while retaining the v14 UI:

- serial upload queue to prevent rapid-selection race conditions;
- clickable and keyboard-accessible drop zone;
- modal feedback for skipped files and processing failures;
- explicit processing lock and global processing flag;
- safer drag lifecycle and reorder state;
- unified removal/reset behavior;
- result download implemented through a temporary anchor so the browser handles downloads consistently;
- duplicate runtime initialization guard;
- complete object URL cleanup on reset/page exit;
- v76-equivalent progress staging and UI yielding;
- output-name support retained as a v14 enhancement.

## Verification

- `node --check assets/js/tools/images-to-pdf-runtime.js` passed.
- `node --check assets/js/tools/pdf-tools.js` passed.
- Existing project regression suite passed 6/6 checks.
