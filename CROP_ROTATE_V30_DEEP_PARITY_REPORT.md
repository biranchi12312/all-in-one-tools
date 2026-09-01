# Crop & Rotate v30 — Deep Parity / Root-Cause Fix

## Reference study scope
The v76 Crop & Rotate workflow was studied for lifecycle behavior, validation, crop interaction, transform ordering, popup behavior, reset behavior, export, download, and cleanup. Its code was not copied into this implementation; the v30 tool was rebuilt within the current modular runtime and UI architecture.

## Root causes found in the previous v30 tool

1. **Preview/export transform mismatch**
   - The old editor drew the untransformed source image in the crop canvas.
   - Rotation and flips were applied only during export.
   - A crop selected after rotating could therefore describe a different image region than the exported result.

2. **Incorrect crop-ratio geometry after rotation**
   - Ratio calculations used the source image geometry rather than the active transformed geometry.
   - 90°/270° rotation changes the effective width/height and must change ratio fitting accordingly.

3. **Weak crop interaction model**
   - The previous editor had only move-or-create behavior and no true edge/corner resize model.
   - Small crop bounds and ratio constraints were not protected by one consistent clamp path.

4. **Shared lifecycle CSS leakage**
   - Crop & Rotate inherited broad `.workspace[data-phase]` rules plus later rules written for Merge PDF and Resize Images.
   - Those overlapping selectors could force hidden workflow surfaces back into the layout.

5. **Progress surface was misclassified**
   - The progress element was tagged as `data-step="status"` instead of owning a distinct progress step.
   - That allowed status visibility rules to affect the progress bar outside processing.

6. **`hidden` was not authoritative**
   - Existing display rules could override the browser's normal hidden state for flex/grid elements.
   - Empty status/action/progress surfaces could therefore survive after a phase change.

7. **Error and clear lifecycle gaps**
   - Validation and processing failures mainly surfaced as inline status text.
   - The old generic reset did not provide the crop-specific confirmation flow or a clear path after the result screen.

8. **Upload activation/accessibility gap**
   - The visible drop surface was styled as an upload control but the runtime only wired the browse button directly.
   - Keyboard and direct surface activation were not consistently supported.

## v30 architecture changes

- Added an isolated `crop-workspace` phase contract for exactly four phases: `upload`, `settings`, `processing`, `results`.
- Assigned each surface exactly one workflow step: upload, files, settings, safety, status, progress, results, actions.
- Made `hidden` authoritative inside the Crop & Rotate workspace.
- Rebuilt the crop engine with one transformed coordinate model shared by preview and export.
- Rotation and flips are now rendered into the preview before the crop overlay is drawn.
- Crop ratios use transformed dimensions, including the `Original` ratio.
- Added edge/corner handle hit-testing, move, create-new-area, minimum crop size, and centralized crop clamping.
- Added JPG/PNG/WebP export with quality control where the encoder supports quality.
- Added source safety checks: supported type, non-empty file, 100 MB maximum, 40 MP maximum, 9000 px maximum source side, 4096 px maximum output side.
- Added error popups for upload/processing failures and confirmation popups for Reset edits and Clear All.
- Added a Clear All action on the completed result surface.
- Added direct drop-surface click and keyboard activation while preserving the native user-activation path for the file chooser.
- Ensured source and result object URLs are revoked on replacement/reset.

## Lifecycle regression targets

### Upload
Only the upload surface is visible. No file row, editor, safety note, action card, status card, progress bar, or result shell is rendered.

### Settings
The uploaded file row, editor, safety note, and action card are visible. Progress and result surfaces are hidden. Status appears only when it actually has a visible message.

### Processing
Only processing status/progress are visible. Upload, editor, action card, and result surfaces are removed from the active layout.

### Results
Only the completed result shell is visible, including Download and Clear All. Editor/action/progress/status surfaces are not retained.

## Expected user flow
Upload → validation/decode → edit/crop/rotate/flip → optional reset confirmation → export → download → Clear All confirmation → clean upload state.
