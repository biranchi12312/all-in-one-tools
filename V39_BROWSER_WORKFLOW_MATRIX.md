# v39 Browser Workflow Matrix

For every tool, run the exact lifecycle independently:

1. Open the dedicated URL.
2. Confirm there is no initialization exception.
3. Upload `bad.txt`; verify an error dialog and no workflow advancement.
4. Dismiss the dialog; verify the tool remains usable.
5. Upload the valid fixture.
6. Verify the tool-specific ready/editor/review state.
7. Run the primary action.
8. Verify processing is transient and the final result state is clean.
9. Verify download action.
10. Verify reset/clear returns to the initial upload state.

## Tool-specific checks

- Merge PDF: upload one valid PDF first; verify `collecting`, then add the second PDF and verify `review` before merge is enabled.
- Crop & Rotate: verify editor canvas, rotate/flip, ratio changes, export and result cleanup.
- Resize: verify settings, dimensions/percentage mode, process, result and clear.
- Images to PDF: verify multiple-image input and editable action card never leaks into result state.
- PDF to Images: verify PNG/JPG option handling and multi-result download state.
