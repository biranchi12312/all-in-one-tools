# V47 Compress Images — Deep Parity and Completion Pass

## Scope
Only the Compress Images tool was changed. The work started from the V46 release and used the V76 Compress Images workflow as a behavioral reference. V76 source was studied for behavior; its code was not copied into the V47 implementation.

## Exact V46 root-level gaps identified

1. **Upload additions were not operation-serialized**
   Rapid file picker/drop events could overlap because V46 had no compressor-owned addition queue. V47 serializes additions with a dedicated `addChain`.

2. **No tool-level operation ownership lock**
   V46 only used local `busy` state. It could not reliably reject a second overlapping site operation. V47 acquires/releases `window.__orivaProcessing` only for this compressor operation and restores it in `finally`.

3. **Processing controls were not fully governed from one state transition**
   V46 disabled some controls directly inside `process()`. V47 uses one `setProcessingState()` path for input, browse button, start/reset, quality, output format and drop-zone accessibility state.

4. **Decoder fallback was incomplete**
   The V46 engine delegated to a helper that selected `createImageBitmap()` whenever it existed, but did not fall back if that API rejected a particular image. V47 attempts oriented bitmap decode, normal bitmap decode, then an `Image`-element decode fallback.

5. **Completion semantics were incomplete for total batch failure**
   V46 could end with a generic ready status even when every item failed. V47 distinguishes partial success from zero-success completion and shows a specific error state while preserving per-file error rows.

6. **Failure handling needed stricter continuation semantics**
   V47 keeps the batch sequential, records failures per file, continues with later files, and summarizes failures after the loop instead of aborting the entire batch.

7. **Lifecycle cleanup needed explicit ownership**
   V47 revokes preview URLs on remove/reset and output URLs before new result cycles/reset. Canvas and decoded image resources are also released in the engine.

8. **Reload-during-processing protection was missing**
   V47 adds a `beforeunload` guard while compression is active.

9. **ZIP dependency retry behavior was weak**
   V47 removes a failed JSZip load promise from its loader map so a later retry can load the dependency again.

10. **Duplicate runtime initialization was not explicitly guarded**
    V47 marks the tool root as initialized so accidental repeated runtime execution cannot attach a second compressor controller.

## V76 behavior mapped into V47

- JPG/JPEG, PNG and WebP validation, including extension fallback.
- 100-file limit, 100 MB per-file limit and 500 MB total batch limit.
- Incremental uploads append to the current queue.
- Invalid files are skipped and summarized in an error popup.
- Per-file preview, metadata, uploaded state and removal.
- Confirmation before Clear All when a queue exists.
- Sequential one-file-at-a-time compression with live progress.
- 40 MP / 9000 px source safety rejection and 4096 px output downscale.
- Keep-original decision when keep-format recompression does not reduce file size.
- Per-file failure continuation and summary popup.
- Safe-resize and original-retention notes.
- Individual downloads, multi-file ZIP and Compress More reset.
- Preview/output object URL cleanup.
- Processing reload guard.

## V47 architecture

- `image-tools/compress-images.html` — compressor surface only.
- `assets/css/tools/pages/compress-images.css` — compressor-scoped CSS only.
- `assets/js/tools/runtimes/compress-images.js` — dedicated bootstrap.
- `assets/js/tools/controllers/compress-images.js` — dedicated workflow/state/UI controller.
- `assets/js/tools/engines/compress-images.js` — dedicated image processing engine.

No PDF tool runtime, crop runtime, resize runtime or shared PDF dependency is imported by the compressor implementation.

## Validation performed

- Controller syntax check: PASS.
- Engine syntax check: PASS.
- Runtime syntax check: PASS.
- Controller and engine ES-module import smoke test: PASS.
- Project runtime isolation test: PASS for all eight current tool routes.
- Project tool isolation test: PASS for all current tool pages, including dedicated Compress Images controller.
- Compressor source audit: no foreign PDF/Crop/Resize selector or engine references found in the dedicated compressor CSS/controller/engine.

## Cache/deployment handling

The Compress Images CSS and runtime query revisions were moved from `v=46` to `v=47`, and the service-worker cache identifier was moved to the V47 release value so a repaired compressor build is not mixed with stale cached V46 assets.
