# OrivaStudio v23 — Merge PDF Deep Parity Fix

## Corrected root cause
The v22 runtime allowed the single-PDF state to enter the generic `review` phase. That made the post-upload action surface appear too early, even though the merge button itself was disabled. This did not reproduce the v76 lifecycle precisely.

## v23 lifecycle
1. **Upload** — no valid PDFs.
2. **Collecting** — exactly one valid PDF. The PDF remains queued, upload stays available, validation/rejection handling remains active, output naming remains available, and merge actions are not activated. The user is explicitly told to add one more PDF.
3. **Review / ready** — two or more valid PDFs. Merge actions activate and ordering/settings can be reviewed.
4. **Processing** — upload/list/settings/actions are hidden and progress is shown.
5. **Results** — only the result surface is shown, with Merge More, Preview, and Download.

## v76 behaviors retained
- Incremental upload without discarding the first valid PDF.
- Minimum of two PDFs before merge activation.
- PDF signature/readability/page validation.
- Password-protected and invalid PDF handling.
- Per-file, total-size, file-count, and total-page limits.
- Duplicate rejection.
- Rejected-file popup aggregation.
- Large-batch warning.
- Desktop and touch reordering.
- Clear confirmation and Merge More confirmation.
- Processing progress, file-specific merge errors, preview/download errors.
- Object URL and thumbnail cleanup.
- beforeunload protection while processing.

## v22-specific improvement
For exactly one queued PDF, v23 keeps a compact inline Clear All control so the v76 clear capability remains available without exposing the merge action phase early.
