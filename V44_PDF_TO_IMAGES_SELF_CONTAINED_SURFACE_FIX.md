# V44 — PDF to Images Self-Contained Surface Fix

## Root cause found in V43

The V43 stylesheet refactor isolated lifecycle selectors, but accidentally removed the page-level dependencies that the previous implementation inherited from the shared `tool-v2.css` contract. The V43 page stylesheet referenced `--tv-*` variables without defining them and omitted the shared definitions for:

- dark tool theme variables (`--tv-text`, `--tv-muted`, `--tv-line`, `--tv-panel`, etc.);
- header, navigation and mobile-menu chrome;
- `.menu-btn`;
- `.btn.primary` / `.btn.secondary`;
- `.file-input { display:none }`;
- `.remove-file`;
- dialog action buttons when the dialog is appended to the page body.

This produced the exact screenshot symptoms: dark text on a dark page, browser-default Menu/Browse controls, visible native `Choose files`, and an inconsistent modal surface when an error dialog/backdrop appeared.

## Fix

The PDF-to-Images stylesheet is now self-contained for all surface rules it actually uses, while retaining its isolated lifecycle contract. No generic `tool-v2.css` lifecycle rules were reintroduced, so the V43 lifecycle regression fix remains isolated.

Cache-busting was also advanced to V44 for the page stylesheet, runtime wrapper and service worker.
