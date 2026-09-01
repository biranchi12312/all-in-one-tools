# OrivaStudio New v9 — Root Cause and Fix Report

## Issue 1: PDF.js console warning
The PDF-to-Images thumbnail renderer and conversion engine opened PDFs without a
`standardFontDataUrl`. PDFs that reference base PDF fonts such as Times-Italic
could therefore fall back to a warning during canvas rendering.

### Fix
PDF.js loading and document options are now centralized in
`assets/js/tools/pdf-library-loader.js`. Every PDF-to-Images rendering path uses
the same worker and standard-font configuration.

## Issue 2: Process action card visible on first load
The workflow CSS correctly hid `[data-step="actions"]` in the initial
`data-phase="upload"` state. A later v8 visual-layout rule, however, applied
`display: flex !important` (and `display: grid !important` on mobile) directly
to the action card. Because it had equal effective specificity and appeared
later, it overrode the initial workflow hide rule.

### Fix
Visual styling no longer owns the action card's `display` state. Final v9 phase
rules explicitly control visibility, including separate mobile rules:
- upload: hidden
- settings: visible
- processing: visible but runtime-disabled
- results: visible

## Cache boundary
The service-worker cache revision was changed to the v9 revision so updated
workflow and PDF runtime assets are not mixed with v8 cached files.
