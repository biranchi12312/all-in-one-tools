# Crop & Rotate v33 QA Checklist

## Upload and validation
- Direct drop-zone click opens native file chooser from the click event.
- Enter/Space on the drop zone opens the chooser.
- Drag and drop accepts one file only.
- JPG, PNG and WebP are accepted.
- Unsupported, empty and >100 MB files use an error popup.
- Decode and dimension safety failures return to a clean upload state.

## Editor
- Preview and export use the same transformed coordinate model.
- Free, Original, 1:1, 4:5, 3:4, 16:9 and 9:16 are available.
- Crop can be moved, recreated, and resized from corners/edges.
- Rotate left/right uses 90-degree steps.
- Horizontal and vertical flips are supported.
- Reset edits requires confirmation.
- Selected crop area remains visible; only the outside mask is dimmed.
- No ResizeObserver is used by the crop engine.

## Export and cleanup
- JPG fills transparency with white.
- PNG preserves alpha.
- WebP uses normal alpha-capable canvas output.
- Output side is capped at 4096 px while preserving crop aspect.
- Progress is visible only during processing.
- Result phase contains Download, Edit Another and Clear All.
- Edit Another/Clear All require confirmation when a file is active.
- Removing the file performs engine cleanup.
- Source and result object URLs have explicit cleanup paths.
