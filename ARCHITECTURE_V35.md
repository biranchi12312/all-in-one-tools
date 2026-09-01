# OrivaStudio v35 — Independent Tool Runtime Architecture

## Goal
Each tool now owns its page entry point. A change to one tool must not select, initialize, or dispatch another tool.

## Stable layers
1. **Site shell** — tokens, base, foundation, header/footer and global UI.
2. **Shared primitives** — validation, formatting, cleanup, dialogs and generic runtime helpers.
3. **Category engines** — image/PDF processing libraries and helpers.
4. **Tool runtime entry** — exactly one runtime module per tool page.
5. **Tool page extension CSS** — one scoped extension file per tool.

## Rules
- Tool HTML never loads `image-tools.js` or `pdf-tools.js` dispatchers.
- Every tool page has exactly one `assets/js/tools/runtimes/<tool>.js` entry.
- Runtime modules select only their own root selector.
- Tool-specific CSS must stay under that tool's data attribute.
- Shared CSS may contain only reusable primitives and common workflow states.
- A future server migration replaces execution behind an adapter/engine boundary, not page UI.

## Current client-side → future server-side path
`page UI -> tool runtime -> engine/adapter -> client processor OR future API -> normalized result -> same result UI`

This keeps the workflow contract stable while allowing large files or premium/server processing later.
