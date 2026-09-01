import { loadPdfJs, createPdfDocumentOptions } from "./pdf-library-loader.js";

const LIMITS = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 100 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  maxTotalPages: 100,
  maxCanvasPixels: 16_000_000,
  maxCanvasDimension: 4096,
  preferredScale: 2
});

const ZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
const zipCache = new Map();

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatCount(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function sameFile(a, b) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function cleanBaseName(name) {
  return (name || "document")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

function getDialogConfirm(title, message, confirmText = "Continue") {
  if (window.OrivaDialog?.confirm) {
    return window.OrivaDialog.confirm({ title, message, confirmText, cancelText: "Cancel" });
  }
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

function showDialog(title, message) {
  if (window.OrivaDialog?.show) {
    return window.OrivaDialog.show({ title, message, confirmText: "OK" });
  }
  window.alert(`${title}\n\n${message}`);
  return Promise.resolve(true);
}

function loadZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (zipCache.has("jszip")) return zipCache.get("jszip");
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-oriva-lib="jszip"]');
    let timer = null, settled = false;
    const cleanup = () => { if (timer) clearTimeout(timer); };
    const fail = message => { if (settled) return; settled = true; cleanup(); try { if (!existing) script?.remove(); } catch (_) {} reject(new Error(message)); };
    const finish = () => { if (settled) return; if (!window.JSZip) return fail("ZIP component did not initialize."); settled = true; cleanup(); resolve(window.JSZip); };
    if (existing) {
      if (window.JSZip) return finish();
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => fail("ZIP component could not be loaded."), { once: true });
      timer = setTimeout(() => fail("ZIP component could not be loaded in time. Check your connection and try again."), 20000);
      return;
    }
    const script = document.createElement("script"); script.src = ZIP_URL; script.async = true; script.dataset.orivaLib = "jszip";
    script.onload = finish; script.onerror = () => fail("ZIP component could not be loaded. Check your connection and try again.");
    timer = setTimeout(() => fail("ZIP component could not be loaded in time. Check your connection and try again."), 20000);
    document.head.append(script);
  });
  zipCache.set("jszip", promise);
  promise.catch(() => zipCache.delete("jszip"));
  return promise;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the page image.")), type, quality);
  });
}

export function initPdfToImagesRuntime(root) {
  if (!root || root.dataset.p2iInitialized === "true") return null;
  root.dataset.p2iInitialized = "true";

  const input = root.querySelector("[data-pdf-input]");
  const drop = root.querySelector("[data-drop-zone]");
  const browse = root.querySelector("[data-browse]");
  const list = root.querySelector("[data-file-list]");
  const summary = root.querySelector("[data-p2i-summary]");
  const totalFiles = root.querySelector("[data-p2i-total-files]");
  const totalSize = root.querySelector("[data-p2i-total-size]");
  const totalPages = root.querySelector("[data-p2i-total-pages]");
  const capacity = root.querySelector("[data-p2i-capacity]");
  const start = root.querySelector("[data-start]");
  const clear = root.querySelector("[data-reset]");
  const status = root.querySelector("[data-tool-status]");
  const progressWrap = root.querySelector("[data-progress-wrap]");
  const progressFill = root.querySelector("[data-progress-fill]");
  const progressText = root.querySelector("[data-progress-text]");
  const results = root.querySelector("[data-result-list]");
  const resultSummary = root.querySelector("[data-p2i-result-summary]");
  const downloadAll = root.querySelector("[data-download-all]");
  const convertMoreButton = root.querySelector("[data-result-reset]");
  const readyCopy = root.querySelector("[data-p2i-ready-copy]");
  const formatPng = root.querySelector('[data-pdf-image-format][value="png"]');
  const formatJpg = root.querySelector('[data-pdf-image-format][value="jpeg"]');
  const quality = root.querySelector("[data-pdf-quality]");
  const qualityCard = root.querySelector("[data-pdf-quality-card]");
  const qualityOutput = root.querySelector("[data-pdf-quality-output]");

  if (!input || !drop || !browse || !list || !start || !clear || !status || !results) {
    throw new Error("PDF to Images workspace is missing required controls.");
  }

  const state = {
    items: [],
    outputs: [],
    busy: false,
    addChain: Promise.resolve(),
    outputUrls: new Set(),
    previewUrls: new Set(),
    thumbnailGeneration: 0,
    destroyed: false
  };

  function setPhase(phase) {
    root.dataset.phase = phase;
  }

  function setStatus(message = "", kind = "", visible = false) {
    status.textContent = message;
    status.dataset.kind = kind;
    root.dataset.statusVisible = visible ? "true" : "false";
  }

  function setProgress(percent = null, message = "") {
    const visible = Number.isFinite(percent);
    progressWrap.hidden = !visible;
    if (!visible) return;
    const safe = Math.max(0, Math.min(100, percent));
    progressFill.style.width = `${safe}%`;
    progressText.textContent = message || `${Math.round(safe)}%`;
  }

  function getFormat() {
    return formatJpg?.checked ? "jpeg" : "png";
  }

  function getQuality() {
    return Math.max(0.5, Math.min(1, Number(quality?.value || 92) / 100));
  }

  function totals() {
    return state.items.reduce((acc, item) => {
      acc.files += 1;
      acc.size += item.file.size;
      acc.pages += item.pages;
      return acc;
    }, { files: 0, size: 0, pages: 0 });
  }

  function updateQualityUI() {
    const jpg = getFormat() === "jpeg";
    if (qualityCard) qualityCard.hidden = !jpg;
    if (qualityOutput) qualityOutput.textContent = `${quality?.value || 92}%`;
  }

  function updateSummary() {
    const info = totals();
    if (summary) summary.hidden = info.files === 0;
    if (totalFiles) totalFiles.textContent = String(info.files);
    if (totalSize) totalSize.textContent = formatBytes(info.size);
    if (totalPages) totalPages.textContent = String(info.pages);
    if (capacity) {
      const fileSlots = Math.max(0, LIMITS.maxFiles - info.files);
      const pageSlots = Math.max(0, LIMITS.maxTotalPages - info.pages);
      const sizeSlots = Math.max(0, LIMITS.maxTotalBytes - info.size);
      capacity.textContent = `${fileSlots} file slot${fileSlots === 1 ? "" : "s"} • ${formatBytes(sizeSlots)} • ${pageSlots} page${pageSlots === 1 ? "" : "s"} remaining`;
    }
    start.disabled = state.busy || info.files < 1;
    if (readyCopy) {
      readyCopy.textContent = info.files
        ? `Ready to convert ${formatCount(info.pages, "page")} to ${getFormat() === "jpeg" ? "JPG" : "PNG"}.`
        : "Add at least 1 PDF to continue.";
    }
  }

  function revokePreviewUrls() {
    state.previewUrls.forEach(url => URL.revokeObjectURL(url));
    state.previewUrls.clear();
  }

  function revokeOutputUrls() {
    state.outputUrls.forEach(url => URL.revokeObjectURL(url));
    state.outputUrls.clear();
  }

  async function inspectPdf(file) {
    const pdfjs = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const head = new TextDecoder("latin1").decode(new Uint8Array(buffer.slice(0, Math.min(1024, buffer.byteLength))));
    if (!head.includes("%PDF")) throw new Error("This file is not a valid PDF.");

    let task = null;
    let pdf = null;
    try {
      task = pdfjs.getDocument(createPdfDocumentOptions(new Uint8Array(buffer), {
        disableAutoFetch: true,
        disableStream: true
      }));
      pdf = await task.promise;
      const pages = Number(pdf.numPages) || 0;
      if (pages < 1) throw new Error("This PDF has no pages.");
      return { pages };
    } catch (error) {
      const message = String(error?.message || error || "");
      if (/password|encrypted/i.test(message)) {
        throw new Error("Password-protected PDFs are not supported.");
      }
      throw new Error(message || "Could not read this PDF.");
    } finally {
      try { await pdf?.destroy?.(); } catch {}
      try { await task?.destroy?.(); } catch {}
    }
  }

  async function createPdfThumbnail(item, generation) {
    let task = null;
    let pdf = null;
    try {
      const pdfjs = await loadPdfJs();
      task = pdfjs.getDocument(createPdfDocumentOptions(new Uint8Array(await item.file.arrayBuffer()), {
        disableAutoFetch: true,
        disableStream: true
      }));
      pdf = await task.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.28 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d", { alpha: false }), viewport }).promise;
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.82);
      const url = URL.createObjectURL(blob);
      state.previewUrls.add(url);
      if (state.destroyed || generation !== state.thumbnailGeneration) {
        URL.revokeObjectURL(url);
        state.previewUrls.delete(url);
        return;
      }
      const preview = list.querySelector(`[data-p2i-preview="${CSS.escape(item.id)}"]`);
      if (!preview) {
        URL.revokeObjectURL(url);
        state.previewUrls.delete(url);
        return;
      }
      const image = document.createElement("img");
      image.alt = `Preview of ${item.file.name}`;
      image.loading = "lazy";
      image.src = url;
      preview.replaceChildren(image);
    } catch {
      // The visible PDF fallback remains in place; a thumbnail failure must not break the workflow.
    } finally {
      try { await pdf?.destroy?.(); } catch {}
      try { await task?.destroy?.(); } catch {}
    }
  }

  function renderFiles() {
    state.thumbnailGeneration += 1;
    const generation = state.thumbnailGeneration;
    revokePreviewUrls();
    list.innerHTML = "";
    state.items.forEach(item => {
      const row = document.createElement("article");
      row.className = "file-row p2i-file-row";
      row.dataset.id = item.id;

      const meta = document.createElement("div");
      meta.className = "file-meta";
      const preview = document.createElement("div");
      preview.className = "pdf-file-preview";
      preview.dataset.p2iPreview = item.id;
      preview.textContent = "PDF";
      const text = document.createElement("div");
      text.className = "file-text-meta";
      const name = document.createElement("div");
      name.className = "file-name";
      name.textContent = item.file.name;
      const detail = document.createElement("div");
      detail.className = "file-size";
      detail.textContent = `${formatBytes(item.file.size)} • ${formatCount(item.pages, "page")}`;
      text.append(name, detail);
      meta.append(preview, text);

      const controls = document.createElement("div");
      controls.className = "file-controls";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-file";
      remove.textContent = "Remove";
      remove.disabled = state.busy;
      remove.addEventListener("click", () => removeItem(item.id));
      controls.append(remove);
      row.append(meta, controls);
      list.append(row);
      createPdfThumbnail(item, generation);
    });
    updateSummary();
  }

  async function removeItem(id) {
    if (state.busy) return;
    state.items = state.items.filter(item => item.id !== id);
    state.outputs = [];
    revokeOutputUrls();
    results.replaceChildren();
    downloadAll.hidden = true;
    setProgress(null);
    if (!state.items.length) {
      setPhase("upload");
      setStatus("", "", false);
    } else {
      setPhase("settings");
      setStatus("", "", false);
    }
    renderFiles();
  }

  async function addFilesInternal(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length || state.busy) return;
    drop.dataset.reading = "true";
    const rejected = [];
    const current = totals();
    let currentSize = current.size;
    let currentPages = current.pages;
    const accepted = [];

    try {
      await loadPdfJs();
      for (const file of incoming) {
        if (state.items.length + accepted.length >= LIMITS.maxFiles) {
          rejected.push(`${file.name}: maximum ${LIMITS.maxFiles} PDFs at a time.`);
          continue;
        }
        if (!isPdf(file)) {
          rejected.push(`${file.name}: only PDF files are accepted.`);
          continue;
        }
        if (!file.size) {
          rejected.push(`${file.name}: the file is empty.`);
          continue;
        }
        if (file.size > LIMITS.maxFileBytes) {
          rejected.push(`${file.name}: larger than 100 MB.`);
          continue;
        }
        if (currentSize + file.size > LIMITS.maxTotalBytes) {
          rejected.push(`${file.name}: total batch limit of 250 MB would be exceeded.`);
          continue;
        }
        if ([...state.items, ...accepted].some(item => sameFile(item.file, file))) {
          rejected.push(`${file.name}: already in the current list.`);
          continue;
        }
        try {
          const { pages } = await inspectPdf(file);
          if (currentPages + pages > LIMITS.maxTotalPages) {
            rejected.push(`${file.name}: would exceed the ${LIMITS.maxTotalPages}-page batch limit.`);
            continue;
          }
          accepted.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            file,
            pages
          });
          currentSize += file.size;
          currentPages += pages;
        } catch (error) {
          rejected.push(`${file.name}: ${error?.message || "could not be added."}`);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (accepted.length) {
        state.items.push(...accepted);
        state.outputs = [];
        revokeOutputUrls();
        results.replaceChildren();
        downloadAll.hidden = true;
        setProgress(null);
        setPhase("settings");
        setStatus("", "", false);
        renderFiles();
      } else if (!state.items.length && rejected.length) {
        setPhase("upload");
        setStatus("No supported PDF could be added.", "error", true);
      }

      if (rejected.length) {
        const detail = rejected.slice(0, 8).join("\n");
        await showDialog("Some files were skipped", detail);
      }
    } finally {
      drop.dataset.reading = "false";
      input.value = "";
    }
  }

  function addFiles(fileList) {
    const snapshot = Array.from(fileList || []);
    if (!snapshot.length || state.busy) return;
    state.addChain = state.addChain
      .then(() => addFilesInternal(snapshot))
      .catch(error => {
        console.error(error);
        setStatus(error?.message || "Files could not be added.", "error", true);
        setPhase(state.items.length ? "settings" : "upload");
      });
  }

  function renderResults() {
    revokeOutputUrls();
    results.replaceChildren();
    state.outputs.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "p2i-result-card";
      const preview = document.createElement("img");
      preview.className = "p2i-result-thumb";
      preview.alt = item.name;
      preview.loading = "lazy";
      const previewUrl = URL.createObjectURL(item.blob);
      state.outputUrls.add(previewUrl);
      preview.src = previewUrl;
      const copy = document.createElement("div");
      copy.className = "p2i-result-meta";
      const name = document.createElement("div");
      name.className = "result-name";
      name.textContent = item.name;
      const meta = document.createElement("div");
      meta.className = "result-meta";
      meta.textContent = `${item.meta} • ${formatBytes(item.blob.size)}`;
      copy.append(name, meta);
      const download = document.createElement("button");
      download.type = "button";
      download.className = "btn secondary";
      download.textContent = "Download";
      download.addEventListener("click", () => downloadOne(index));
      card.append(preview, copy, download);
      results.append(card);
    });
    if (resultSummary) {
      resultSummary.textContent = `${formatCount(state.outputs.length, "image")} ready. Download individually or save everything as a ZIP.`;
    }
    downloadAll.hidden = state.outputs.length < 2;
  }

  function downloadOne(index) {
    const item = state.outputs[index];
    if (!item) return;
    const url = URL.createObjectURL(item.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadAllResults() {
    if (state.outputs.length < 2) return;
    const originalText = downloadAll.textContent;
    try {
      downloadAll.disabled = true;
      downloadAll.textContent = "Creating ZIP…";
      setStatus("Preparing ZIP download…", "working", true);
      const JSZip = await loadZip();
      const zip = new JSZip();
      state.outputs.forEach(item => zip.file(item.name, item.blob));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" }, meta => {
        setProgress(meta.percent, `Preparing ZIP… ${Math.round(meta.percent)}%`);
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "orivastudio-pdf-images.zip";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setProgress(null);
      setStatus("", "", false);
    } catch (error) {
      setProgress(null);
      setStatus(error?.message || "ZIP could not be created.", "error", true);
      await showDialog("ZIP download failed", error?.message || "Please try again.");
    } finally {
      downloadAll.disabled = false;
      downloadAll.textContent = originalText || "Download All as ZIP";
    }
  }

  async function renderPageToBlob(pdf, pageNumber, format, qualityValue) {
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    let scale = LIMITS.preferredScale;
    const rawWidth = base.width * scale;
    const rawHeight = base.height * scale;
    const longSide = Math.max(rawWidth, rawHeight);
    const pixels = rawWidth * rawHeight;
    if (longSide > LIMITS.maxCanvasDimension || pixels > LIMITS.maxCanvasPixels) {
      const byDimension = LIMITS.maxCanvasDimension / Math.max(base.width, base.height, 1);
      const byPixels = Math.sqrt(LIMITS.maxCanvasPixels / Math.max(base.width * base.height, 1));
      scale = Math.max(0.25, Math.min(LIMITS.preferredScale, byDimension, byPixels));
    }
    const viewport = page.getViewport({ scale });
    if (viewport.width < 1 || viewport.height < 1 || viewport.width * viewport.height > LIMITS.maxCanvasPixels) {
      throw new Error(`Page ${pageNumber} is too large for the current safe processing limits.`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await canvasToBlob(canvas, format === "jpeg" ? "image/jpeg" : "image/png", format === "jpeg" ? qualityValue : undefined);
    canvas.width = 1;
    canvas.height = 1;
    return blob;
  }

  async function startConversion() {
    if (state.busy || !state.items.length) return;
    state.busy = true;
    root.dataset.processing = "true";
    setPhase("processing");
    setProgress(0, "Starting conversion…");
    setStatus("Preparing the selected PDFs…", "working", true);
    start.disabled = true;

    const output = [];
    let totalPages = totals().pages;
    let completed = 0;
    let currentTask = null;
    let currentPdf = null;

    try {
      const pdfjs = await loadPdfJs();
      const format = getFormat();
      const qualityValue = getQuality();
      const extension = format === "jpeg" ? "jpg" : "png";

      for (let fileIndex = 0; fileIndex < state.items.length; fileIndex += 1) {
        const item = state.items[fileIndex];
        currentTask = pdfjs.getDocument(createPdfDocumentOptions(new Uint8Array(await item.file.arrayBuffer()), {
          disableAutoFetch: true,
          disableStream: true
        }));
        currentPdf = await currentTask.promise;
        const base = cleanBaseName(item.file.name);
        try {
          for (let pageNumber = 1; pageNumber <= currentPdf.numPages; pageNumber += 1) {
            const livePercent = ((completed + 0.25) / Math.max(totalPages, 1)) * 100;
            setProgress(livePercent, `Converting page ${completed + 1} of ${totalPages}`);
            setStatus(`Converting PDF ${fileIndex + 1} of ${state.items.length} • page ${pageNumber} of ${currentPdf.numPages}`, "working", true);
            const blob = await renderPageToBlob(currentPdf, pageNumber, format, qualityValue);
            output.push({
              blob,
              name: `${base}-page-${String(pageNumber).padStart(2, "0")}.${extension}`,
              meta: `Page ${pageNumber}`
            });
            completed += 1;
            setProgress((completed / Math.max(totalPages, 1)) * 100, `Converted ${completed} of ${totalPages} pages`);
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } finally {
          try { await currentPdf?.destroy?.(); } catch {}
          try { await currentTask?.destroy?.(); } catch {}
          currentPdf = null;
          currentTask = null;
        }
      }

      state.outputs = output;
      renderResults();
      setProgress(null);
      setPhase("results");
      setStatus("", "", false);
    } catch (error) {
      console.error(error);
      state.outputs = [];
      setProgress(null);
      setPhase("settings");
      setStatus(error?.message || "Conversion could not be completed.", "error", true);
      await showDialog("Conversion failed", error?.message || "Something went wrong while converting the selected PDFs.");
    } finally {
      try { await currentPdf?.destroy?.(); } catch {}
      try { await currentTask?.destroy?.(); } catch {}
      state.busy = false;
      root.dataset.processing = "false";
      updateSummary();
    }
  }

  async function clearAll() {
    if (state.busy || (!state.items.length && !state.outputs.length)) return;
    const confirmed = await getDialogConfirm(
      "Clear all PDFs?",
      "This removes the current list and results. Your original files stay unchanged.",
      "Clear All"
    );
    if (!confirmed) return;
    resetToUpload();
  }

  async function resetForMore() {
    if (state.busy) return;
    const confirmed = await getDialogConfirm(
      "Convert more PDFs?",
      "This clears the current list and results. Your original files stay unchanged.",
      "Convert More"
    );
    if (!confirmed) return;
    resetToUpload();
  }

  function resetToUpload() {
    // Invalidate in-flight thumbnail jobs before releasing object URLs.
    state.thumbnailGeneration += 1;
    // Keep reset deterministic: release browser object URLs first, then clear data and UI.
    revokePreviewUrls();
    revokeOutputUrls();
    state.items = [];
    state.outputs = [];
    input.value = "";
    drop.dataset.active = "false";
    delete drop.dataset.reading;
    list.replaceChildren();
    results.replaceChildren();
    downloadAll.hidden = true;
    if (formatPng) formatPng.checked = true;
    if (quality) quality.value = quality.defaultValue || "92";
    updateQualityUI();
    setProgress(null);
    setPhase("upload");
    setStatus("", "", false);
    root.dataset.processing = "false";
    updateSummary();
  }

  browse.addEventListener("click", () => input.click());
  input.addEventListener("change", event => addFiles(event.target.files));
  ["dragenter", "dragover"].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault();
    if (!state.busy) drop.dataset.active = "true";
  }));
  ["dragleave", "drop"].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault();
    drop.dataset.active = "false";
  }));
  drop.addEventListener("drop", event => {
    if (state.busy) return;
    addFiles(event.dataTransfer?.files || []);
  });
  start.addEventListener("click", startConversion);
  clear.addEventListener("click", clearAll);
  downloadAll.addEventListener("click", downloadAllResults);
  convertMoreButton?.addEventListener("click", resetForMore);
  formatPng?.addEventListener("change", () => { updateQualityUI(); updateSummary(); });
  formatJpg?.addEventListener("change", () => { updateQualityUI(); updateSummary(); });
  quality?.addEventListener("input", updateQualityUI);
  window.addEventListener("pagehide", () => {
    state.destroyed = true;
    revokePreviewUrls();
    revokeOutputUrls();
  }, { once: true });

  root.dataset.processing = "false";
  root.dataset.statusVisible = "false";
  setPhase("upload");
  updateQualityUI();
  updateSummary();

  return { reset: resetToUpload, getFiles: () => state.items.map(item => item.file) };
}
