# Browser QA Fixtures

Use small, deterministic local fixtures for the interactive workflow matrix:

- `sample.png` — valid raster image
- `sample.jpg` — valid raster image
- `sample1.pdf` — valid one-page PDF
- `sample2.pdf` — second valid one-page PDF for incremental Merge PDF testing
- `bad.txt` — invalid upload fixture

The fixture set is intentionally small so the QA checks exercise lifecycle logic rather than performance limits. Large-file, corrupted-file and password-protected-PDF cases remain separate boundary tests.
