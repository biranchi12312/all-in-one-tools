import * as engine from "../engines/compress-images.js";

const LIMITS = Object.freeze({
  maxFiles: 100,
  maxFileBytes: 100 * 1024 * 1024,
  maxTotalBytes: 500 * 1024 * 1024
});

const TYPES = new Map([
  ["image/jpeg", "JPG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"]
]);

const lazyLoads = new Map();

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes <= 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}

function resolveType(file) {
  const raw = String(file?.type || "").toLowerCase();
  const normalized = raw === "image/jpg" ? "image/jpeg" : raw;
  if (TYPES.has(normalized)) return normalized;
  const name = String(file?.name || "").toLowerCase();
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  if (/\.webp$/.test(name)) return "image/webp";
  return null;
}

function uniqueName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot < 0 ? name : name.slice(0, dot);
  const ext = dot < 0 ? "" : name.slice(dot);
  let count = 2;
  let candidate = `${stem} (${count})${ext}`;
  while (used.has(candidate)) candidate = `${stem} (${++count})${ext}`;
  used.add(candidate);
  return candidate;
}

function ask(kind, title, message, items = [], options = {}) {
  const variant = ["error", "warning", "success", "confirm"].includes(kind) ? kind : "error";
  const api = window.OrivaDialog;
  const payload = {
    title,
    message,
    items: Array.isArray(items) ? items : [],
    variant,
    confirmLabel: options.confirmLabel || (variant === "confirm" ? "Continue" : "OK"),
    cancelLabel: variant === "confirm" ? (options.cancelLabel || "Cancel") : null
  };

  if (api?.[variant]) return api[variant](payload);
  if (api?.show) return api.show(payload);

  // The shared dialog is loaded by the page before this runtime. These
  // fallbacks only keep a direct/manual module load from leaving a workflow
  // unresolved if the shared UI asset is unavailable.
  if (variant === "confirm") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  window.alert(`${title}\n\n${message}`);
  return Promise.resolve(true);
}

function loadExternal(url, key, globalName, timeoutMs = 20000) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (lazyLoads.has(key)) return lazyLoads.get(key);
  const task = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-oriva-library="${key}"]`);
    let timer = null, settled = false;
    const cleanup = () => { if (timer) clearTimeout(timer); };
    const fail = message => { if (settled) return; settled = true; cleanup(); try { if (!existing) script?.remove(); } catch (_) {} reject(new Error(message)); };
    const finish = () => { if (settled) return; if (!window[globalName]) return fail("Required download component did not initialize."); settled = true; cleanup(); resolve(window[globalName]); };
    if (existing) {
      if (window[globalName]) return finish();
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => fail("Required download component could not be loaded."), { once: true });
      timer = setTimeout(() => fail("Required download component could not be loaded in time. Check your connection and try again."), timeoutMs);
      return;
    }
    const script = document.createElement("script"); script.src = url; script.async = true; script.dataset.orivaLibrary = key;
    script.onload = finish; script.onerror = () => fail("Required download component could not be loaded.");
    timer = setTimeout(() => fail("Required download component could not be loaded in time. Check your connection and try again."), timeoutMs);
    document.head.append(script);
  });
  lazyLoads.set(key, task); task.catch(() => lazyLoads.delete(key)); return task;
}

export function initCompressImagesController(root) {
  if (!root || root.dataset.runtimeReady === "true") return null;

  const find = selector => root.querySelector(selector);
  const ui = {
    input: find("[data-image-input]"),
    drop: find("[data-drop-zone]"),
    browse: find("[data-browse]"),
    files: find("[data-file-list]"),
    settings: find("[data-step=settings]"),
    safety: find("[data-step=safety]"),
    status: find("[data-tool-status]"),
    progress: find("[data-progress-wrap]"),
    progressFill: find("[data-progress-fill]"),
    progressText: find("[data-progress-text]"),
    progressTitle: find("[data-progress-title]"),
    progressPercent: find("[data-progress-percent]"),
    results: find("[data-result-list]"),
    actions: find("[data-step=actions]"),
    start: find("[data-start]"),
    reset: find("[data-reset]"),
    more: find("[data-process-more]"),
    resultActions: find("[data-result-actions]"),
    downloadAll: find("[data-download-all]"),
    quality: find("[data-quality]"),
    qualityOutput: find("output"),
    format: find("[data-output-format]")
  };

  if (Object.values(ui).some(node => !node)) return null;
  root.dataset.runtimeReady = "true";

  const state = {
    items: [],
    outputs: [],
    busy: false,
    operationId: null,
    uploadQueue: Promise.resolve(),
    outputUrls: new Set(),
    disposed: false
  };

  function setPhase(phase) {
    root.dataset.phase = phase;
  }

  function setStatus(text = "", kind = "", visible = false) {
    ui.status.textContent = text;
    if (kind) ui.status.dataset.kind = kind;
    else delete ui.status.dataset.kind;
    ui.status.hidden = !visible;
  }

  function showProgress(done, total, title, name) {
    if (!total) {
      ui.progress.hidden = true;
      ui.progressFill.style.width = "0%";
      ui.progressPercent.textContent = "0%";
      ui.progressText.textContent = "";
      return;
    }
    const percent = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    ui.progress.hidden = false;
    ui.progressTitle.textContent = title || "Compressing images";
    ui.progressPercent.textContent = `${percent}%`;
    ui.progressText.textContent = name
      ? `${done} of ${total} complete • ${name}`
      : `${done} of ${total} complete`;
    ui.progressFill.style.width = `${percent}%`;
  }

  function finishProgress(total) {
    if (!total) return showProgress(0, 0);
    ui.progress.hidden = false;
    ui.progressTitle.textContent = "Compression complete";
    ui.progressPercent.textContent = "100%";
    ui.progressText.textContent = `${total} of ${total} complete`;
    ui.progressFill.style.width = "100%";
  }

  function revokeOutputUrls() {
    for (const url of state.outputUrls) URL.revokeObjectURL(url);
    state.outputUrls.clear();
    state.outputs = [];
  }

  function revokeItemPreviews(items = state.items) {
    for (const item of items) {
      if (item.preview) URL.revokeObjectURL(item.preview);
    }
  }

  function clearResults({ hideProgress = true } = {}) {
    revokeOutputUrls();
    ui.results.replaceChildren();
    ui.results.hidden = true;
    ui.resultActions.hidden = true;
    ui.downloadAll.hidden = true;
    if (hideProgress) showProgress(0, 0);
  }

  function setBusy(active) {
    if (active) {
      if (state.busy || window.__orivaProcessing) return false;
      state.busy = true;
      state.operationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.__orivaProcessing = state.operationId;
    } else {
      if (state.operationId && window.__orivaProcessing === state.operationId) {
        window.__orivaProcessing = false;
      }
      state.busy = false;
      state.operationId = null;
    }

    root.dataset.processing = String(active);
    ui.input.disabled = active;
    ui.browse.disabled = active;
    ui.reset.disabled = active;
    ui.quality.disabled = active;
    ui.format.disabled = active;
    ui.start.disabled = active || state.items.length === 0;
    ui.drop.setAttribute("aria-disabled", String(active));
    return true;
  }

  function renderFiles() {
    ui.files.replaceChildren();
    if (!state.items.length) {
      ui.files.hidden = true;
      return;
    }

    const total = state.items.reduce((sum, item) => sum + item.file.size, 0);
    const summary = document.createElement("div");
    summary.className = "batch-summary";
    summary.textContent = `${state.items.length} image${state.items.length === 1 ? "" : "s"} uploaded • ${formatBytes(total)}`;
    ui.files.append(summary);

    state.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "file-row";

      const meta = document.createElement("div");
      meta.className = "file-meta";
      const preview = document.createElement("div");
      preview.className = "image-file-preview";
      const image = document.createElement("img");
      image.src = item.preview;
      image.alt = "";
      preview.append(image);

      const text = document.createElement("div");
      text.className = "file-text-meta";
      const name = document.createElement("div");
      name.className = "file-name";
      name.title = item.file.name;
      name.textContent = item.file.name;
      const size = document.createElement("div");
      size.className = "file-size";
      size.textContent = `${formatBytes(item.file.size)} • ${TYPES.get(item.type)}`;
      const uploaded = document.createElement("div");
      uploaded.className = "upload-status";
      uploaded.textContent = "✓ Uploaded";
      text.append(name, size, uploaded);
      meta.append(preview, text);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-file";
      remove.textContent = "Remove";
      remove.disabled = state.busy;
      remove.addEventListener("click", () => removeFile(index));
      row.append(meta, remove);
      ui.files.append(row);
    });

    ui.files.hidden = false;
  }

  function syncReadySurface() {
    const hasFiles = state.items.length > 0;
    ui.settings.hidden = !hasFiles;
    ui.safety.hidden = !hasFiles;
    ui.actions.hidden = !hasFiles;
    ui.start.disabled = !hasFiles || state.busy;
    renderFiles();

    if (!state.busy) setPhase(hasFiles ? "settings" : "upload");

    if (hasFiles) {
      setStatus(
        `${state.items.length} image${state.items.length === 1 ? "" : "s"} ready. Review the settings, then continue.`,
        "success",
        true
      );
    } else {
      setStatus("", "", false);
    }
  }

  function removeFile(index) {
    if (state.busy) return;
    const [item] = state.items.splice(index, 1);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    clearResults();
    syncReadySurface();
  }

  function validateAndAdd(fileList) {
    if (state.busy || state.disposed) return Promise.resolve();
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return Promise.resolve();

    const accepted = [];
    const rejected = [];
    let runningTotal = state.items.reduce((sum, item) => sum + item.file.size, 0);

    for (const file of incoming) {
      const type = resolveType(file);
      if (!type) {
        rejected.push(`${file.name || "Unnamed file"}: unsupported format. Use JPG, PNG or WebP.`);
        continue;
      }
      if (!file.size) {
        rejected.push(`${file.name}: this file is empty.`);
        continue;
      }
      if (file.size > LIMITS.maxFileBytes) {
        rejected.push(`${file.name}: larger than 100 MB.`);
        continue;
      }
      if (state.items.length + accepted.length >= LIMITS.maxFiles) {
        rejected.push(`${file.name}: maximum 100 images allowed.`);
        continue;
      }
      if (runningTotal + file.size > LIMITS.maxTotalBytes) {
        rejected.push(`${file.name}: total batch limit of 500 MB would be exceeded.`);
        continue;
      }
      accepted.push({ file, type, preview: URL.createObjectURL(file) });
      runningTotal += file.size;
    }

    if (accepted.length) {
      clearResults();
      state.items.push(...accepted);
      syncReadySurface();
    }

    ui.input.value = "";
    if (!rejected.length) return Promise.resolve();
    return ask(
      "error",
      rejected.length === 1 ? "File could not be added" : "Some files could not be added",
      rejected.length === 1 ? "This image was skipped." : `${rejected.length} images were skipped.`,
      rejected
    );
  }

  function enqueueFiles(fileList) {
    state.uploadQueue = state.uploadQueue
      .then(() => validateAndAdd(fileList))
      .catch(async error => {
        console.error(error);
        ui.input.value = "";
        await ask("error", "Upload failed", error?.message || "Unable to add these images.", []);
      });
    return state.uploadQueue;
  }

  async function reset(skipConfirm = false) {
    if (state.busy) return;
    if (!skipConfirm && state.items.length) {
      const confirmed = await ask(
        "confirm",
        "Clear compressed files?",
        "This clears the current image list. Original files stay unchanged.",
        [],
        { confirmLabel: "Clear All", cancelLabel: "Cancel" }
      );
      if (!confirmed) return;
    }

    revokeItemPreviews();
    state.items = [];
    clearResults();
    ui.input.value = "";
    ui.format.value = "keep";
    ui.quality.value = "82";
    ui.qualityOutput.textContent = "82%";
    syncReadySurface();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function enterProcessingSurface() {
    // Only the processing/result surface owns the lower action area while a run
    // is active. Keeping the original action card mounted caused the stale
    // "Compressing..." button to remain visible underneath dialogs/results.
    ui.actions.hidden = true;
    ui.resultActions.hidden = true;
    ui.downloadAll.hidden = true;
  }

  function enterResultsSurface() {
    ui.actions.hidden = true;
    ui.resultActions.hidden = false;
    ui.downloadAll.hidden = state.outputs.length === 0;
  }

  function createResultRow(item, index, total) {
    const row = document.createElement("div");
    row.className = "result-row processing-row";

    const preview = document.createElement("div");
    preview.className = "image-file-preview result-preview";
    const image = document.createElement("img");
    image.src = item.preview;
    image.alt = "";
    preview.append(image);

    const text = document.createElement("div");
    text.className = "file-text-meta";
    const name = document.createElement("div");
    name.className = "result-name";
    name.textContent = item.file.name;
    const meta = document.createElement("div");
    meta.className = "result-meta";
    meta.textContent = `Compressing ${index + 1} / ${total}…`;
    text.append(name, meta);

    row.append(preview, text);
    return { row, name, meta };
  }

  async function process() {
    if (state.busy || !state.items.length) return;
    if (!setBusy(true)) {
      await ask("warning", "Please wait", "Another file operation is already in progress. Wait for it to finish before starting compression.", []);
      return;
    }

    const snapshot = [...state.items];
    const quality = Math.max(0.2, Math.min(0.95, Number(ui.quality.value) / 100 || 0.82));
    const outputType = ui.format.value;
    const usedNames = new Set();
    const failures = [];
    let resizedCount = 0;
    let keptOriginalCount = 0;

    setPhase("processing");
    ui.start.textContent = "Compressing...";
    clearResults({ hideProgress: false });
    enterProcessingSurface();
    ui.results.hidden = false;
    setStatus("Preparing the selected images…", "working", true);
    showProgress(0, snapshot.length, "Starting compression", "");

    try {
      for (let index = 0; index < snapshot.length; index += 1) {
        const item = snapshot[index];
        const { row, name, meta } = createResultRow(item, index, snapshot.length);
        ui.results.append(row);
        showProgress(index, snapshot.length, "Compressing images", item.file.name);

        try {
          const result = await engine.compress(item.file, {
            sourceType: item.type,
            outputType,
            quality
          });
          const outputName = uniqueName(result.name, usedNames);
          const url = URL.createObjectURL(result.blob);
          state.outputUrls.add(url);
          state.outputs.push({ name: outputName, blob: result.blob, url, meta: result.meta });

          if (result.resized) resizedCount += 1;
          if (result.keptOriginal) keptOriginalCount += 1;

          row.classList.remove("processing-row");
          name.textContent = outputName;
          meta.textContent = result.meta;
          const download = document.createElement("a");
          download.className = "btn secondary";
          download.href = url;
          download.download = outputName;
          download.textContent = "Download";
          row.append(download);
        } catch (error) {
          const message = error?.message || "Failed to process";
          console.error(error);
          failures.push(`${item.file.name}: ${message}`);
          row.classList.remove("processing-row");
          row.classList.add("is-failed");
          meta.textContent = message;
        }

        showProgress(index + 1, snapshot.length, "Compressing images", item.file.name);
        await nextFrame();
      }

      setPhase("results");
      finishProgress(snapshot.length);
      enterResultsSurface();

      if (state.outputs.length) {
        setStatus(
          `${state.outputs.length} of ${snapshot.length} image${snapshot.length === 1 ? "" : "s"} processed successfully.`,
          failures.length ? "working" : "success",
          true
        );
      } else {
        setStatus("No image could be compressed. Review the errors and try again.", "error", true);
      }

      if (failures.length) {
        await ask(
          "error",
          failures.length === 1 ? "1 image failed" : `${failures.length} images failed`,
          state.outputs.length
            ? "Some images could not be compressed. The remaining images were processed."
            : "None of the selected images could be compressed. Review the details and try again.",
          failures.slice(0, 12)
        );
      }

      const notes = [];
      if (resizedCount) notes.push(`${resizedCount} image${resizedCount === 1 ? " was" : "s were"} resized to a 4096px max edge for safer browser processing.`);
      if (keptOriginalCount) notes.push(`${keptOriginalCount} image${keptOriginalCount === 1 ? " stayed" : "s stayed"} original because compression did not reduce the file size.`);
      if (notes.length) await ask("warning", "Compression notes", notes.join(" "), []);

      ui.results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error(error);
      setPhase("settings");
      setStatus(error?.message || "Compression could not be completed.", "error", true);
      showProgress(0, 0);
      await ask("error", "Compression failed", error?.message || "Unable to compress these images.", []);
    } finally {
      ui.start.textContent = "Compress Images";
      setBusy(false);
      if (root.dataset.phase !== "results") {
        syncReadySurface();
      } else {
        // Preserve the completed result surface after dialogs close. Do not let
        // the ready-state renderer resurrect the original action buttons.
        ui.actions.hidden = true;
        ui.resultActions.hidden = false;
        ui.downloadAll.hidden = state.outputs.length === 0;
        renderFiles();
      }
    }
  }

  async function downloadZip() {
    if (!state.outputs.length) return;
    const originalText = ui.downloadAll.textContent;
    ui.downloadAll.disabled = true;
    ui.downloadAll.textContent = "Creating ZIP...";

    try {
      const JSZip = await loadExternal(
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        "jszip",
        "JSZip"
      );
      const archive = new JSZip();
      state.outputs.forEach(output => archive.file(output.name, output.blob));
      const blob = await archive.generateAsync(
        { type: "blob", compression: "DEFLATE" },
        meta => { ui.downloadAll.textContent = `Creating ZIP... ${Math.round(meta.percent)}%`; }
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "OrivaStudio_Compressed_Images.zip";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (error) {
      console.error(error);
      await ask("error", "ZIP failed", error?.message || "Could not create the ZIP archive.", []);
    } finally {
      ui.downloadAll.disabled = false;
      ui.downloadAll.textContent = originalText;
    }
  }

  ui.browse.addEventListener("click", event => {
    event.stopPropagation();
    if (!state.busy) ui.input.click();
  });
  ui.drop.addEventListener("click", event => {
    if (state.busy || event.target.closest("[data-browse], button, a, input, label")) return;
    ui.input.click();
  });
  ui.drop.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && !state.busy) {
      event.preventDefault();
      ui.input.click();
    }
  });
  ui.input.addEventListener("change", event => enqueueFiles(event.target.files));

  ["dragenter", "dragover"].forEach(type => ui.drop.addEventListener(type, event => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.busy) ui.drop.dataset.active = "true";
  }));
  ["dragleave", "drop"].forEach(type => ui.drop.addEventListener(type, event => {
    event.preventDefault();
    event.stopPropagation();
    ui.drop.dataset.active = "false";
  }));
  ui.drop.addEventListener("drop", event => { if (!state.busy) enqueueFiles(event.dataTransfer?.files); });

  ui.quality.addEventListener("input", () => { ui.qualityOutput.textContent = `${ui.quality.value}%`; });
  ui.start.addEventListener("click", process);
  ui.reset.addEventListener("click", () => reset(false));
  ui.more.addEventListener("click", async () => {
    if (state.busy) return;

    const confirmed = await ask(
      "confirm",
      "Compress more images?",
      "This clears the current image list and results. Your original files stay unchanged.",
      [],
      { confirmLabel: "Compress More", cancelLabel: "Cancel" }
    );

    if (!confirmed || state.busy) return;
    await reset(true);
  });
  ui.downloadAll.addEventListener("click", downloadZip);

  window.addEventListener("beforeunload", event => {
    if (!state.busy) return;
    event.preventDefault();
    event.returnValue = "";
  });

  syncReadySurface();
  return { reset };
}
