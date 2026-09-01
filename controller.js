import { createToolState } from "./state.js";
import { validateFiles } from "./validator.js";
import { formatBytes } from "./format.js";
import { createCleanupRegistry } from "./cleanup.js";
import { ToolError } from "./errors.js";

export function createToolController(root, config) {
  const input = root.querySelector("[data-tool-input]");
  const drop = root.querySelector("[data-drop-zone]");
  const browse = root.querySelector("[data-browse]");
  const list = root.querySelector("[data-file-list]");
  const start = root.querySelector("[data-start]");
  const reset = root.querySelector("[data-reset]");
  const status = root.querySelector("[data-tool-status]");
  const state = createToolState(renderState);
  const cleanup = createCleanupRegistry();
  let files = [];

  function setStatus(message = "", kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function renderState(next) {
    root.dataset.toolState = next;
    start.disabled = next !== "ready";
    input.disabled = next === "processing";
    browse.disabled = next === "processing";
    reset.disabled = next === "processing";
    setStatus(next === "processing" ? "Processing is starting…" : "");
  }

  function renderFiles() {
    list.innerHTML = "";
    if (!files.length) {
      list.innerHTML = '<div class="empty-state">No files added yet.</div>';
      return;
    }
    files.forEach((file, index) => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = '<div class="file-meta"><div class="file-name"></div><div class="file-size"></div></div><button class="remove-file" type="button">Remove</button>';
      row.querySelector(".file-name").textContent = file.name;
      row.querySelector(".file-size").textContent = formatBytes(file.size);
      row.querySelector("button").addEventListener("click", () => {
        if (state.value === "processing") return;
        files.splice(index, 1);
        renderFiles();
        state.set(files.length ? "ready" : "idle");
      });
      list.append(row);
    });
  }

  function addFiles(selected) {
    try {
      state.set("validating");
      const incoming = validateFiles(selected, config);
      const merged = [...files, ...incoming];
      files = validateFiles(merged, config);
      renderFiles();
      state.set("ready");
      setStatus(`${files.length} file${files.length === 1 ? "" : "s"} ready.`, "success");
    } catch (error) {
      state.set("error");
      setStatus(error?.message || "The files could not be added.", "error");
      window.OrivaDialog?.show?.({ type: "error", title: "Files not added", message: error?.message || "Please try again." });
      state.set(files.length ? "ready" : "idle");
    } finally {
      input.value = "";
    }
  }

  function resetTool() {
    if (state.value === "processing") return;
    cleanup.run();
    files = [];
    renderFiles();
    setStatus("");
    state.set("idle");
  }

  async function startProcessing() {
    if (state.value !== "ready") return;
    try {
      state.set("processing");
      setStatus("Processing…", "working");
      if (typeof config.process !== "function") {
        throw new ToolError("PROCESSING_ERROR", "This processing engine has not been connected yet.");
      }
      await config.process({ files: [...files], root, cleanup, setStatus });
      state.set("result");
      setStatus("Processing completed.", "success");
    } catch (error) {
      console.error(error);
      state.set("error");
      setStatus(error?.message || "Processing could not be completed.", "error");
      window.OrivaDialog?.show?.({ type: "error", title: "Processing could not continue", message: error?.message || "Please reset and try again." });
      state.set(files.length ? "ready" : "idle");
    }
  }

  browse.addEventListener("click", () => input.click());
  input.addEventListener("change", e => addFiles(e.target.files));
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.dataset.active = "true"; });
  drop.addEventListener("dragleave", () => { drop.dataset.active = "false"; });
  drop.addEventListener("drop", e => { e.preventDefault(); drop.dataset.active = "false"; addFiles(e.dataTransfer.files); });
  start.addEventListener("click", startProcessing);
  reset.addEventListener("click", resetTool);
  renderFiles();
  renderState("idle");

  return { getFiles: () => [...files], reset: resetTool, destroy: () => cleanup.run() };
}
