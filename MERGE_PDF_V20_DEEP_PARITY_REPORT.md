# Merge PDF v20 Deep Parity Implementation

Reworked Merge PDF from the v19 architecture while preserving the v18/v19 visual language. The implementation is independently structured and does not copy the v76 source.

Implemented: explicit Upload/Review/Processing/Results ownership; sequential upload queue; validation for type, empty files, per-file and batch limits, duplicates, page count and password protection; first-page thumbnail generation with object-URL cleanup; desktop and touch reorder; rejection and large-batch dialogs; Clear All and Merge More confirmations; robust merge errors with source filename context; progress updates; preview and download actions; output metadata; stale async session protection; before-unload processing guard; pagehide cleanup; and service-worker cache bump.
