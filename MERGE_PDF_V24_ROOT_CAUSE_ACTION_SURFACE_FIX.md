# Merge PDF v24 Root Cause Action-Surface Fix

## Screenshot issue 1: blank card under the 1-PDF message
The collecting-phase CSS forced every `data-step="status"` element to `display:block !important`. Both the intended `merge-ready-copy` and the generic `tool-status` use that step. Runtime correctly hid the generic status because it had no message, but the collecting CSS overrode its hidden state and rendered its empty bordered panel.

Fix: collecting now explicitly shows only the dedicated minimum-file guidance and keeps the generic `tool-status` hidden. Final CSS also prevents the empty status node from being resurrected.

## Screenshot issue 2: Clear All / Merge PDFs card after results
The editable action card must exist only in REVIEW. Although the runtime hid it during results, the stylesheet contains several legacy progressive phase rules. The fix adds an explicit root ownership class (`merge-actions-active`) and an explicit `actionCard.hidden = phase !== REVIEW` lock. Any non-review phase now has a final CSS hard stop, including RESULTS and PROCESSING.

## Cache protection
The service-worker cache version was bumped so a deployed/local v24 update cannot continue serving an older Merge PDF lifecycle asset.
