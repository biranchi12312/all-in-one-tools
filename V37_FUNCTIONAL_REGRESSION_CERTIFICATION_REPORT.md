# OrivaStudio v37 — Functional Regression Certification & Dependency Cleanup

## Purpose
v37 is the next phase after v36 isolation. The focus is regression containment and dependency hygiene, not a visual redesign.

## Root issues found in v36
1. Every tool page contained a stale v35 dedicated stylesheet reference in addition to the v36 reference, so the same tool CSS could be loaded twice.
2. Runtime entry URLs still used the old v35 cache query even after the v36 architecture change.
3. The service worker cache identity was still v36.
4. Existing isolation tests verified structure, but they did not explicitly certify duplicate tool CSS/runtime dependencies or stale cache identities.

## v37 fixes
- Removed stale duplicate v35 stylesheet references from all eight tool pages.
- Normalized dedicated page CSS and runtime cache identities to v37.
- Bumped the service worker cache identity to `orivastudio-v37-regression-certified`.
- Added `qa/v37-tool-certification.mjs`.

## Certification coverage
The v37 certification checks enforce:
- exactly one dedicated page stylesheet per tool;
- no active `tool-v2.css` dependency on a tool page;
- exactly one dedicated runtime entry per tool;
- no active category dispatcher dependency on a tool page;
- no stale v35/v36 cache identity on tool pages;
- dedicated CSS namespace presence for every tool;
- JavaScript syntax validity across all project JS files;
- no generic workflow runtime import for Compress, Convert or Split;
- v37 service-worker cache identity.

## Important limitation
Static certification cannot prove real browser canvas/PDF rendering, drag interactions, file-picker permissions or network/CDN behavior. Those require browser-level integration testing with actual fixture files. v37 therefore treats this as the structural regression-certification phase, not a claim that every browser interaction was automatically executed in this environment.
