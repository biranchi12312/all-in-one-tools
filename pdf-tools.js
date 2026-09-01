import { initRuntime } from "./tool-runtime.js";
import { initPdfToImagesRuntime } from "./pdf-to-images-runtime.js";
import { initImagesToPdfRuntime } from "./images-to-pdf-runtime.js";
import { initMergePdfRuntime } from "./merge-pdf-runtime.js";

const root = document.querySelector("[data-pdf-tool]");

if (root) {
  const engine = root.dataset.pdfTool;

  if (engine === "pdf-to-images") {
    initPdfToImagesRuntime(root);
  } else if (engine === "images-to-pdf") {
    initImagesToPdfRuntime(root);
  } else if (engine === "merge-pdf") {
    initMergePdfRuntime(root);
  } else {
    root.dataset.engine = engine;
    const orderable = engine === "merge-pdf" || engine === "images-to-pdf";
    const maxFiles = engine === "merge-pdf" ? 20 : engine === "images-to-pdf" ? 30 : 1;
    const minFiles = engine === "merge-pdf" ? 2 : 1;
    initRuntime({
      root,
      input: root.querySelector("[data-pdf-input]"),
      drop: root.querySelector("[data-drop-zone]"),
      browse: root.querySelector("[data-browse]"),
      start: root.querySelector("[data-start]"),
      reset: root.querySelector("[data-reset]"),
      status: root.querySelector("[data-tool-status]"),
      list: root.querySelector("[data-file-list]"),
      results: root.querySelector("[data-result-list]"),
      maxFiles,
      maxBytes: 100 * 1024 * 1024,
      maxTotal: 250 * 1024 * 1024,
      minFiles,
      orderable
    });
  }
}
