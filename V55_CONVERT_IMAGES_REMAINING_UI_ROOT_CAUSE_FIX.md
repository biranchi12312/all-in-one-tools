# v55 Convert Images Remaining UI Root-Cause Fix

## Root causes found from v54 screenshots

1. **PNG left an empty right-hand settings card.** The runtime hid only the inner `data-quality-card`, while its parent `.setting-card` remained visible. Because PNG has neither a quality slider nor JPG transparency background option, this produced a blank bordered panel.
2. **The JPG background picker rendered as an almost empty dark bar on mobile.** The generic `input[type=color]` rule treated the native color picker like a text/select control and added padding/background that interfered with the visible color swatch.

## v55 corrections

- Added `data-quality-setting-card` to the optional settings-card parent.
- `updateFormatControls()` now decides whether the target uses quality and hides the entire optional card when the target is PNG.
- The PNG settings layout collapses to one column, so no empty panel or orphaned grid space remains.
- JPG and WebP continue to use the same existing tool lifecycle and shared popup behavior; no new controller or visibility architecture was introduced.
- Reworked the native JPG color input styling so its swatch remains visibly rendered and tappable on mobile.
- Cache query references for the Convert Images CSS and runtime were advanced from `v=54` to `v=55`.

## Expected v55 state

- **PNG:** one full-width output-format card; no blank quality card.
- **WebP:** output-format card + quality card.
- **JPG:** output-format card + quality card + visible transparent-area background color picker.
- Upload surface, file list, status, actions, processing and popup flows retain the established behavior used by the already-fixed tools.
