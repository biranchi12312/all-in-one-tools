# V49 Compress Images — Dialog and Action Surface Root Fix

## Root causes found in V48

1. **Dialog CSS ownership was incomplete.** Compress Images loaded `base.css` and its own dedicated page CSS, but the shared dialog's core `dialog.oriva-modal` and `.oriva-modal-card` rules lived in `foundation.css`, which this page did not load. The runtime therefore created a valid dialog, but mobile browsers rendered it with default white dialog styling.

2. **Prompt fallback could silently skip UI.** If `window.OrivaDialog` was unavailable because of an offline/stale-cache load mismatch, the controller resolved the prompt promise instead of showing a visible fallback. That made popup behavior appear inconsistent.

3. **The original action surface was not explicitly removed during processing/results.** The controller changed button text to `Compressing...` but left the action container visible. During a completion/note dialog, the stale action buttons remained behind the popup, exactly as seen in the V48 screenshot.

## V49 changes

- Added a fully self-contained Compress Images dialog surface matching the existing dark OrivaStudio tool UI.
- Styled backdrop, panel, icon variants, title, message, error list, buttons and mobile layout locally for this page.
- Added a visible native confirm/alert fallback instead of silently resolving when the shared dialog API is unavailable.
- Added explicit `enterProcessingSurface()` and `enterResultsSurface()` ownership.
- Hides the original Clear All / Compress Images action surface while processing and keeps it hidden after results.
- Preserves only result actions after completion: Compress More Images and Download All as ZIP when outputs exist.
- Updated the service-worker revision and page asset query revisions to prevent V48/V49 CSS and runtime mixing.

## Expected V49 behavior

- Kept-original / resize notes appear in the same dark popup structure as other tool prompts.
- Invalid upload, processing failure, ZIP failure and Clear All confirmation use the same modal structure.
- If the shared dialog runtime is unavailable, the user still sees a visible browser prompt instead of a silently skipped one.
- The stale `Compressing...` and Clear All buttons do not remain on the result screen or underneath a popup.
