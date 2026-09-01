# V43 — PDF to Images Root Fix

## Browser issues reproduced from V42 screenshots

1. **Duplicate readiness messaging** appeared after a PDF was added:
   - `Ready to convert 5 pages to PNG.`
   - `1 PDF ready. Review the settings, then continue.`
2. **An empty/inactive progress bar surface appeared before conversion started.**
3. **The pre-conversion `Clear All / Convert to Images` action card survived into the completed result state.**
4. **Completion status text could coexist with the result shell, creating two competing completion surfaces.**

## Root causes

The page stylesheet had accumulated lifecycle selectors for unrelated Merge PDF, Resize Images, Images to PDF, and Crop & Rotate workspaces. In addition, broad selectors targeted every `[data-step="status"]`, which could override the browser `hidden` attribute with `display: block !important`.

The progress element was also incorrectly labelled `data-step="status"`, so it inherited status visibility rules even when `hidden` was set.

The runtime additionally emitted a success status during the review state even though the dedicated readiness card already communicated that state.

## Fix architecture

- Replaced `pdf-to-images.css` with a **tool-owned stylesheet containing only PDF to Images selectors**.
- Changed the progress surface to its own lifecycle step: `data-step="progress"`.
- Made `[hidden]` authoritative inside the tool page.
- Defined explicit upload, settings, processing, and results visibility contracts.
- Removed review-state success duplication; the dedicated readiness copy now owns that message.
- Removed completed-state success duplication; the results header owns completion messaging.
- The pre-conversion action bar is explicitly suppressed in `results`.
- Result actions remain inside the results shell only.
- Added a versioned import for the updated PDF-to-Images runtime to reduce stale module caching during local/browser QA.

## Expected lifecycle

`upload → settings → processing → results`

Only one primary action surface and one primary status surface are allowed per lifecycle state.
