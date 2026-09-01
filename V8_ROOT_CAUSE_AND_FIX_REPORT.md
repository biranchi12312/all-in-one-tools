# V8 Root Cause and Fix Report

## Root cause 1 — stale mixed runtime assets
The previous service worker used cache-first behavior for un-hashed JavaScript and CSS. Replacing files under the same paths could therefore mix a newer HTML page with older runtime or stylesheet revisions.

### Fix
- Worker cache version changed to `orivastudio-v8-asset-consistency`.
- Old OrivaStudio caches are deleted on activation.
- Same-origin documents and runtime assets now use network-first with cached fallback.
- Service worker registration targets `sw.js?v=8` and requests an immediate update.
- Un-hashed JS and CSS receive `must-revalidate` headers for deployment environments that honor `_headers`.

## Root cause 2 — invalid PDF thumbnail module path
V7 attempted to dynamically import `../vendors/pdfjs/pdf.min.mjs`, but that file is not present in the build. This produced the console `Failed to fetch dynamically imported module` error.

### Fix
The thumbnail renderer now reuses the existing `loadPdfJs()` loader. Thumbnail generation is optional; failure leaves the PDF placeholder without emitting a workflow-breaking console warning.

## Root cause 3 — generic production CSS conflicted with tool UI
Tool pages imported `production.css`, which declared `color-scheme: light` and a mobile sticky `.tool-actions` rule. That generic production layer conflicted with the dedicated dark tool action layout.

### Fix
- Tool pages no longer import `production.css`.
- Tool action styling is isolated under `.tool-v2 .workspace > .tool-actions[data-step="actions"]`.
- The action panel is explicitly normal-flow (`position: static`), dark, responsive, and independent of generic `--surface`/`--line` variables.

## Verification targets
1. Every tool accepts a valid file and advances from upload to settings.
2. PDF-to-Images shows a PDF thumbnail when PDF.js is available.
3. Missing thumbnail dependencies do not break file upload.
4. Tool action panel is not sticky/fixed and scrolls with the document.
5. Tool CSS and runtime are refreshed together after deployment.
