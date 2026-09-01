# OrivaStudio v24 — Merge PDF Deep Parity and Popup Fix

## Root issue observed in v23
The one-PDF collecting state rendered two persistent inline messages at once:
1. `data-merge-ready`
2. `data-tool-status`

Neither was a modal acknowledgement, so the UI looked like duplicated status boxes rather than a clear upload transition. The modal API also had no serialization guard, allowing closely sequenced dialogs to race.

## v24 behavior
- Valid first PDF remains in the queue.
- Collecting state keeps the upload surface active.
- Exactly one persistent inline instruction remains: add one more PDF.
- A success modal explicitly confirms the first valid upload and explains that one more PDF is required.
- When the minimum of two PDFs is crossed, a success modal confirms that merge review is now ready.
- Rejected-file dialogs, large-batch warnings, clear confirmation, merge-more confirmation, merge errors, download/preview errors, and preview-blocked warnings continue to use the shared dialog system.
- Dialog calls are serialized so sequential upload/rejection/warning notifications cannot collide.

## Lifecycle
UPLOAD -> COLLECTING (1 valid PDF) -> REVIEW (2-20 valid PDFs) -> PROCESSING -> RESULTS

The merge action remains unavailable in COLLECTING and is enabled only in REVIEW.
