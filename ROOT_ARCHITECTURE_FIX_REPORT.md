# OrivaStudio New v4 — Root Architecture Fix

## Fixed issue
Nested pages could derive the Service Worker path from the current document.
That allowed pages under folders such as `/guides/` to request a nonexistent
`/guides/sw.js`, producing a 404 and repeated console warnings.

## New registration architecture
- There is one canonical Service Worker: `/sw.js` relative to the deployed site root.
- Every page loads the same centralized module: `assets/js/core/sw-register.js`.
- The module derives the root from `import.meta.url`, not `location.pathname`.
- The same registration logic therefore works from root pages and nested folders.
- Registration uses the root scope and `updateViaCache: "none"`.
- Older nested registrations under `/guides/`, `/image-tools/`, or `/pdf-tools/` are cleaned up when present.
- Registration failure remains non-fatal to the page.

## Audit result
The HTML pages use one centralized `sw-register.js` module per page. No page-level inline Service Worker registration was added.

## Deployment note
This architecture supports both a domain root deployment and a static site deployed under a path prefix because the worker URL is resolved from the module URL.
