# v56 Convert Images Fixed-Tool Parity Root-Cause Fix

## Root cause

The v55 converter lifecycle was functionally stable, but its selected-file surface still used a converter-specific queue renderer and CSS contract instead of the queue structure already used by the fixed Image Compressor. That created three visible mismatches in the mobile screenshots:

1. The header used `Selected images` plus an inline count, which compressed the summary text together.
2. Converter thumbnails were smaller and the row geometry differed from the established fixed-tool queue.
3. The `Remove` action was rendered as borderless text instead of the standard outlined action, so multiple-file rows did not visually match the other fixed tools.

## v56 correction

- Rebuilt only the converter selected-file renderer to use the same batch-summary + file-row + image-file-preview + file-text-meta + uploaded-status structure as the fixed Image Compressor.
- Matched the same 72px preview, spacing, borders, file metadata and outlined Remove action.
- Preserved the converter upload surface, shared dialog runtime, popup behavior, validation, processing, ZIP download and Clear All lifecycle.
- Kept PNG/JPG/WebP conditional settings from v55 intact; PNG still removes the optional quality card completely.
- Did not add a popup controller or a separate visibility architecture.
- Advanced converter CSS/runtime cache references to v56.

## Expected state

After selecting one or multiple images, the converter queue should now visually and structurally follow the already-fixed Image Compressor behavior while retaining converter-specific output controls and conversion processing.
