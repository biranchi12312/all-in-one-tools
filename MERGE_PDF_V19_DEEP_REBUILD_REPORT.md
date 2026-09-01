# Merge PDF v19 — Deep Workflow Rebuild

## What was re-studied
The v76 Merge PDF implementation was re-audited from the upload boundary through validation, queue management, reordering, removal, warning logic, merge processing, result download and full reset. The v19 implementation was written for the current v18 visual system; the v76 source was used as behavioral reference rather than copied into the new runtime.

## Important gaps found in v18
1. **Incremental upload flow was missing.** After the first valid selection, the upload panel was hidden by the phase system. The mature workflow kept the upload surface available so more PDFs could be added later.
2. **Touch reordering was incomplete.** The previous implementation relied on desktop drag events and generic rows; the mature tool supported mobile-oriented pointer movement.
3. **Phase ownership was overloaded.** The generic `settings` phase had to coexist with the tool-specific action card and result rules. v19 uses an explicit `review` phase.
4. **Async upload work could survive a reset.** A queued PDF validation could finish after Clear All and repopulate the queue. v19 uses a session token to invalidate stale async work.
5. **Queue semantics were weaker than the mature flow.** v19 restores explicit order numbers, ready state, arrows, remove control and a dedicated drag handle.

## v19 workflow
### 1. Upload / add more
- Accepts PDF files from browse or drag and drop.
- The upload surface remains visible during review, so users can add PDFs in multiple selections.
- Validations run sequentially to keep page/size totals deterministic.

### 2. Validation
- PDF extension/MIME check.
- Empty-file rejection.
- 100 MB per-file limit.
- 20-file limit.
- Duplicate-file protection.
- 250 MB total limit.
- PDF signature and readability check.
- Password-protected PDF rejection.
- 500-page total limit.

### 3. Review queue
- First-page preview.
- File name, size and page count.
- Explicit merge order badge.
- Move up/down.
- Dedicated drag handle for desktop and pointer/touch reordering.
- Per-file remove.
- Live Files / Total Size / Total Pages / Remaining Capacity summary.

### 4. Safety and warnings
- Soft warnings for large individual files, large batches and large page counts.
- Warning can be dismissed without blocking a valid merge.

### 5. Merge processing
- A snapshot of the reviewed order is processed.
- The editable upload/review/action surfaces are hidden while processing.
- Progress advances through preparing, per-document reading/merge and finalization.
- The 500-page safety limit is checked again while copying pages.

### 6. Result
- Dedicated result card only.
- Files merged, total pages and output size.
- Download PDF.
- Merge More PDFs with confirmation.
- Editable Clear All / Merge PDFs card cannot leak into the result phase.

### 7. Reset and cleanup
- Clear All confirmation.
- Session counter cancels stale validation completions.
- Input, warnings, status, progress, queue and result are reset together.
- Output object URL is revoked on reset and page exit.

## Regression / cache work
- Merge-specific regression checks were updated for the v19 review phase and stale-upload cancellation.
- Service-worker cache version was bumped so a local/PWA install does not keep serving the v18 Merge PDF assets.
