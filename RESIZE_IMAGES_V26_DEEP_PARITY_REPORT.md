# Resize Images v26 — Deep Parity Implementation Report

## Source studied
- v76 `resize.js` end-to-end, including upload validation, duplicate handling, mode logic, aspect locking, output encoding, progress, partial failures, ZIP download, clear confirmation, cleanup and unload protection.
- v76 `resize-images.html` control structure and limits.
- v76 shared dialog and processing behavior.
- Current v25 generic image runtime and its broad `tool-v2.css` phase/action selectors.

## Root-risk identified before implementation
The generic v25 runtime shares `data-step="status"` between the status card and progress card, while broad CSS uses `display: ... !important` for phases. This is the same class of lifecycle conflict that caused the Merge PDF action-card/progress problems. The generic action card also remains in the DOM across phases.

## v26 architecture
Resize Images now uses a dedicated `resize-images-runtime.js` and a dedicated `.resize-workspace` lifecycle. The editable action card is physically detached outside the SETTINGS phase. Progress has its own `data-step="progress"`, so it cannot be activated by status selectors. Dedicated resize rules are appended after generic rules and are scoped only to `.resize-workspace`.

## v76 workflow parity covered
1. Incremental upload and drag/drop.
2. JPG/JPEG, PNG and WebP validation by MIME/extension.
3. Empty file, per-file size, total size, file-count and duplicate checks.
4. Rejected-file aggregation popup.
5. File previews and per-file removal.
6. Fit inside, Exact size and Percentage modes.
7. Aspect-ratio locking with dimension synchronization.
8. Don’t-enlarge behavior.
9. 9000px / 40MP source safety checks and 4096px output cap.
10. Output format and JPEG/WebP quality handling.
11. Progress only during processing.
12. Per-file partial failure rows and aggregated failure popup.
13. Individual downloads and ZIP download for two or more results.
14. Clear All confirmation and Resize More confirmation path.
15. Object URL cleanup and beforeunload processing protection.

## Explicit lifecycle
UPLOAD -> SETTINGS -> PROCESSING -> RESULTS.
The action card exists only in SETTINGS. The progress card is shown only during PROCESSING. Results are shown only in RESULTS.
