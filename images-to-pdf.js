import { initImagesToPdfRuntime } from "../images-to-pdf-runtime.js";
const root = document.querySelector('[data-pdf-tool="images-to-pdf"]');
if (root) initImagesToPdfRuntime(root);
