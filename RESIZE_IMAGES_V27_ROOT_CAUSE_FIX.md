# Resize Images v27 root-cause fix

## Root cause 1: upload transition crashed
`updateReady()` referenced `mode` without declaring it. The first successful upload entered `afterFilesChanged()`, which called `updateReady()`, producing a `ReferenceError`. The global error handler therefore opened the generic `Something went wrong` dialog even though the file had already been appended to the queue.

Fix: `updateReady()` now derives `const mode = getMode()` locally and upload transition errors are awaited through the serialized upload chain.

## Root cause 2: file chooser was opened twice
The Browse button lived inside the clickable drop zone. Its click handler called `input.click()`, then the event bubbled to the drop-zone click handler and called `input.click()` again. Chromium allowed the first picker activation and rejected/logged the second one with `File chooser dialog can only be shown with a user activation.`

Fix: Browse stops propagation and the drop-zone handler explicitly ignores Browse-originated clicks. A single `openFilePicker()` function owns picker activation.

## Additional hardening
- `addFilesInternal()` is async and awaits the UI transition.
- The serialized `addChain` now owns transition errors instead of leaving rejected promises unhandled.
- The action card lifecycle remains structural: only mounted in the settings phase.
- Progress remains hidden outside processing.
