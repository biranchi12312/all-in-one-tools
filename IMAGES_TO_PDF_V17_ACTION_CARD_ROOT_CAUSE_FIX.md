# Images to PDF v17 Root-Cause Fix

## Problem observed
After a successful PDF creation, the result card correctly showed **Create Another** and **Download PDF**, but the old editable **Clear All / Create PDF** action card also remained visible below it on mobile.

## Actual root cause
This was not a PDF-processing or result-rendering failure. The v16 runtime correctly switched the workspace to `data-phase="results"` and set the editable action card to `hidden`.

The conflict came from an older shared v9 CSS rule with higher selector specificity. That rule forced every `.workspace` action card to display during the `processing` and `results` phases. Because the Images to PDF workspace also uses `.workspace`, the generic rule overrode the newer tool-specific `display:none!important` rule. The mobile version made the same conflict stronger by forcing `display:grid!important`.

## v17 fix
1. The legacy shared action-display rules now explicitly exclude `.i2p-workspace`. Other tools keep their existing behavior.
2. Images to PDF now has its own high-specificity processing/results isolation rule.
3. The runtime keeps a direct reference to the editable action card and sets `actionCard.hidden = phase !== "settings"` on every phase transition.
4. The result card remains the only owner of completion actions: **Create Another** and **Download PDF**.
5. The service worker revision and registration query were bumped so a local/browser worker cannot keep a mixed v16 CSS/runtime revision after deployment.
6. A regression test now checks for this exact selector conflict and runtime ownership guard.

## Expected workflow
- Upload: upload surface only.
- Settings: file list/settings/status + one Clear All/Create PDF action card.
- Processing: status/progress only.
- Results: one PDF Ready result card containing Create Another and Download PDF only.

The PDF generation engine was not copied from v76. v17 keeps the existing v16 architecture and applies only the root-cause isolation required for the current Images to PDF UI.
