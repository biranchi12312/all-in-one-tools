import { initMergePdfRuntime } from "../merge-pdf-runtime.js";
const root = document.querySelector('[data-pdf-tool="merge-pdf"]');
if (root) initMergePdfRuntime(root);
