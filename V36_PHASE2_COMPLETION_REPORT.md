# OrivaStudio v36 — Phase 2 Tool Isolation Completion

## Scope
This phase completes the next isolation step after v35 without changing the intended UI design.

## Root issues closed
1. v35 still had three tools (Compress Images, Convert Images, Split PDF) delegating workflow ownership to one generic `tool-runtime.js` controller.
2. v35 page-specific CSS files were only extension stubs while all pages still loaded the same `tool-v2.css` phase/state authority.
3. Crop & Rotate had both the v35 runtime entry and an additional inline initialization path, creating a double-initialization risk.

## v36 changes
- Each of the three remaining generic-runtime tools now has its own controller file under `assets/js/tools/controllers/`.
- Those controllers pin their own processing engine and no longer import `tool-runtime.js`.
- Each tool page now loads only its own stylesheet from `assets/css/tools/pages/`.
- The full legacy visual rules are retained inside each isolated stylesheet, so visual parity is preserved while CSS cannot cascade into another tool page.
- Every tool body has a `data-tool-page` namespace.
- The duplicate Crop & Rotate inline initializer was removed.
- Shared utilities/libraries remain shared: dialog, menu, PDF loader, download helpers and browser primitives are not duplicated.

## Future server-side boundary
Tool controllers remain the workflow/UI owner. Processing can later be switched behind the execution adapter without changing page URLs or page state ownership.

## Regression target
A change to a tool controller or page stylesheet must not require changing another tool controller or stylesheet unless a deliberately shared core contract is changed.
