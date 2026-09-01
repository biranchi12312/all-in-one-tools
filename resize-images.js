import { initResizeImagesRuntime } from "../resize-images-runtime.js?v=44-resize-runtime-fix";
const root = document.querySelector('[data-image-tool="resize-images"]');
if (root) initResizeImagesRuntime(root);
