# Resize Images v29 — Root Cause Fix

## What was actually broken in v28
The resize engine itself was mostly functioning. The persistent visual failures came from CSS/DOM state ownership, not the canvas resize algorithm.

### Root cause 1 — native `hidden` lost to explicit layout display
`updateModeUI()` correctly set `hidden` on Width, Height, Percentage and Lock aspect ratio controls. However the shared stylesheet declared `.field { display:grid }`, `.choice-row label { display:flex }`, and `.range-row { display:grid }`. Those explicit display declarations overrode the browser's default `[hidden]{display:none}` behavior in this cascade.

Result: mode changes updated the radio state, but controls from inactive modes remained visible. This exactly explains the screenshots where Percentage was selected while Width/Height were still present, and Fit inside was selected while Percentage and Lock aspect ratio remained visible.

### Root cause 2 — duplicated Resize phase selectors
v28 accumulated multiple phase rules for the same workspace. Some targeted all descendants while later rules targeted direct children. That created competing ownership for upload/settings/actions/results and made the action surface vulnerable to being shown in the wrong phase.

Result: after a successful resize, the Clear All / Resize Images action card could survive beside the results state instead of results becoming the sole workflow surface.

### Root cause 3 — hidden state was not treated as authoritative
Progress, result, action and mode controls relied partly on phase CSS and partly on native `hidden`. Because shared component CSS also set explicit display values, a hidden element could still be visually resurrected by a generic rule.

## v29 fix
1. Added a scoped `setHidden()` helper that writes both `hidden` and an inline display guard for mode/quality controls.
2. Added a final, Resize-specific CSS block where `[hidden]` is authoritative for `.field`, choice labels, range rows and workflow surfaces.
3. Added one final direct-child phase contract for `upload -> settings -> processing -> results`.
4. Results phase now explicitly suppresses upload, queue, settings, safety, status, progress and the Clear All / Resize Images action card.
5. Settings phase is the only phase where the action card is allowed to render.
6. Processing phase shows only live status/progress when those surfaces are not hidden.
7. Existing v76 parity for upload validation, partial acceptance, remove, confirmed clear, aspect ratio logic, no-enlarge, output formats, per-file errors, download, ZIP and Resize More is preserved.

## Expected mode matrix
- Fit inside: Width + Height visible, Percentage hidden, Lock aspect ratio hidden and forced on.
- Exact size: Width + Height visible, Percentage hidden, Lock aspect ratio visible.
- Percentage: Width + Height hidden, Percentage visible, Lock aspect ratio visible.
- PNG output: Quality control hidden.
- JPEG/WebP/Keep original: Quality control visible.

## Expected lifecycle
Upload -> Settings -> Processing -> Results -> Resize More/Clear All -> Upload.
