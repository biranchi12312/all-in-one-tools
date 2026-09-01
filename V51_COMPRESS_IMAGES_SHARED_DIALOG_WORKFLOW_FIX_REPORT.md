# V51 Compress Images Shared Dialog & Workflow Fix

## Root causes fixed

1. Compress Images imported a dedicated `compress-images-dialog.js` controller while the other repaired tools use the shared `window.OrivaDialog` surface. This created a second modal lifecycle, markup structure and focus/body-lock path.
2. `Compress More Images` explicitly called `reset(true)` and then immediately called the native file input. That is why the gallery opened and no confirmation popup appeared.
3. The Compress Images page did not load `assets/js/ui/dialog.js`, so it could not participate in the same shared popup system as Resize, Crop & Rotate, Merge PDF, PDF to Images and Images to PDF.

## V51 implementation

- Removed the Compress Images dedicated dialog module from the runtime dependency path.
- Added the shared `assets/js/ui/dialog.js` before the Compress Images runtime.
- Reworked Compress Images popup calls to use `window.OrivaDialog` with the same error/warning/confirm contract used by the already repaired tools.
- `Clear All` now uses the shared confirm dialog with explicit `Clear All` and `Cancel` actions.
- `Compress More Images` now opens a shared confirmation dialog. Confirming resets to the upload state; cancelling preserves the completed result state.
- Removed the automatic `input.click()` from `Compress More Images`. Only Browse Files, the upload drop zone, keyboard activation, or drag-and-drop can start file selection.
- Added a defensive drop-zone click guard so an embedded Browse Files action cannot trigger a second picker path through event bubbling.
- Removed unused dedicated Compress Images popup CSS and module file.
- Bumped the changed page/runtime and service-worker cache revisions to prevent mixed v50/v51 assets after deployment.

## Expected flow

Upload -> validation/errors -> ready/settings -> compression -> per-file results -> failure/notes popups if needed -> result actions.

`Compress More Images`: confirmation popup -> confirm -> clean upload state, no gallery opens automatically.

`Browse Files`: native gallery/file picker.
