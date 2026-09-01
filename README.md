> **v22 note:** Merge PDF runtime repaired and audited against v76 workflow behavior.



## v21 Merge PDF fix
See `MERGE_PDF_V21_ROOT_FIX_REPORT.md`.
# OrivaStudio — Phase 6: Production Readiness

Phase 6 finalizes production hardening on top of the Phase 5 integration foundation.

## Added
- Mobile/desktop responsive hardening
- Horizontal overflow guards
- BFCache-aware lifecycle handling
- Safe drag/drop navigation prevention
- External-link security normalization
- Button type normalization
- Production CSS layer
- Updated conservative service worker
- Deployable smoke-test page
- Final QA checklist
- Deployment checklist
- Structural reference audit report

## Architecture
The site remains a multi-page static architecture with independent HTML URLs and isolated client-side engines. Shared runtime layers handle navigation, dialogs, network state, error containment and progressive caching. The centralized tool registry preserves a future path to server-side APIs.

## Before indexing
Run the included QA checklist on the deployed domain and complete the smoke test. Index only after the final production domain and canonical URLs are confirmed.


## V10
Full functional-parity pass rebuilt from V76 behavior as a reference without reusing the old implementation.


## v17 Images to PDF fix
See `IMAGES_TO_PDF_V17_ACTION_CARD_ROOT_CAUSE_FIX.md`.

## v19 Merge PDF update
Merge PDF now uses an explicit review phase with incremental uploads, mobile/desktop reordering and stale async upload cancellation.


## v24 Merge PDF lifecycle fix
This package adds exact minimum-two-PDF gating: one valid PDF stays queued in a collecting state; merge actions activate only after the second valid PDF is successfully added.


## Crop & Rotate v32
Fixes the preview compositing defect where the selected crop area could render black after the outside mask was applied.

## v35 runtime isolation
v35 introduces one explicit runtime entry module and one scoped CSS extension point per tool page. See `ARCHITECTURE_V35.md` and `qa/v35-runtime-isolation.mjs`.

## v38 lifecycle certification
v38 adds lifecycle contract and tool-boundary QA on top of v37 isolation, cleans duplicate module attributes, and updates cache identities to v38.
