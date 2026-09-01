# OrivaStudio V60 — Split PDF Replace/Remove + Single Selected Pages Fix

## Root causes identified in V59

1. **Replace action fragility:** the source row is dynamically recreated, but Replace was wired directly to each transient button. The native file input was also cleared only after the asynchronous selection flow. That is unnecessarily fragile for repeated mobile picker interactions, especially when selecting the same file again.
2. **Remove behavior mismatch:** the source-row Remove action went through a confirmation popup. The already-fixed image tools remove a queued item immediately; Split PDF should follow that same interaction pattern for its source row.
3. **Source action event surface:** V59 did not have a stable delegated click surface for the dynamically rendered source buttons.

## V76 parity check — Single PDF with only selected pages

The V76 behavior represented by the mature Split PDF flow is: the option exists only in Page ranges mode; the entered ranges are resolved to actual page numbers; overlapping ranges do not duplicate a page in the single-file result; and the final PDF contains the selected pages in document order. V59 already had the core implementation of that behavior. V60 preserves it rather than introducing a second algorithm.

## V60 changes

- No new popup controller and no second dialog system. The existing shared `OrivaDialog` remains the popup mechanism.
- Source-row **Remove** is now immediate, matching the already-fixed image tools.
- Source-row **Replace** uses stable event delegation from the existing file-list container.
- Replace clears the native input before opening the picker, uses `showPicker()` where supported, and falls back to `click()`.
- Result-stage **Clear All** keeps its confirmation popup because it clears the complete workflow.
- Single selected-page mode remains limited to Page ranges.
- Single selected-page mode still creates exactly one output group, removes duplicate page references from overlapping ranges, and sorts them into document order.
- Ready-state copy now explicitly says `selected page(s)` when that option is active.
- Existing Split PDF CSS was hardened for touch/click interaction; visual design was not replaced.
- Runtime, stylesheet, application and service-worker revision identifiers were moved to V60.

## Expected source lifecycle

`Upload PDF` → source row → **Replace** → native picker → validate new PDF → new source row; or **Remove** → immediate reset → Upload PDF.

## Verification

- `node --check` Split controller: PASS
- `node --check` Split runtime: PASS
- Shared dialog reused: PASS
- No dedicated popup controller added: PASS
- Source action delegation present: PASS
- Single selected-page grouping logic present: PASS
- V60 cache/runtime identifiers updated: PASS
