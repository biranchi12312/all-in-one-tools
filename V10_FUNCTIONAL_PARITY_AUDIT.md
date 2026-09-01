# V10 Functional Parity Audit

Old V76 was used only as a behavioral reference. V10 keeps the new independent architecture and implements fresh engines.

## Covered workflows
- Compress Images: batch queue, quality, output/keep format, safe output handling, ZIP.
- Convert Images: mixed supported input, JPG/PNG/WebP target, quality, transparency background, ZIP.
- Resize Images: fit/exact/percentage, aspect lock, no-enlarge, output format, ZIP.
- Crop & Rotate: interactive crop area, rotate, flip, ratios, reset, export.
- Images to PDF: batch ordering, drag/arrows, fit/A4/Letter, output name.
- Merge PDF: 2-20 input rule, ordering, output name, PDF preview thumbnails.
- PDF to Images: up to 10 PDFs, PNG/JPG, quality, per-result download, ZIP.
- Split PDF: ranges, every page, chunks, single selected-pages PDF, ZIP.

All engines remain lazy-loaded and independent. Initial page load does not import a tool engine until the workflow requires it.
