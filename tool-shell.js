import { createToolController } from "./shared/controller.js";

document.querySelectorAll("[data-tool-root]").forEach(root => {
  if (root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";
  const accept = (root.dataset.accept || "").split(",").map(x => x.trim()).filter(Boolean);
  const maxFiles = Number(root.dataset.maxFiles || 20);
  createToolController(root, {
    accept,
    limits: { maxFiles },
    process: async () => {
      throw new Error("The processing engine will be connected in the next phase.");
    }
  });
});
