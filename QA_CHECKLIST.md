# OrivaStudio Phase 6 — Final QA Checklist

## Navigation and page integrity
- [ ] Open every root page directly in a new tab.
- [ ] Open every image tool directly.
- [ ] Open every PDF tool directly.
- [ ] Use browser back and forward repeatedly.
- [ ] Refresh each tool page after opening it directly.
- [ ] Verify no route depends on an injected HTML fragment.

## Mobile and responsive
- [ ] Test narrow mobile width.
- [ ] Test standard mobile width.
- [ ] Test tablet width.
- [ ] Test desktop width.
- [ ] Verify no horizontal overflow.
- [ ] Verify buttons remain reachable and readable.

## Tool safety
- [ ] Add supported files.
- [ ] Try unsupported files.
- [ ] Try an oversized file.
- [ ] Try an oversized batch.
- [ ] Reset after processing.
- [ ] Re-run a tool after returning with browser Back.
- [ ] Confirm result download names.

## Error handling
- [ ] Force a malformed file.
- [ ] Disconnect network before loading an external PDF runtime.
- [ ] Confirm the designed dialog appears instead of a browser alert.
- [ ] Confirm repeated identical errors do not create popup spam.

## Production
- [ ] HTTPS enabled.
- [ ] Service worker registered.
- [ ] robots.txt reachable.
- [ ] sitemap.xml reachable.
- [ ] No console errors during normal navigation.
- [ ] Run qa/smoke-test.html after deployment.


## Phase 7 regression checks
- [ ] Split PDF with `1-3, 5, 7-9`.
- [ ] Split PDF with one page such as `2`.
- [ ] Reject invalid ranges such as `0`, `4-2`, and a page beyond the document.
- [ ] Convert a normal multi-page PDF to images.
- [ ] Start a tool and verify file controls cannot change the active job.
- [ ] Run `node qa/regression-tests.mjs` before deployment if Node.js is available.
