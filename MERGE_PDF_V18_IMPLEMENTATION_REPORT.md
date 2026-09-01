# Merge PDF v18 Implementation Report

## Scope
The Merge PDF tool was rebuilt as a dedicated workflow in v18 after comparing the v17 generic runtime with the earlier v76 Merge PDF behavior. The v76 source was used for functional study, not copied into the v18 codebase.

## Functional parity implemented
- Sequential PDF validation before adding files
- PDF signature/readability checks and password-protection rejection
- 2–20 file limit, 100 MB per file, 250 MB batch limit and 500-page limit
- Page counts shown per file and in the batch summary
- Duplicate-file protection
- First-page PDF previews
- Arrow and drag/drop reordering
- Per-file removal
- Soft warnings for large files, batches and page counts
- Safe output-name sanitization
- Dedicated processing progress
- PDF merge using pdf-lib while preserving selected order
- Completion card with merged-file count, page count, output size, Merge More PDFs and Download PDF
- Clear All and Merge More confirmation dialogs
- Object URL cleanup on reset/page exit

## Architecture
`merge-pdf` no longer runs through the generic `tool-runtime.js` path. `pdf-tools.js` now dispatches it to `merge-pdf-runtime.js`, which owns state, validation, phase transitions, results and cleanup. Dedicated `.merge-workspace` CSS also prevents generic workflow rules from leaking the editable action card into processing or results.
