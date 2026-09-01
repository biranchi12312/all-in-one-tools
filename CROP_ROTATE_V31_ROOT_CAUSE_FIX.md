# Crop & Rotate v31 — Root Cause Fix

## Exact v30 failure

The screenshots exposed the Chromium console error `ResizeObserver loop completed with undelivered notifications.` The v30 crop engine created a `ResizeObserver` on the crop canvas wrapper. Its callback called `draw()`. `draw()` changed the canvas intrinsic width/height and also wrote a CSS `aspect-ratio`, which changed layout of the observed region. That created a resize → observer → draw → resize feedback cycle. The production error handler then converted that browser error into the visible “Something went wrong” dialog.

## v31 root-level correction

1. Removed the crop engine `ResizeObserver` entirely.
2. Replaced it with one requestAnimationFrame-throttled scheduler for window resize/orientation changes.
3. Removed script-written canvas CSS aspect ratio so rendering does not mutate observed layout.
4. Deferred the first image draw with requestAnimationFrame because the generic runtime calls the engine before changing the workspace from `upload` to `settings`; measuring a hidden canvas produced a zero-width first draw.
5. Cancelled pending scheduled draws during reset.
6. Added Crop & Rotate-only progress visibility isolation so progress cannot surface in upload/settings/results states.

## Expected regression result

Uploading an image must move directly from upload to the editable crop workspace without a ResizeObserver console error, without the generic “Something went wrong” dialog, and without needing a second upload or reset. Rotation, crop dragging, export, result download and Clear All remain in the same runtime lifecycle.
