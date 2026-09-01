# Images to PDF v14 implementation

Base: OrivaStudio New v13. Reference study: old v76 Images to PDF workflow.

Implemented workflow:
1. Upload / drag-drop with JPG, PNG and WebP validation.
2. Batch limits: 30 files, 100 MB per file, 250 MB total, duplicate rejection.
3. Independent queue with previews, remove, arrow reorder and drag reorder.
4. Progressive state: upload -> files/settings -> processing -> results.
5. Fit, A4 and Letter page modes with orientation-aware standard pages.
6. Safe image preparation with 40 MP / 9000 px source limits and 4096 px embed cap.
7. WebP conversion to JPEG for pdf-lib compatibility.
8. Output naming, PDF metadata, live progress, direct download.
9. Clear All confirmation and Create Another confirmation.
10. Deterministic cleanup of previews and generated output URLs.

The v76 source was used as behavioral reference only; the runtime and engine are newly implemented for the v13 architecture.
