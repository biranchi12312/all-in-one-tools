# V50 Compress Images — V76 Dialog and Workflow Rebuild

## Reference audit
The V76 Compress Images implementation was inspected directly for the complete lifecycle: upload validation, queue append/remove, clear confirmation, processing lock, sequential compression, progress, per-file continuation, completion notes, individual download, ZIP download, Process More reset and unload cleanup.

## Root causes found in V49
1. V49 replaced the V76-style overlay dialog structure with a native `<dialog>` implementation. Even when visually themed, its structure, focus/backdrop lifecycle and action layout were not the same workflow surface.
2. The compressor depended on `window.OrivaDialog`, while the page loaded independent ES modules. That created a timing/cache dependency where the compressor could fall back to native browser prompts instead of using one deterministic prompt surface.
3. V49's `Compress More Images` only reset state and scrolled. On mobile this could look like no action happened; the next upload action was not made explicit.
4. Popup behavior was therefore split between a shared global dialog, native fallbacks and route-specific CSS. The compressor did not have one authoritative popup owner.

## V50 implementation
- Compress Images now imports a dedicated dialog module directly from its controller; no global dialog race exists on this route.
- The dedicated overlay follows the V76 interaction structure: fixed section overlay, explicit backdrop button, centered 460px panel, 58px status icon, title/message/list stack, equal-width action buttons, Escape/backdrop/cancel handling and focus restoration.
- The V76 source was used as a behavior reference only; V50 dialog and controller code were independently written.
- Clear All retains confirmation. Upload rejection, upload failure, busy-state warning, per-file failure summary, compression notes and ZIP failure all use the same dedicated surface.
- Process More performs a clean no-confirm reset and then immediately opens the browser file chooser. If a browser blocks the click, focus returns to the upload surface instead of silently doing nothing.
- Existing V49 processing/result action ownership is retained so stale processing controls do not reappear under dialogs.

## Regression boundaries
Only Compress Images page assets and its dedicated controller/dialog path were changed. Other image/PDF tools keep their current dialog/runtime implementations.
