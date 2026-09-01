# V48 Compress Images — Deep Workflow Rebuild

## Scope
Only the Compress Images implementation was rebuilt from the V47 release. V76 was used as a behavior reference and its source was inspected for workflow, validation, progress, failure, popup, cleanup and download semantics. V76 code was not copied into the V48 controller or engine.

## V47 root causes corrected

1. **Controller-owned visibility and CSS-owned visibility were competing.**
   V47 used broad `data-phase` CSS rules that forcibly hid large parts of the workspace during processing and results. That made valid controller state transitions appear as missing or incomplete UI. V48 removes those phase-wide display overrides. `[hidden]` and explicit controller state now own visibility.

2. **Completion state did not preserve the real workflow surface.**
   V47 collapsed the upload/queue/settings/action surface when entering results. V48 keeps the normal uploaded-file context intact and adds the results surface below it, matching the V76 lifecycle more closely while preserving the current V47 visual system.

3. **Progress completion semantics were lost.**
   V47 reset and hid the progress panel immediately after processing. V48 leaves a 100% `Compression complete` state until the user changes the workflow, then clears it on reset/new processing.

4. **Result rows lost source visual context.**
   V47 results had no image preview. V48 renders each result with its source preview, name, compression metadata and individual download state.

5. **ZIP visibility differed from the reference behavior.**
   V47 only exposed ZIP for two or more outputs. V48 exposes the ZIP action whenever at least one successful output exists, while retaining individual downloads.

6. **Processing ownership used a fragile boolean pattern.**
   V48 uses an operation token and only releases the global lock when the compressor still owns it, reducing accidental cross-operation unlocks.

7. **Upload, reset, result cleanup and Object URL ownership were re-audited together.**
   V48 serializes additions, clears stale results before a changed queue, revokes removed/reset previews, revokes prior output URLs before a new result cycle and releases ZIP URLs after download.

8. **Per-file failure continuation was retained as an explicit contract.**
   A single decode/encode failure produces a failed row and failure summary without aborting later files. A zero-success batch is not reported as successful.

9. **Engine fallback and JPEG alpha handling were kept defensive.**
   Decode attempts use oriented bitmap decode, standard bitmap decode, then an Image-element fallback. JPEG output paints a white background before drawing so transparent source pixels do not produce an undefined black background.

## V48 behavior map

- Upload by browse, click, keyboard or drag/drop.
- Sequentially serialized additions.
- JPG/JPEG, PNG and WebP validation with extension fallback.
- Empty-file, per-file, batch-size and count-limit rejection popups.
- Incremental queue append and per-file remove.
- Confirmation before Clear All.
- Quality updates before processing.
- Existing output-format control retained from the V47 UI; `Keep original format` follows compressor semantics.
- Sequential one-at-a-time processing with progress and responsive event-loop yields.
- 40 MP / 9000 px source safety rejection.
- 4096 px maximum output edge downscale.
- Keep-original fallback when keep-format recompression is not smaller.
- Per-file success/failure rows and continuation.
- Completion, partial-failure and zero-success status distinctions.
- Compression notes popup for safe resize/original retention.
- Individual download and ZIP download.
- Compress More reset and full Clear All lifecycle.
- Preview/output Object URL cleanup and reload warning while active.

## Validation run

- Controller syntax check: PASS.
- Engine syntax check: PASS.
- Runtime syntax check: PASS.
- `v36-isolation-tests.mjs`: PASS for all eight tools.
- `v35-runtime-isolation.mjs`: PASS for all eight tool routes.
- `v38-tool-boundary-audit.mjs`: PASS for runtime and CSS boundaries.
- `v37-tool-certification.mjs`: 9/9 PASS.
- Dedicated compressor source audit: no PDF, Crop or Resize runtime/engine imports in the compressor controller or engine.

A full real-device file interaction pass should still be performed in the user's browser because mobile browser decode behavior, memory pressure and download permissions cannot be reproduced perfectly by static syntax/isolation checks.
