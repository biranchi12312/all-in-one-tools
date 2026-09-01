# V45 Compress Images — v76 Behavioral Rebuild

## Scope
Only the Compress Images tool was rebuilt. Other tools were not modified.

## v76 behavior mapped
- Incremental upload: later selections append to the current queue.
- Accepted formats: JPG/JPEG, PNG and WebP.
- Limits: 100 files, 100 MB per file, 500 MB total batch.
- Invalid, empty, oversized, over-count and over-total files are skipped with an error popup listing the rejected items.
- Queue rows show preview, name, size/type, uploaded confirmation and per-file remove.
- Clear All asks for confirmation when a queue exists.
- Compression is single-operation, sequential and shows per-file progress.
- Safe processing limits reject excessively large source resolution and downscale outputs above the safe maximum dimension.
- If recompression in keep-format mode is not smaller, the original is retained.
- Per-file failures do not abort the remaining batch; failures are summarized in a popup.
- Notes are shown when safe resizing or original retention occurred.
- Individual downloads, ZIP download and Compress More reset are supported.
- Preview and output object URLs are revoked on removal/reset/new result cycles.

## Root causes found in v44
- Generic controller contained PDF preview/loading dependencies that did not belong to Compress Images.
- Current max total batch limit was 250 MB instead of v76's 500 MB.
- Controller used generic lifecycle behavior instead of a compressor-owned state contract.
- Engine lacked v76-equivalent safe source resolution/downscale behavior and per-file continuation semantics.
- Tool stylesheet was polluted with selectors copied from PDF-to-Images, Images-to-PDF and Crop/Rotate work.
- Progress shared `data-step="status"`, recreating the same class of lifecycle collision previously seen in other tools.

## Rebuild
- Dedicated controller rewritten for Compress Images only.
- Dedicated engine rewritten around compressor-specific limits and output decisions.
- Runtime reduced to a dedicated initializer.
- HTML given explicit upload, queue/settings, processing, results and reset surfaces.
- CSS replaced with a self-contained Compress Images stylesheet; no foreign tool selectors remain.
- Progress moved to its own lifecycle step.
- Service-worker revision and changed asset query revisions updated for deployment cache safety.
