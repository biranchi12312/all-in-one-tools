# V44 Resize Images Runtime Export Fix

## Observed failure
Browser console reported:

`SyntaxError: The requested module '../resize-images-runtime.js' does not provide an export named 'initResizeImagesRuntime'`

## Root cause
The isolated route wrapper `assets/js/tools/runtimes/resize-images.js` imported a named initializer, but `assets/js/tools/resize-images-runtime.js` was still an older self-executing module. It created its own top-level DOM root and exported nothing. The ES module loader therefore aborted before any Resize Images UI lifecycle code could run.

## Fix
- Converted `resize-images-runtime.js` into an explicit exported initializer: `initResizeImagesRuntime(root)`.
- Removed its top-level route query/throw and made the wrapper own route selection.
- Kept the existing Resize Images lifecycle, validation, processing, result and cleanup logic inside the initializer.
- Added a dedicated module revision query to force a fresh module fetch.
- Advanced the service-worker cache revision so an existing browser cannot continue serving the broken module revision.

## Regression intent
No generic shared runtime was reintroduced. Resize Images remains independently owned by its route wrapper plus its dedicated runtime and engine.
