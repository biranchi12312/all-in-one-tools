# OrivaStudio V61 — Split PDF Exact Root-Cause Fix

## Screenshot-confirmed defects fixed

### 1. Replace / Remove appeared inactive after upload
**Exact root cause:** `addFile()` sets `state.busy = true` before PDF inspection and calls `renderFile()` while that flag is still true. `renderFile()` copied that transient state into the newly-created source buttons with `disabled = state.busy`. The `finally` block later changed `state.busy` back to `false`, but it never re-rendered the source row, so the DOM kept `disabled` attributes permanently.

**V61 fix:** source buttons are created enabled, processing still disables them through the dedicated processing lifecycle, and the source row is re-rendered after successful inspection completes. This makes Replace and Remove genuinely clickable after upload.

### 2. Split mode showed Chunk size while Page ranges was selected
**Root cause:** the chunk wrapper did not have an initial `hidden` state in HTML, and the mode visibility depended on runtime mutation. V61 makes the hidden state explicit in markup, updates mode state immediately after source acceptance, and records the active mode on the workspace for deterministic CSS visibility.

**V61 fix:** Page ranges and Every N pages controls are mutually exclusive at first paint and after every mode change.

### 3. Result-stage Split Another / Clear All used browser-default white buttons
**Exact root cause:** V60 dynamically creates result action buttons with the class `action-btn`, but the Split PDF stylesheet only styled `.split-result-actions .action-btn` for size/layout; it did not define the button's background, border, text color, radius, font or hover state. The browser therefore rendered its native button appearance on mobile.

**V61 fix:** result action buttons now receive explicit Split PDF styling matching the existing dark UI; Split Another is the secondary outline action and Clear All is the destructive/clear action.

## Additional hardening
- Split PDF runtime identity moved to V61.
- Service-worker cache identity moved to V61.
- Source action touch behavior remains delegated from the stable file-list container.
- Native file input is still cleared before replacement so selecting the same file works reliably.
- Existing V76 parity behavior for page ranges, Every page, Every N pages, single selected-page output, ZIP creation, cleanup and safety limits is preserved.

## Verification
- JavaScript syntax checks: PASS
- HTML structure checks: PASS
- No second PDF engine introduced.
- No unrelated tool workflow changed.
