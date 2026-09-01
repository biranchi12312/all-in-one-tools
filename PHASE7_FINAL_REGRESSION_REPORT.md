# Phase 7 — Final Functional Regression Pass

## Scope
This pass reviewed the Phase 6 production build for regressions in the actual tool-engine source and corrected two PDF-engine defects before release.

## Corrected issues

### 1. Split PDF page-range parser
The generated JavaScript contained over-escaped regular expressions. Page values such as `1-3, 7, 10-12` would not be parsed correctly.

Corrected to real JavaScript digit/range patterns.

### 2. PDF-to-Images render safety guard
The previous render check incorrectly compared page pixels against the square of the page-count limit. A normal PDF page could therefore be rejected as too large.

The check now uses an explicit `MAX_RENDER_PIXELS = 40,000,000` limit.

### 3. Processing interaction lock
Image and PDF workspaces now expose a processing state to the shared production layer so file-removal and browse interactions are visually and functionally restrained during active processing.

## Regression coverage
- JavaScript syntax check
- Local relative reference scan
- Required route existence
- Tool branch presence
- Split-range parser source verification
- PDF render safety guard verification

## Remaining validation
Real device/browser tests with representative image and PDF files are still recommended after deployment because browser decoding, canvas support and PDF runtime behavior depend on the actual browser environment.
