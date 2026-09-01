import { loadPdfLib } from "./pdf-library-loader.js";

const MAX_FILES = 30;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_SOURCE_DIMENSION = 9_000;
const MAX_EMBED_DIMENSION = 4_096;
const A4 = { w: 595.28, h: 841.89 };
const LETTER = { w: 612, h: 792 };

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / Math.pow(1024, index);
  return `${size < 10 && index > 0 ? size.toFixed(1) : Math.round(size)} ${units[index]}`;
}

function imageType(file) {
  const type = file.type === "image/jpg" ? "image/jpeg" : (file.type || "").toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(type)) return type;
  const name = (file.name || "").toLowerCase();
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  if (/\.webp$/.test(name)) return "image/webp";
  return null;
}

function cleanName(value) {
  return (value || "images")
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "images";
}

function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function confirmDialog(title, message, confirmText = "Continue") {
  if (window.OrivaDialog?.confirm) {
    return window.OrivaDialog.confirm({ title, message, confirmText, cancelText: "Cancel" });
  }
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

function errorDialog(title, message) {
  if (window.OrivaDialog?.show) {
    return window.OrivaDialog.show({ title, message, confirmText: "OK" });
  }
  window.alert(`${title}\n\n${message}`);
  return Promise.resolve();
}

function fitRect(imgW, imgH, pageW, pageH) {
  const scale = Math.min(pageW / imgW, pageH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return { x: (pageW - width) / 2, y: (pageH - height) / 2, width, height };
}

async function decodeImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (_) {
    return createImageBitmap(file);
  }
}

async function prepareImage(file, type) {
  const bitmap = await decodeImage(file);
  let canvas = null;

  try {
    const pixels = bitmap.width * bitmap.height;
    if (pixels > MAX_PIXELS || Math.max(bitmap.width, bitmap.height) > MAX_SOURCE_DIMENSION) {
      throw new Error("Image resolution is too large for the current safe processing limits.");
    }

    let width = bitmap.width;
    let height = bitmap.height;
    const longest = Math.max(width, height);

    if (longest > MAX_EMBED_DIMENSION) {
      const ratio = MAX_EMBED_DIMENSION / longest;
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: type === "image/png" });
    if (!context) throw new Error("Canvas processing is unavailable in this browser.");

    if (type !== "image/png") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(bitmap, 0, 0, width, height);

    // pdf-lib embeds JPEG and PNG. WebP is safely re-encoded as JPEG.
    const mime = type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        value => value ? resolve(value) : reject(new Error("Image could not be prepared.")),
        mime,
        mime === "image/jpeg" ? 0.92 : undefined
      );
    });

    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width,
      height,
      mime
    };
  } finally {
    try { bitmap.close?.(); } catch (_) {}
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export function initImagesToPdfRuntime(root) {
  if (!root || root.dataset.i2pRuntimeInitialized === "true") return null;

  const input = root.querySelector("[data-pdf-input]");
  const drop = root.querySelector("[data-drop-zone]");
  const browse = root.querySelector("[data-browse]");
  const list = root.querySelector("[data-file-list]");
  const start = root.querySelector("[data-start]");
  const clear = root.querySelector("[data-reset]");
  const status = root.querySelector("[data-tool-status]");
  const progressWrap = root.querySelector("[data-progress-wrap]");
  const progressFill = root.querySelector("[data-progress-fill]");
  const progressText = root.querySelector("[data-progress-text]");
  const results = root.querySelector("[data-result-list]");
  const totalFiles = root.querySelector("[data-i2p-total-files]");
  const totalSize = root.querySelector("[data-i2p-total-size]");
  const capacity = root.querySelector("[data-i2p-capacity]");
  const ready = root.querySelector("[data-i2p-ready]");
  const actionCard = root.querySelector('.i2p-action-card[data-step="actions"]');

  if (!input || !drop || !browse || !list || !start || !clear || !status || !results || !actionCard) {
    return null;
  }

  root.dataset.i2pRuntimeInitialized = "true";

  const state = {
    items: [],
    busy: false,
    output: null,
    outputUrl: null,
    previewUrls: new Set(),
    addChain: Promise.resolve(),
    dragId: null
  };

  const WORKFLOW_PHASES = new Set(["upload", "settings", "processing", "results"]);

  function setPhase(nextPhase) {
    const phase = WORKFLOW_PHASES.has(nextPhase) ? nextPhase : "upload";
    root.dataset.phase = phase;
    root.dataset.workflow = phase;

    // One visibility authority for this tool. Every transition starts by hiding all
    // workflow surfaces, then exposes only the surfaces owned by the new phase.
    // This prevents a previous phase's action card from leaking into completion UI.
    const steps = {
      upload: root.querySelectorAll('[data-step="upload"]'),
      files: root.querySelectorAll('[data-step="files"]'),
      settings: root.querySelectorAll('[data-step="settings"]'),
      safety: root.querySelectorAll('[data-step="safety"]'),
      status: root.querySelectorAll('[data-step="status"]'),
      progress: root.querySelectorAll('[data-step="progress"]'),
      results: root.querySelectorAll('[data-step="results"]'),
      actions: root.querySelectorAll('[data-step="actions"]')
    };

    Object.values(steps).forEach(nodes => nodes.forEach(node => { node.hidden = true; }));

    const show = key => steps[key].forEach(node => { node.hidden = false; });

    if (phase === "upload") {
      show("upload");
      if (root.dataset.statusVisible === "true") show("status");
    } else if (phase === "settings") {
      show("files");
      show("settings");
      show("safety");
      show("status");
      show("actions");
    } else if (phase === "processing") {
      show("status");
      if (progressWrap && !progressWrap.hidden) show("progress");
    } else if (phase === "results") {
      show("results");
    }

    // The editable action card has exactly one owner: the settings phase.
    // Completion actions are rendered inside the result card, so the shared
    // Clear All / Create PDF card must never survive into processing/results.
    actionCard.hidden = phase !== "settings";

    if (phase !== "processing" && progressWrap) {
      progressWrap.hidden = true;
      progressWrap.setAttribute("aria-hidden", "true");
    }
  }

  function setStatus(message = "", kind = "", visible = false) {
    status.textContent = message;
    status.dataset.kind = kind;
    root.dataset.statusVisible = visible ? "true" : "false";
    if (root.dataset.phase === "upload") {
      status.hidden = !visible;
    }
  }

  function setProgress(percent = null, text = "") {
    if (!progressWrap) return;
    const visible = Number.isFinite(percent);
    progressWrap.hidden = !visible;
    progressWrap.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible && root.dataset.phase === "processing") {
      root.querySelectorAll('[data-step="progress"]').forEach(node => { node.hidden = false; });
    }

    if (!visible) {
      if (progressFill) progressFill.style.width = "0%";
      if (progressText) progressText.textContent = "";
      return;
    }

    const safe = Math.max(0, Math.min(100, Math.round(percent)));
    if (progressFill) progressFill.style.width = `${safe}%`;
    if (progressText) progressText.textContent = text || `${safe}%`;
  }

  function revokeOutput() {
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = null;
    state.output = null;
  }

  function revokePreviews() {
    state.previewUrls.forEach(url => URL.revokeObjectURL(url));
    state.previewUrls.clear();
  }

  function totalBytes() {
    return state.items.reduce((sum, item) => sum + item.file.size, 0);
  }

  function pageMode() {
    return root.querySelector("[data-page-size]:checked")?.value || "fit";
  }

  function updateSummary() {
    const count = state.items.length;
    const size = totalBytes();
    const remainingFiles = Math.max(0, MAX_FILES - count);
    const remainingSize = Math.max(0, MAX_TOTAL_SIZE - size);

    if (totalFiles) totalFiles.textContent = String(count);
    if (totalSize) totalSize.textContent = formatBytes(size);
    if (capacity) {
      capacity.textContent = `${remainingFiles} image slot${remainingFiles === 1 ? "" : "s"} · ${formatBytes(remainingSize)} remaining`;
    }

    const mode = pageMode();
    const label = mode === "a4" ? "A4" : mode === "letter" ? "Letter" : "fit-to-image";
    if (ready) {
      ready.textContent = count && !state.busy
        ? `Ready to create a ${count}-page PDF (${label}).`
        : "Add at least 1 image to create a PDF.";
    }

    start.disabled = state.busy || count === 0;
    clear.disabled = state.busy || (count === 0 && !state.output);
  }

  function makePreview(file) {
    const box = document.createElement("div");
    box.className = "image-file-preview";

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";

    const url = URL.createObjectURL(file);
    state.previewUrls.add(url);
    img.src = url;

    const release = () => {
      if (state.previewUrls.delete(url)) URL.revokeObjectURL(url);
    };
    img.onload = release;
    img.onerror = release;

    box.append(img);
    return box;
  }

  function moveItem(id, direction) {
    if (state.busy) return;
    const index = state.items.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.items.length) return;

    [state.items[index], state.items[target]] = [state.items[target], state.items[index]];
    renderFiles();
    afterReorder();
  }

  function moveItemTo(id, targetId) {
    if (state.busy || !id || id === targetId) return;
    const from = state.items.findIndex(item => item.id === id);
    const to = state.items.findIndex(item => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const [moved] = state.items.splice(from, 1);
    state.items.splice(to, 0, moved);
    renderFiles();
    afterReorder();
  }

  function afterReorder() {
    if (!state.busy && state.items.length) {
      revokeOutput();
      results.replaceChildren();
      setPhase("settings");
      setStatus(`${state.items.length} image${state.items.length === 1 ? "" : "s"} ready. Page order updated.`, "success", true);
    }
  }

  function removeItem(id) {
    if (state.busy) return;
    state.items = state.items.filter(item => item.id !== id);
    if (!state.items.length) {
      resetToUpload();
      return;
    }
    afterFileChange("Image removed. Review the settings, then continue.");
  }

  function renderFiles() {
    list.replaceChildren();

    if (!state.items.length) {
      list.innerHTML = '<div class="empty-state">No images selected yet.</div>';
      updateSummary();
      return;
    }

    state.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.draggable = !state.busy;
      row.dataset.id = item.id;

      const meta = document.createElement("div");
      meta.className = "file-meta";
      meta.append(makePreview(item.file));

      const text = document.createElement("div");
      text.className = "file-text-meta";

      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = item.file.name;

      const details = document.createElement("div");
      details.className = "file-size";
      details.textContent = `${formatBytes(item.file.size)} · ${item.type.replace("image/", "").toUpperCase()} · #${index + 1}`;

      text.append(name, details);
      meta.append(text);

      const controls = document.createElement("div");
      controls.className = "file-controls";

      const up = document.createElement("button");
      up.type = "button";
      up.className = "icon-btn";
      up.textContent = "↑";
      up.setAttribute("aria-label", "Move image up");
      up.disabled = state.busy || index === 0;
      up.addEventListener("click", () => moveItem(item.id, -1));

      const down = document.createElement("button");
      down.type = "button";
      down.className = "icon-btn";
      down.textContent = "↓";
      down.setAttribute("aria-label", "Move image down");
      down.disabled = state.busy || index === state.items.length - 1;
      down.addEventListener("click", () => moveItem(item.id, 1));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-file";
      remove.textContent = "Remove";
      remove.disabled = state.busy;
      remove.addEventListener("click", () => removeItem(item.id));

      controls.append(up, down, remove);
      row.append(meta, controls);

      row.addEventListener("dragstart", event => {
        if (state.busy) {
          event.preventDefault();
          return;
        }
        state.dragId = item.id;
        row.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      });

      row.addEventListener("dragend", () => {
        state.dragId = null;
        row.classList.remove("is-dragging");
        delete row.dataset.dragOver;
      });

      row.addEventListener("dragover", event => {
        if (state.busy) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        row.dataset.dragOver = "true";
      });

      row.addEventListener("dragleave", () => delete row.dataset.dragOver);

      row.addEventListener("drop", event => {
        if (state.busy) return;
        event.preventDefault();
        delete row.dataset.dragOver;
        const sourceId = state.dragId || event.dataTransfer.getData("text/plain");
        moveItemTo(sourceId, item.id);
        state.dragId = null;
      });

      list.append(row);
    });

    updateSummary();
  }

  function afterFileChange(message = null) {
    revokeOutput();
    results.replaceChildren();
    setProgress(null);
    renderFiles();

    if (!state.items.length) {
      setPhase("upload");
      setStatus("", "", false);
      return;
    }

    setPhase("settings");
    setStatus(
      message || `${state.items.length} image${state.items.length === 1 ? "" : "s"} ready. Review the settings, then continue.`,
      "success",
      true
    );
  }

  async function addFilesInternal(fileList) {
    const incoming = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
    if (!incoming.length) return;

    if (state.busy) return;
    drop.dataset.reading = "true";

    const rejected = [];
    let size = totalBytes();

    try {
      for (const file of incoming) {
        if (state.items.length >= MAX_FILES) {
          rejected.push(`${file.name}: maximum ${MAX_FILES} images at a time.`);
          continue;
        }

        const type = imageType(file);
        if (!type) {
          rejected.push(`${file.name}: only JPG, PNG and WebP are supported.`);
          continue;
        }
        if (!file.size) {
          rejected.push(`${file.name}: empty file.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          rejected.push(`${file.name}: larger than 100 MB.`);
          continue;
        }
        if (size + file.size > MAX_TOTAL_SIZE) {
          rejected.push(`${file.name}: total batch limit of 250 MB would be exceeded.`);
          continue;
        }
        if (state.items.some(item => item.file.name === file.name && item.file.size === file.size)) {
          rejected.push(`${file.name}: already in the list.`);
          continue;
        }

        state.items.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          file,
          type
        });
        size += file.size;
        await yieldToUI();
      }
    } finally {
      delete drop.dataset.reading;
      input.value = "";
    }

    afterFileChange();

    if (rejected.length) {
      const details = rejected.slice(0, 6).join("\n");
      const suffix = rejected.length > 6 ? `\n+ ${rejected.length - 6} more file(s).` : "";
      const message = `Check the limits and try again with supported images.\n\n${details}${suffix}`;
      setStatus(state.items.length ? `${state.items.length} image${state.items.length === 1 ? "" : "s"} added. Some files were skipped.` : "No supported images were added.", state.items.length ? "success" : "error", true);
      await errorDialog("Some files were skipped", message);
    }
  }

  function addFiles(fileList) {
    if (state.busy) return;
    const snapshot = Array.from(fileList || []);
    if (!snapshot.length) return;

    state.addChain = state.addChain
      .then(() => addFilesInternal(snapshot))
      .catch(async error => {
        console.error(error);
        await errorDialog("Upload failed", error?.message || "Could not add the selected images.");
      });
  }

  function resetControls() {
    root.querySelectorAll("input,select,textarea").forEach(control => {
      if (control === input) return;
      if (control.type === "radio" || control.type === "checkbox") {
        control.checked = control.defaultChecked;
      } else if (control.type !== "file") {
        control.value = control.defaultValue;
      }
    });
  }

  function resetToUpload() {
    if (state.busy) return;
    revokeOutput();
    revokePreviews();
    state.items = [];
    state.dragId = null;
    results.replaceChildren();
    input.value = "";
    resetControls();
    setProgress(null);
    setStatus("", "", false);
    setPhase("upload");
    renderFiles();
  }

  async function clearAll() {
    if (state.busy || (!state.items.length && !state.output)) return;
    const confirmed = await confirmDialog(
      "Clear all images?",
      "This removes the current list and result. Your original files stay unchanged.",
      "Clear All"
    );
    if (confirmed) resetToUpload();
  }

  async function createAnother() {
    if (state.busy) return;
    const confirmed = await confirmDialog(
      "Create another PDF?",
      "This clears the current list and result. Your original files stay unchanged.",
      "Create Another"
    );
    if (confirmed) resetToUpload();
  }

  async function process() {
    if (state.busy || !state.items.length) return;

    state.busy = true;
    root.dataset.processing = "true";
    window.__orivaProcessing = true;
    revokeOutput();
    results.replaceChildren();
    setPhase("processing");
    setProgress(2, "Preparing PDF…");
    setStatus("Preparing the selected images…", "working", true);
    updateSummary();

    const snapshot = [...state.items];
    const mode = pageMode();

    try {
      const PDFLib = await loadPdfLib();
      if (!PDFLib?.PDFDocument) {
        throw new Error("PDF library did not initialize. Please try again.");
      }

      const pdf = await PDFLib.PDFDocument.create();
      pdf.setTitle("OrivaStudio Images to PDF");
      pdf.setProducer("OrivaStudio");

      for (let index = 0; index < snapshot.length; index++) {
        const item = snapshot[index];
        setProgress(
          ((index + 0.2) / snapshot.length) * 94,
          `Adding image ${index + 1} of ${snapshot.length}…`
        );
        setStatus(item.file.name, "working", true);

        const prepared = await prepareImage(item.file, item.type);
        const embedded = prepared.mime === "image/png"
          ? await pdf.embedPng(prepared.bytes)
          : await pdf.embedJpg(prepared.bytes);

        let pageW;
        let pageH;
        let draw;

        if (mode === "fit") {
          const pxToPt = 72 / 96;
          const maxSide = 842;
          pageW = prepared.width * pxToPt;
          pageH = prepared.height * pxToPt;
          const longSide = Math.max(pageW, pageH);
          if (longSide > maxSide) {
            const scale = maxSide / longSide;
            pageW *= scale;
            pageH *= scale;
          }
          draw = { x: 0, y: 0, width: pageW, height: pageH };
        } else {
          const landscape = prepared.width >= prepared.height;
          const base = mode === "a4" ? A4 : LETTER;
          pageW = landscape ? base.h : base.w;
          pageH = landscape ? base.w : base.h;
          draw = fitRect(prepared.width, prepared.height, pageW, pageH);
        }

        const page = pdf.addPage([pageW, pageH]);
        page.drawImage(embedded, draw);

        setProgress(
          ((index + 1) / snapshot.length) * 94,
          `Added image ${index + 1} of ${snapshot.length}`
        );
        await yieldToUI();
      }

      setProgress(98, "Saving PDF…");
      const bytes = await pdf.save();
      const outputName = `${cleanName(root.querySelector("[data-output-name]")?.value || "images")}.pdf`;

      state.output = new Blob([bytes], { type: "application/pdf" });
      state.outputUrl = URL.createObjectURL(state.output);

      setProgress(100, "PDF ready");
      await yieldToUI();
      renderResult(outputName, snapshot.length);
      setPhase("results");
      setStatus("PDF ready to download.", "success", true);
    } catch (error) {
      console.error(error);
      setProgress(null);
      setPhase("settings");
      setStatus(error?.message || "PDF could not be created.", "error", true);
      await errorDialog(
        "Could not create PDF",
        error?.message || "Something went wrong while building the PDF."
      );
    } finally {
      state.busy = false;
      root.dataset.processing = "false";
      window.__orivaProcessing = false;
      updateSummary();
    }
  }

  function renderResult(name, pages) {
    results.replaceChildren();

    const card = document.createElement("section");
    card.className = "i2p-result-card";

    const title = document.createElement("h2");
    title.textContent = "PDF Ready";

    const summary = document.createElement("p");
    summary.textContent = `${pages} page${pages === 1 ? "" : "s"} · ${name} is ready to download.`;

    const size = document.createElement("p");
    size.className = "i2p-result-size";
    size.textContent = `File size: ${formatBytes(state.output?.size || 0)}`;

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn secondary";
    again.textContent = "Create Another";
    again.addEventListener("click", createAnother);

    const download = document.createElement("button");
    download.type = "button";
    download.className = "btn primary";
    download.textContent = "Download PDF";
    download.addEventListener("click", () => {
      if (!state.outputUrl) return;
      const link = document.createElement("a");
      link.href = state.outputUrl;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
    });

    actions.append(again, download);
    card.append(title, summary, size, actions);
    results.append(card);
  }

  browse.addEventListener("click", event => {
    event.preventDefault();
    if (!state.busy) input.click();
  });

  drop.tabIndex = 0;
  drop.setAttribute("role", "button");
  drop.setAttribute("aria-label", "Upload images");
  drop.addEventListener("click", event => {
    if (event.target.closest("button,a,input,label")) return;
    if (!state.busy) input.click();
  });
  drop.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!state.busy) input.click();
    }
  });

  input.addEventListener("change", event => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    addFiles(selected);
  });

  ["dragenter", "dragover"].forEach(type => {
    drop.addEventListener(type, event => {
      event.preventDefault();
      if (!state.busy) drop.dataset.active = "true";
    });
  });

  ["dragleave", "drop"].forEach(type => {
    drop.addEventListener(type, event => {
      event.preventDefault();
      drop.dataset.active = "false";
    });
  });

  drop.addEventListener("drop", event => {
    if (state.busy) return;
    addFiles(Array.from(event.dataTransfer?.files || []));
  });

  clear.addEventListener("click", clearAll);
  start.addEventListener("click", process);
  root.querySelectorAll("[data-page-size]").forEach(control => {
    control.addEventListener("change", updateSummary);
  });

  window.addEventListener("pagehide", () => {
    revokeOutput();
    revokePreviews();
  }, { once: true });

  setPhase("upload");
  root.dataset.processing = "false";
  root.dataset.statusVisible = "false";
  setProgress(null);
  renderFiles();

  return {
    reset: resetToUpload,
    getFiles: () => state.items.map(item => item.file)
  };
}
