import { initPdfToImagesRuntime } from "../pdf-to-images-runtime.js?v=44";
const root = document.querySelector('[data-pdf-tool="pdf-to-images"]');
if (root) initPdfToImagesRuntime(root);
