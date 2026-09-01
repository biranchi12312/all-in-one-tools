# OrivaStudio V59 — Split PDF V76 Deep Parity + Workflow Fix

## 1. What was studied
The V76 Phase-2 Split PDF implementation was traced end-to-end:

- upload/drop-zone behavior
- one-PDF queue lifecycle
- MIME/extension validation
- empty-file and 100 MB validation
- PDF signature validation
- PDF.js page-count inspection
- password/encryption handling
- 500-page safety boundary
- split-mode planning
- page-range parsing
- reversed ranges
- comma/semicolon/whitespace separators
- Unicode dash variants
- Every Page mode
- Every N Pages mode
- Single PDF with selected pages
- duplicate-page removal for single-file ranges
- 200-output hard limit
- 50+ output confirmation
- processing lock
- progress lifecycle
- pdf-lib page copying
- encrypted-document warning
- generated PDF naming and collision handling
- individual downloads
- multi-file ZIP creation and progress
- result rendering
- Split Another / Clear All confirmations
- object-URL cleanup
- before-unload protection

V76 intentionally hides the initial upload surface after a valid single PDF is accepted because the tool allows only one source PDF. The loaded-file row becomes the active source surface and its Remove/Clear action is the route back to upload.

## 2. Screenshot findings
The supplied mobile screenshots exposed two concrete UI/workflow problems:

### A. Split mode controls were not conditional
The selected mode changed, but unrelated controls remained visible:

- `Every page` still showed Page ranges, Chunk size and the Single PDF checkbox.
- `Every N pages` still showed Page ranges and the Single PDF checkbox.
- `Page ranges` still showed Chunk size.

This was not V76 parity. V76 only exposes the controls relevant to the selected mode.

### B. The loaded-PDF workflow could become effectively trapped
The upload surface disappears after the one PDF is accepted. That state is valid for a one-file workflow, but only if the loaded source row's Remove action reliably clears the source and returns the upload surface.

V59 makes this lifecycle explicit and defensive: the source row owns the Remove action, the hidden file input is reset after every selection, and reset invalidates any in-flight thumbnail operation before restoring the upload phase.

## 3. V58 verification
The V58 Split PDF controller already had a number of correct V76-derived behaviors:

- dedicated controller instead of the old thin generic engine path
- 1-PDF input model
- 100 MB limit
- 500-page limit
- PDF.js inspection
- PDF signature check
- password/encryption detection
- three split modes
- reversed range normalization
- strict chunk-size validation
- single-file selected-page mode
- 200-output hard limit
- large-job confirmation at 50+
- pdf-lib based export
- progress updates
- individual result downloads
- ZIP generation for multiple outputs
- Clear/Replace confirmation
- generated object URL cleanup
- result lifecycle separation

## 4. V58 issues fixed in V59
1. Added real mode-dependent UI visibility for Page ranges / Single PDF controls versus Chunk size.
2. Added an explicit `updateModeUI()` lifecycle so mode changes immediately update both the visual controls and Split button readiness.
3. Preserved the existing V58 UI styling instead of replacing it with the V76 page shell.
4. Hardened the source-row Remove action and kept it visually consistent with the existing V58 file-card controls.
5. Kept the one-PDF upload surface hidden while a source is loaded, matching V76's intentional one-source lifecycle.
6. Resetting/clearing now invalidates asynchronous thumbnail work before the upload surface is restored.
7. Added an explicit before-unload processing guard and generated-output cleanup.
8. Ensured failed processing clears partially created output URLs instead of leaving stale generated objects in memory.
9. Kept replacement confirmation and reset behavior deterministic after a cancelled replacement.
10. Preserved ZIP progress and individual-download behavior.
11. Updated runtime/cache identities to V59 so stale service-worker/runtime assets are less likely to mask the new controller.

## 5. Final V59 lifecycle

`Upload` → validate file → inspect PDF → show source preview → `Remove`/clear returns to `Upload` → choose one relevant split mode → validate plan → optional large-job confirmation → processing lock → create PDFs → optional ZIP → result list → individual download / ZIP download → `Clear All` or `Split Another` → complete cleanup → upload state.

## 6. QA checks performed
- Node syntax check: Split PDF controller — PASS
- Node syntax check: Split PDF runtime — PASS
- Node syntax check: PDF library loader — PASS
- Required Split PDF data attributes: PASS
- Mode wrapper selectors: PASS
- V59 cache/runtime identifiers: PASS
- Source-row Remove handler: PASS by static controller inspection
- Before-unload cleanup/guard: PASS by static controller inspection

A real Android Chrome interaction test was not available in this environment, so this report does not claim a device-level browser certification. The supplied screenshots were nevertheless inspected directly and the specific visible mode-control defects were addressed.
