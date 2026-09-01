# Merge PDF v25 Structural Action Card Fix

## Root cause
The completed Merge PDF result could still show the editable `Clear All / Merge PDFs` action card. The card was logically hidden by the runtime and by `hidden`, but the stylesheet contains multiple legacy responsive/progressive workflow rules using `display: ... !important` for `[data-step="actions"]`. Those independent selector chains could override visual hiding and resurrect the stale action surface after the RESULTS phase.

## v25 fix
The editable action card now has structural phase ownership:

- REVIEW: mounted in the workspace DOM.
- UPLOAD, COLLECTING, PROCESSING, RESULTS: physically detached from the workspace DOM.

A comment anchor preserves its original position. The same DOM node is remounted for REVIEW, so existing button listeners and state remain intact. Because the node is absent during RESULTS, no CSS cascade, media query, `!important`, or stale display rule can render the `Clear All / Merge PDFs` card below the completed result.

## Result
The result surface can contain only its result controls (`Merge More PDFs`, `Open Preview`, `Download PDF`) and cannot leak the editable pre-merge action card.
