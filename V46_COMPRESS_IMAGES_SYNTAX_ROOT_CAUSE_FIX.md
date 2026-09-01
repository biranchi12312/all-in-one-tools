# V46 Compress Images Syntax Root Cause Fix

## Trigger observed in browser
The Compress Images page failed immediately with:

- `SyntaxError: missing ) after argument list`
- `Uncaught SyntaxError: missing ) after argument list`

The page-level fallback then displayed the generic “Something went wrong” dialog.

## Exact root cause
The failure-summary dialog call inside `assets/js/tools/controllers/compress-images.js` had malformed JavaScript syntax. The plural failure-title branch opened a template literal but did not close it before the next function argument. This made the entire ES module fail during parsing, so the controller never initialized.

The defective shape was equivalent to:

`... : `${failures.length} images failed", "The remaining ...`

The corrected call is:

`... : `${failures.length} images failed`, "The remaining ...", ...`

## Why the UI looked broken
Because the controller module could not parse, no Compress Images lifecycle code ran. Upload, state synchronization, file processing, and normal page initialization for this tool were unavailable. The global error surface therefore showed the generic error popup while the static HTML remained visible underneath.

## Fixes applied
1. Repaired the malformed failure-summary dialog call at source level.
2. Verified the controller with both `node --check` and a real ES-module import.
3. Verified the compression engine with a real ES-module import.
4. Kept the isolated Compress Images architecture intact; no other tool controller or engine was changed.
5. Bumped the Compress Images CSS/runtime query versions to `v=46` to avoid stale cached tool assets.
6. Bumped the service-worker cache version so the repaired assets replace the broken cached release.

## QA results
- Controller syntax check: PASS
- Controller ES-module import: PASS
- Engine syntax check: PASS
- Engine ES-module import: PASS
- Runtime syntax check: PASS

## Change boundary
Functional code fix is confined to the Compress Images controller. Cache/version changes are limited to the Compress Images page asset URLs and service-worker cache identifier.
