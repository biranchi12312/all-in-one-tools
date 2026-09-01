const MAX_BYTES = 100 * 1024 * 1024;

function parseAccept(input) {
  return (input.getAttribute("accept") || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
}
function accepts(file, rules) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return rules.some(rule => rule === "*/*" || (rule.endsWith("/*") && type.startsWith(rule.slice(0, -1))) || (rule.startsWith(".") && name.endsWith(rule)) || type === rule);
}
function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

export function initCropRotateRuntime(root) {
  const input = root.querySelector("[data-image-input]");
  const drop = root.querySelector("[data-drop-zone]");
  const browse = root.querySelector("[data-browse]");
  const start = root.querySelector("[data-start]");
  const clear = root.querySelector("[data-reset]");
  const status = root.querySelector("[data-tool-status]");
  const list = root.querySelector("[data-file-list]");
  const results = root.querySelector("[data-result-list]");
  const progress = root.querySelector("[data-progress-wrap]");
  const progressFill = root.querySelector("[data-progress-fill]");
  const progressText = root.querySelector("[data-progress-text]");
  if (!input || !drop || !browse || !start || !clear || !status || !list || !results) return null;

  const state = { file: null, busy: false, engine: null, enginePromise: null, resultUrl: "", output: null };
  const rules = parseAccept(input);

  function setPhase(phase) { root.dataset.phase = phase; }
  function setBusy(on) {
    state.busy = !!on;
    root.dataset.processing = on ? "true" : "false";
    input.disabled = on;
    browse.disabled = on;
    start.disabled = on || !state.file;
    clear.disabled = on;
  }
  function setStatus(message = "", kind = "", visible = false) {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !visible;
    root.dataset.statusVisible = visible ? "true" : "false";
  }
  function setProgress(percent = null, text = "") {
    if (!progress) return;
    const show = Number.isFinite(percent);
    progress.hidden = !show;
    if (!show) return;
    const safe = Math.max(0, Math.min(100, percent));
    if (progressFill) progressFill.style.width = `${safe}%`;
    if (progressText) progressText.textContent = text || `${Math.round(safe)}%`;
  }
  async function popup(kind, title, message, options = {}) {
    const ui = window.OrivaDialog;
    if (kind === "confirm") {
      if (ui?.confirm) return !!(await ui.confirm({ title, message, confirmLabel: options.confirmLabel || "Continue", cancelLabel: options.cancelLabel || "Cancel" }));
      return window.confirm(message);
    }
    if (kind === "error" && ui?.error) { await ui.error({ title, message }); return; }
    if (ui?.show) { await ui.show({ variant: kind, title, message }); return; }
    window.alert(`${title}\n\n${message}`);
  }
  function revokeResult() {
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.resultUrl = "";
    state.output = null;
  }
  function clearResultView() {
    revokeResult();
    results.replaceChildren();
  }
  function renderFile() {
    list.replaceChildren();
    if (!state.file) return;
    const row = document.createElement("div");
    row.className = "file-row";
    const meta = document.createElement("div");
    meta.className = "file-meta";
    const preview = document.createElement("div");
    preview.className = "image-file-preview";
    const image = document.createElement("img");
    image.alt = "";
    const url = URL.createObjectURL(state.file);
    image.src = url;
    image.onload = image.onerror = () => setTimeout(() => URL.revokeObjectURL(url), 500);
    preview.append(image);
    const text = document.createElement("div");
    text.className = "file-text-meta";
    const name = document.createElement("div"); name.className = "file-name"; name.textContent = state.file.name;
    const size = document.createElement("div"); size.className = "file-size"; size.textContent = formatBytes(state.file.size);
    text.append(name, size);
    meta.append(preview, text);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-file";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => resetToUpload(false));
    row.append(meta, remove);
    list.append(row);
  }
  async function ensureEngine() {
    if (state.engine) return state.engine;
    if (state.enginePromise) return state.enginePromise;
    state.enginePromise = import("./engines/crop-rotate.js").then(async engine => {
      await engine.setup?.({ root, getFiles: () => state.file ? [state.file] : [], setStatus, setProgress, formatBytes });
      state.engine = engine;
      return engine;
    }).catch(error => {
      state.enginePromise = null;
      throw error;
    });
    return state.enginePromise;
  }
  async function resetToUpload(confirm) {
    if (state.busy) return;
    if (confirm && state.file) {
      const ok = await popup("confirm", "Clear this image?", "This clears the current image and result. Your original file stays unchanged.", { confirmLabel: "Clear All" });
      if (!ok) return;
    }
    try { await state.engine?.reset?.({ root }); } catch (error) { console.warn("Crop engine cleanup failed", error); }
    state.file = null;
    clearResultView();
    list.replaceChildren();
    input.value = "";
    root.querySelectorAll("select, input[type='range']").forEach(control => {
      control.value = control.defaultValue;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    setProgress(null);
    setStatus("", "", false);
    setBusy(false);
    setPhase("upload");
    root.querySelector("[data-step='actions']")?.removeAttribute("aria-hidden");
  }
  async function selectFile(file) {
    if (state.busy || !file) return;
    if (!accepts(file, rules)) {
      await popup("error", "Unsupported file", "Use JPG, PNG, or WebP.");
      return;
    }
    if (!file.size) {
      await popup("error", "Empty file", "This file has no content.");
      return;
    }
    if (file.size > MAX_BYTES) {
      await popup("error", "File too large", `Maximum size is ${formatBytes(MAX_BYTES)}.`);
      return;
    }
    setBusy(true);
    setStatus("Reading image…", "working", true);
    setProgress(null);
    clearResultView();
    try {
      const engine = await ensureEngine();
      state.file = file;
      await engine.onFiles?.({ root, files: [file], setStatus, setProgress, formatBytes });
      renderFile();
      setPhase("settings");
      setStatus("Image ready. Adjust the crop, rotation or flip, then export.", "success", true);
    } catch (error) {
      state.file = null;
      try { await state.engine?.reset?.({ root }); } catch (_) {}
      list.replaceChildren();
      setPhase("upload");
      setStatus(error?.message || "The image could not be opened.", "error", true);
      await popup("error", "Could not open image", error?.message || "Try another image.");
    } finally {
      input.value = "";
      setBusy(false);
    }
  }
  function renderResult(output) {
    clearResultView();
    state.output = output;
    state.resultUrl = URL.createObjectURL(output.blob);
    const shell = document.createElement("section");
    shell.className = "crop-result-card";
    const head = document.createElement("div");
    head.className = "crop-result-head";
    const copy = document.createElement("div");
    const title = document.createElement("h2"); title.textContent = "Export ready";
    const text = document.createElement("p"); text.textContent = output.meta || "Your edited image is ready to download.";
    copy.append(title, text);
    const badge = document.createElement("span"); badge.className = "complete-badge"; badge.textContent = "✓ Complete";
    head.append(copy, badge);
    const row = document.createElement("div"); row.className = "result-row";
    const left = document.createElement("div");
    const name = document.createElement("div"); name.className = "result-name"; name.textContent = output.name;
    const meta = document.createElement("div"); meta.className = "result-meta"; meta.textContent = output.meta || formatBytes(output.blob.size);
    left.append(name, meta);
    const download = document.createElement("a"); download.className = "btn secondary"; download.textContent = "Download"; download.href = state.resultUrl; download.download = output.name;
    row.append(left, download);
    const actions = document.createElement("div"); actions.className = "crop-result-actions";
    const another = document.createElement("button"); another.type = "button"; another.className = "btn secondary"; another.textContent = "Edit Another"; another.addEventListener("click", () => resetToUpload(true));
    const clearResult = document.createElement("button"); clearResult.type = "button"; clearResult.className = "btn secondary"; clearResult.textContent = "Clear All"; clearResult.addEventListener("click", () => resetToUpload(true));
    actions.append(another, clearResult);
    shell.append(head, row, actions);
    results.append(shell);
  }
  async function exportImage() {
    if (!state.file || state.busy) return;
    setBusy(true);
    setPhase("processing");
    setStatus("Preparing image…", "working", true);
    setProgress(0, "Starting…");
    try {
      const engine = await ensureEngine();
      const output = await engine.process({ root, files: [state.file], say: (message, kind = "working", percent) => {
        setStatus(message, kind, true);
        if (Number.isFinite(percent)) setProgress(percent, message);
      }});
      if (!Array.isArray(output) || !output[0]) throw new Error("No result was produced.");
      renderResult(output[0]);
      setProgress(null);
      setStatus("", "", false);
      setPhase("results");
      // Result phase has its own controls. Never leave the generic action/status
      // surfaces visible after export.
      root.querySelector("[data-tool-status]")?.setAttribute("hidden", "");
      root.querySelector("[data-step='actions']")?.setAttribute("aria-hidden", "true");
    } catch (error) {
      setProgress(null);
      setPhase("settings");
      const message = error?.message || "The image could not be exported.";
      setStatus(message, "error", true);
      await popup("error", "Export failed", message);
    } finally {
      setBusy(false);
    }
  }

  browse.addEventListener("click", event => { event.stopPropagation(); if (!state.busy) input.click(); });
  drop.addEventListener("click", () => { if (!state.busy) input.click(); });
  drop.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && !state.busy) { event.preventDefault(); input.click(); }
  });
  input.addEventListener("change", event => selectFile(event.target.files?.[0]));
  ["dragenter", "dragover"].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); if (!state.busy) drop.dataset.active = "true"; }));
  ["dragleave", "drop"].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.dataset.active = "false"; }));
  drop.addEventListener("drop", event => selectFile(event.dataTransfer?.files?.[0]));
  start.addEventListener("click", exportImage);
  clear.addEventListener("click", () => resetToUpload(true));
  window.addEventListener("beforeunload", () => revokeResult());

  root.querySelectorAll("input[type='range']").forEach(control => {
    const output = control.closest(".range-row")?.querySelector("output");
    const update = () => { if (output) output.textContent = `${control.value}%`; };
    control.addEventListener("input", update); update();
  });
  setBusy(false);
  setPhase("upload");
  setStatus("", "", false);
  ensureEngine().catch(() => {});
  return state;
}
