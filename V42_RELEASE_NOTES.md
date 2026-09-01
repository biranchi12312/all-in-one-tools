# OrivaStudio v42 — Live Browser QA Ready

## Purpose
v42 does not rewrite the five v76-derived tools. It packages the v41 parity-audited code with a strict real-browser QA guide so live behavior can now be certified without changing production logic blindly.

## Current certification boundary
- Source-level parity: PASS, 5/5 priority tools.
- Architecture isolation and lifecycle contracts: PASS from v36-v41 stack.
- Real browser end-to-end certification: READY FOR EXECUTION; not yet claimed as passed.

## User testing
The user can start manual browser testing immediately after deploying/extracting the package under HTTP/HTTPS. Netlify is the simplest option when available.
