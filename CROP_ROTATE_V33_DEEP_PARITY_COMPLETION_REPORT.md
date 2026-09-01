# Crop & Rotate v33 — Deep Parity Completion

## Reference study
The v76 Crop & Rotate workflow was studied as a behavioral reference only. Its source was not copied. The v33 implementation remains inside the modular v32 architecture and uses a dedicated Crop & Rotate runtime plus a rebuilt engine lifecycle.

## v32 gaps completed

1. **Generic runtime leakage** — Crop & Rotate was still using the generic image-tool runtime. That left result/action/status behavior coupled to other image tools and made removal/clear transitions less deterministic.
2. **Incomplete result lifecycle** — the generic result list had only a row-level download and an appended clear button. v33 provides a dedicated result card with Download, Edit Another and Clear All.
3. **Empty-file removal cleanup** — generic removal could move the workflow to upload without calling the crop engine reset. v33 always resets engine state and revokes source/result URLs when the current image is removed or cleared.
4. **Canvas measurement dependency** — preview drawing measured the canvas itself while CSS also constrained it. v33 measures the stable wrapper and sizes the intrinsic canvas from that space, without ResizeObserver.
5. **PNG alpha preservation** — v32 requested alpha-false contexts for intermediate/output canvases, which could flatten transparent content. v33 keeps alpha for PNG/WebP and explicitly fills white only for JPG.
6. **Format/quality behavior** — PNG does not use encoder quality. v33 disables the quality control while PNG is selected.
7. **Interaction feedback** — flip controls now retain an active state, while ratio selection remains explicitly synchronized after every reset/load.
8. **Lifecycle isolation** — upload, settings, processing and results each have Crop-specific CSS authority. The action card cannot reappear in upload/results and progress cannot survive outside processing.
9. **Error/confirmation parity** — unsupported, empty, oversized, decode and export failures use the shared dialog surface; Reset edits, Edit Another and Clear All are confirmation-gated.

## End-to-end v33 flow
Upload / drag-drop / keyboard activation → validation → decode → editor → free or preset crop → move/resize → rotate/flip → optional Reset edits → export with processing status/progress → dedicated result card → Download / Edit Another / Clear All → confirmed cleanup back to upload.

## Regression checks performed
- `node --check` on the dedicated runtime and crop engine.
- Verified Crop page no longer initializes the generic `image-tools.js` runtime.
- Verified dedicated lifecycle selectors are scoped to `.crop-workspace`.
- Verified no `ResizeObserver` is used by the crop engine.
- Verified result and source object URLs have explicit cleanup paths.
