# Crop & Rotate v32 — Root Cause Fix

## Exact v31 issue visible in the test screenshot
The crop selection itself was rendered as a black rectangle while the rest of the image remained dimmed. This was not a CSS, phase-state, popup, or ResizeObserver issue.

## Root cause
The preview renderer used one canvas and performed this sequence:

1. Draw the transformed image.
2. Paint a semi-transparent black rectangle over the entire canvas.
3. Call `clearRect()` inside the crop rectangle to try to reveal the image below.

Canvas does not retain a hidden copy of previously painted pixels. `clearRect()` removes the already-rendered image pixels from that rectangle. On mobile, the resulting transparent/opaque compositing path displayed that cleared area as black, producing the exact black crop region shown in the screenshot.

## v32 fix
The preview renderer now:

1. Draws the transformed image once.
2. Calculates the crop rectangle.
3. Paints four separate dimming rectangles only outside the crop area: top, bottom, left, and right.
4. Never calls `clearRect()` to reveal the selected region.
5. Keeps the crop border and handles above the untouched source image.

The crop/export math, lifecycle phases, reset confirmation, download flow, and v31 ResizeObserver removal remain unchanged.

## Regression target
The selected crop area must always show the original image at normal brightness. Only the area outside the crop frame may be dimmed.
