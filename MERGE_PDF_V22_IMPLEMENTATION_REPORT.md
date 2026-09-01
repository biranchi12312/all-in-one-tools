# Merge PDF v22 — v76 Deep Workflow Parity Fix

## v76 workflow audited
Upload -> dependency readiness -> PDF signature/type/size validation -> PDF.js readability/page inspection -> first-page thumbnail -> duplicate/batch/page limits -> rejection dialogs -> large-batch warning -> ordered queue -> desktop/touch reorder -> filename sanitization -> PDF-lib merge progress -> source-specific merge errors -> result preview/download -> Merge More -> Clear All/reset -> object URL cleanup.

## Root cause fixed
The v21 merge runtime contained an invalid JavaScript selector string for the merge action card:

`root.querySelector(".merge-action-card[data-step="actions"]")`

The nested double quote terminated the string early, causing the browser error `SyntaxError: missing ) after argument list`. Because the module could not parse, the Merge PDF runtime never initialized and the page-level error popup appeared. v22 uses a valid selector string and passes module syntax validation.

## v22 improvements
- Fixed the fatal syntax error that blocked initialization.
- Restored incremental upload behavior: one valid PDF can remain in the queue while the user adds another; merging stays disabled until two PDFs exist.
- Kept v21 limits and validation: PDF type/signature, empty files, 100 MB per file, 250 MB total, 20 files, 500 pages, duplicate detection, unreadable PDFs and password-protected PDFs.
- Preserved custom Oriva dialogs for rejected uploads, large batches, merge errors, Clear All and Merge More confirmations.
- Preserved first-page previews with object URL cleanup.
- Preserved sequential upload serialization and stale-session cancellation after reset.
- Preserved desktop drag reorder and improved touch reorder with centralized pointer handling so re-rendering does not detach the active gesture mid-drag.
- Preserved progress stages and filename-specific merge errors.
- Improved preview fallback for mobile/browser popup behavior by trying an anchor-based new-tab action before reporting failure.
- Preserved download, Merge More, Clear All, before-unload protection and pagehide cleanup.
- Bumped the service-worker cache version to avoid serving the old broken runtime after deployment.

## UI compatibility
No redesign was introduced. The existing v21 Merge PDF HTML structure and `tool-v2.css` classes are retained, so Upload, Review, Processing and Results continue using the existing v21 visual language.
