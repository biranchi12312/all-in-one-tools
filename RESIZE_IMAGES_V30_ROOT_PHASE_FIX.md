# Resize Images v30 — Root Phase-Surface Fix

## Confirmed v29 residual issue
The screenshot showed two surfaces that must not exist after completion:
1. an empty progress/status rail below the intro;
2. the Clear All / Resize Images action card below Resize Complete.

## Root cause
v29 still depended primarily on CSS phase selectors to suppress those nodes. The project contains accumulated generic workspace selectors, and an older CSS bundle can remain active through the service worker when files are replaced locally. `hidden` alone was therefore not a sufficient final authority.

## v30 fix
- Action card is physically detached outside SETTINGS and remounted only in SETTINGS.
- Progress and status now use inline `display:none !important` guards whenever hidden.
- RESULTS explicitly hard-hides progress/status.
- Added unscoped direct fallback selectors for the Resize workspace.
- Cache-busted the Resize CSS/runtime URLs.
- Bumped the root service-worker registration query and cache version.

## Result contract
UPLOAD: upload only.
SETTINGS: upload + queue + settings + note + action card.
PROCESSING: status/progress only.
RESULTS: Resize Complete result shell only; no progress rail, no status surface, no Clear All/Resize Images action card.
