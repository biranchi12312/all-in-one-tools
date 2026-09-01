# OrivaStudio v38 — Lifecycle QA & Boundary Certification

## Scope
v38 is a QA-hardening release built on v37. No individual tool workflow was redesigned. The goal was to make the isolated architecture easier to validate and less prone to silent dependency regressions.

## Root-level cleanup
1. Removed duplicate `type="module"` attributes from tool-page script tags.
2. Updated dedicated tool CSS/runtime cache identities from `v=37` to `v=38`.
3. Updated the service-worker cache identity to `orivastudio-v38-lifecycle-certified`.

## New lifecycle contracts
Every existing tool is checked for:
- exact tool root identity;
- exact page identity;
- expected upload input;
- drop zone;
- browse control;
- primary start action;
- reset action;
- tool status surface;
- file list;
- result list;
- exactly the dedicated v38 stylesheet;
- exactly the dedicated v38 runtime;
- no active legacy category dispatcher;
- no direct generic workflow runtime;
- no duplicate module-type attribute.

## Boundary audit
Dedicated runtimes are checked for their own tool root and initialization boundary. Dedicated page stylesheets are checked for explicit `data-tool-page` namespacing.

## Important limitation
This certification validates real project files, module syntax, lifecycle contracts and architectural boundaries. It is not a substitute for full interactive browser automation with fixture uploads and visual assertions. The next QA stage should execute browser-driven fixture workflows once an automation runner is available.
