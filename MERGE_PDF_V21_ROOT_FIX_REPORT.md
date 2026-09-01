# Merge PDF v21 Root Fix

## Root causes corrected
1. A single valid PDF was committed to the queue before the minimum-2 merge invariant was checked. v21 now validates the whole incoming selection into a temporary staging list and commits it atomically. When an empty merge workflow receives only one valid PDF, the file is not added and a custom dialog explains that at least 2 PDFs are required.
2. Earlier merge CSS contained overlapping phase selectors. Some broad selectors could force the editable action card visible after another phase had hidden it. v21 adds one direct-child, phase-authority layer where Upload, Review, Processing and Results each explicitly own their visible surfaces.
3. The result card owns completion actions (Merge More, Open Preview, Download PDF). The editable Clear All / Merge PDFs action card is review-only and cannot coexist with the result surface.

## Preserved behavior
- Type, empty-file, per-file size, total size, duplicate, page-count and password-protection validation.
- First-page preview generation and object URL cleanup.
- Sequential queued uploads, desktop/touch reordering, large-batch warnings.
- Clear All and Merge More confirmations.
- Merge progress, filename sanitization, contextual merge errors, preview and download.
- beforeunload processing guard and pagehide cleanup.

This implementation keeps the v20 UI and modular architecture and independently rebuilds the problematic control flow rather than copying v76 source.
