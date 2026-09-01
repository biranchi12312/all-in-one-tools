# Crop & Rotate v34 — Root Cause Result-State Fix

## Screenshot findings
The v33 export completed successfully, but three independent UI authorities were still colliding in the result phase:

1. **Duplicate result heading** — `.crop-results-shell::before` injected `Edit complete` while the dedicated result card also rendered `Export ready`. This produced two stacked result titles and an unnecessary nested-card hierarchy.
2. **Blank horizontal status surface** — a generic result-phase selector forced `.tool-status[data-tool-status]` to `display:block !important`, overriding the element's `hidden` state after the runtime intentionally cleared its text. The screenshot's empty rounded bar is that empty status panel.
3. **Wrong bottom action card** — the old generic workflow selector had higher specificity than the crop result selector, so the settings action card (`Clear All / Export Image`) was resurrected during results even though Crop-specific CSS attempted to hide it. That left a second export action after export was already complete.

## v34 fix
- Removed the injected `Edit complete` pseudo-heading.
- Flattened the result shell so the dedicated result card is the single result surface.
- Added stronger Crop-specific result selectors that explicitly suppress the generic status and action surfaces, including mobile media-query conditions.
- Added runtime result-transition cleanup so the status remains hidden and the generic action surface is marked unavailable during the result phase.
- Preserved result-card lifecycle controls: Download, Edit Another and Clear All.

The export editor and processing behavior were not rewritten; this change isolates the root cause to result-phase ownership instead of adding more broad CSS patches.
