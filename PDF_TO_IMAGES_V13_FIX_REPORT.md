# PDF to Images — V13 Root-Cause Fix Report

## Scope
V13 is based directly on New v12. Only the PDF to Images workflow and the shared phase-visibility rule that caused the visible empty progress shell were changed.

## Root cause 1 — empty bar/card near the footer
The result phase used `[data-step="status"] { display: block !important; }`. Both the textual status and the progress component share `data-step="status"`. When conversion completed, the runtime correctly set the progress component to `hidden`, but the result-phase CSS overrode the browser `hidden` state with `display: block !important`. That exposed an empty progress shell with only its inactive track visible.

### Fix
Result-phase visibility now targets only `.tool-status[data-tool-status]`. The PDF to Images result phase also explicitly keeps `[data-progress-wrap]` hidden. Processing phase behavior is unchanged, so progress remains visible only while active.

## Root cause 2 — PDF.js Times-Italic console warning
The warning is emitted by PDF.js while resolving optional standard/system font fallback. The previous runtime already passed `standardFontDataUrl`, but document verbosity was not explicitly controlled and a previously loaded PDF.js instance could bypass worker reconfiguration.

### Fix
The PDF loader now always re-applies worker configuration, including when PDF.js already exists. Every document option created through the shared helper now uses the standard-font URL and `verbosity: 0`, suppressing non-fatal PDF.js warning noise while retaining real thrown errors and user-facing conversion failures.

## Additional lifecycle hardening
PDF thumbnail jobs now use a render-generation token. A stale asynchronous thumbnail job cannot insert a revoked object URL after a file-list rerender or reset.

## V76 workflow parity retained
- serialized upload intake via `addChain`
- partial acceptance and per-file validation
- PDF signature/readability inspection
- password/encryption rejection
- duplicate, file-count, per-file, batch-size and page-count limits
- PDF thumbnail with visible fallback
- per-file Remove and confirmed Clear All
- PNG/JPG selection and JPG quality
- safe canvas limits and sequential rendering
- per-page progress and UI yielding
- individual download and ZIP download
- Convert More confirmation and full cleanup
