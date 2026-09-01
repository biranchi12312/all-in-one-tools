# Resize Images v28 Deep Parity Rebuild

## Scope
The Resize Images runtime was rebuilt against the v76 implementation flow while preserving the v27 UI.

## v76 parity restored
- Incremental multi-file upload with serialized add queue.
- Validation for type, empty files, per-file size, total size, count, and duplicate name+size.
- Partial upload keeps valid files and reports only skipped files.
- Per-file remove and confirmed Clear All.
- Fit, Exact, and Percentage modes with aspect-ratio and no-enlarge behavior.
- Output JPG, PNG, WebP, or original supported format.
- Per-file processing with partial-failure reporting.
- Individual downloads and ZIP download for multiple successful results.
- Resize More resets through the same confirmed clear workflow.

## Root-level fixes over v27
1. Removed structural action-card detachment from the Resize runtime. The action surface now remains connected and CSS phase ownership controls visibility.
2. Replaced generic status-driven readiness with explicit phase/status visibility, preventing forced empty status cards.
3. Kept the file-picker to a single user-activation path and stopped Browse button propagation.
4. Rebuilt the target-size logic to match v76 exact/fit/percent semantics.
5. Kept upload validation and processing transitions promise-safe so valid uploads cannot be followed by a false generic upload error.
6. Progress is visible only during actual resize or ZIP generation.

## Expected lifecycle
Upload -> Settings -> Processing -> Results -> Resize More/Clear All -> Upload.
