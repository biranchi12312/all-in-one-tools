# OrivaStudio v42 — Real Browser Testing Guide

## Status
The five priority tools are ready for manual browser testing now. v41 proved source-level parity and isolation; v42 defines the live browser certification stage.

## Important: test through HTTP/HTTPS, not file://
Use Netlify deployment or another local web server. Do not double-click HTML files from a file manager, because ES modules, fetch/import paths, Service Worker behavior, and some browser APIs can behave differently under file://.

## Fastest user testing method
1. Extract the ZIP.
2. Deploy the extracted project folder to a Netlify test site, or run it from a local HTTP server.
3. Open the site in Chrome/Edge/Firefox.
4. Hard refresh once after deployment and, if an older build was previously used, clear site data/cache.
5. Test the five tools below in separate browser sessions or after a complete Clear/Reset.

## Priority Tool Matrix

### 1. Merge PDF
- Upload one valid PDF: it must remain in the collecting state.
- Try to start merge with only one PDF: verify the intended validation popup/behavior.
- Add a second PDF later: review/next workflow must activate.
- Add invalid/non-PDF: verify error popup.
- Try duplicate PDF where supported: verify duplicate handling.
- Remove a file and verify state rolls back correctly.
- Merge two or more PDFs and download the result.
- Clear All and verify all cards, result surfaces, progress, and object state reset.

### 2. Images to PDF
- Upload valid images.
- Add more images incrementally.
- Try an invalid file.
- Change available output settings/order where exposed.
- Create PDF, verify processing/result, and download.
- Use Create Another/Clear path and verify the tool returns to a clean initial state.

### 3. PDF to Images
- Upload a valid PDF.
- Verify thumbnails/options load.
- Try invalid file and, if available, password-protected PDF.
- Test PNG/JPG output paths.
- Export and download ZIP/result.
- Clear/reset and verify thumbnails and result state disappear.

### 4. Resize Images
- Upload one image, then add another incrementally.
- Test Fit, Exact, and Percentage modes.
- Test invalid dimensions if the UI allows them.
- Process and download output.
- Test Resize More/Clear and confirm no stale result/progress/action state remains.

### 5. Crop & Rotate
- Upload a valid image and verify the editor appears.
- Test crop movement, rotation, flip, and aspect-ratio controls.
- Export and download the edited image.
- Use Edit Another and verify the editor resets cleanly.
- Clear All and verify complete cleanup.

## What to capture if anything fails
For each failure, capture:
- Tool name and browser/device.
- Exact steps.
- Screenshot or screen recording.
- Browser console error text, if any.
- Whether the failure happens after refresh or only after repeated use.
- The file type and approximate file size (do not share private document contents).

## Certification rule
A tool should be marked live-certified only after its valid workflow, invalid/error workflow, result/download workflow, and reset/clear workflow have all passed in a real browser.
