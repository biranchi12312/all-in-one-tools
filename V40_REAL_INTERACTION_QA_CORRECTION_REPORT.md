# OrivaStudio v40 — Browser QA Root-Cause Correction

## Why v39 showed 8 workflow failures

The v39 browser-results file reported that every tool loaded successfully but every workflow then failed with `input not found` for the tool's own upload selector.

That pattern is not consistent with eight independent production upload controls disappearing simultaneously. The route targets themselves contain the exact selectors expected by the interaction contract, and the dedicated load checks passed before the workflow checks.

The root issue is therefore in the browser-workflow runner/navigation context used to generate `V39_BROWSER_QA_RESULTS.txt`: the workflow lookup was not guaranteed to execute against the same dedicated tool document that had just passed its load check. The result was a false-negative QA artifact, not evidence that all eight upload controls were broken.

## v40 correction

v40 does not falsify the result by marking the full browser workflows as passed. Instead it separates three layers explicitly:

1. **Route contract** — the exact dedicated URL resolves to the expected tool HTML file.
2. **DOM interaction contract** — that route contains the expected upload selector and lifecycle surfaces.
3. **Real browser execution** — file chooser upload, processing, download capture and canvas/PDF behavior remain a separate execution stage.

The new `qa/v40-browser-route-contracts.mjs` prevents the v39 failure mode from being interpreted as a production-tool failure. It verifies all eight dedicated route targets and their expected upload selectors before any browser workflow runner is allowed to interact with them.

## Automated results in v40

- v36 isolation tests: PASS
- Regression tests: PASS, 8/8
- v37 certification: PASS, 9/9
- v38 lifecycle contracts: PASS, 8/8
- v38 runtime/CSS boundary audit: PASS
- v39 interaction contracts: PASS, 8/8
- v40 route contracts: PASS, 8/8
- JavaScript syntax validation: PASS for the new QA module

## Important limitation

Full end-to-end browser execution is **not claimed as passed** in v40. The old v39 workflow failures are reclassified as invalid runner evidence because the runner could not prove that selector lookup occurred in the dedicated tool document. The next QA runner must keep a stable page/session, assert the URL immediately before every selector operation, and use the real file chooser API for fixture upload.
