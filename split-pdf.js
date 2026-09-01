import { loadPdfJs, loadPdfLib, createPdfDocumentOptions } from "../pdf-library-loader.js";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_PAGES = 500;
const MAX_OUTPUT_FILES = 100;
const HARD_MAX_OUTPUT_FILES = 200;
const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

function sanitizeBaseName(value) {
  const cleaned = String(value || "document")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.+$/g, "");
  return (cleaned.replace(/\.pdf$/i, "").slice(0, 100) || "document");
}

function uniqueOutputName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const base = name.replace(/\.pdf$/i, "");
  let n = 2;
  let candidate = `${base}-${n}.pdf`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}.pdf`;
  }
  used.add(candidate);
  return candidate;
}

function getDialog() {
  return window.OrivaDialog || null;
}

async function showError(title, message, items = []) {
  const ui = getDialog();
  if (ui?.error) return ui.error({ title, message, items });
  window.alert(`${title}\n\n${message}`);
}

async function showWarning(title, message) {
  const ui = getDialog();
  if (ui?.warning) return ui.warning({ title, message });
  window.alert(`${title}\n\n${message}`);
}

async function confirmAction(title, message, confirmLabel = "Continue") {
  const ui = getDialog();
  if (ui?.confirm) {
    return !!(await ui.confirm({
      title,
      message,
      confirmLabel,
      cancelLabel: "Cancel"
    }));
  }
  return window.confirm(message);
}

function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

const scriptPromises = new Map();
function loadScript(url, globalName, timeoutMs = 20000) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptPromises.has(globalName)) return scriptPromises.get(globalName);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-oriva-lib="${globalName}"]`);
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
    const script = document.createElement("script");
    script.src = url; script.async = true; script.dataset.orivaLib = globalName;
    script.onload = finish; script.onerror = () => fail("Required download component could not be loaded. Check your connection and try again.");
    timer = setTimeout(() => fail("Required download component could not be loaded in time. Check your connection and try again."), timeoutMs);
    document.head.append(script);
  });
  scriptPromises.set(globalName, promise);
  promise.catch(() => scriptPromises.delete(globalName));
  return promise;
}

function parseRanges(text, maxPage) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { ranges: [], error: "Enter at least one page or range, for example 1-3, 5, 8-10." };
  }

  const parts = raw.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean);
  const ranges = [];

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
    if (!match) {
      return { ranges: [], error: `Invalid page token: "${part}". Use numbers such as 5 or 1-3.` };
    }

    let start = Number.parseInt(match[1], 10);
    let end = match[2] ? Number.parseInt(match[2], 10) : start;

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return { ranges: [], error: "The page number is too large to process safely." };
    }
    if (start < 1 || end < 1) {
      return { ranges: [], error: "Page numbers must be 1 or higher." };
    }
    if (start > end) [start, end] = [end, start];
    if (start > maxPage || end > maxPage) {
      const bad = end > maxPage ? end : start;
      return { ranges: [], error: `Page ${bad} is outside this PDF. Valid pages are 1–${maxPage}.` };
    }

    ranges.push({ start, end });
  }

  return ranges.length ? { ranges } : { ranges: [], error: "Enter at least one valid page range." };
}

function buildGroups(root, source) {
  if (!source) return { groups: [], error: "Upload a PDF first." };

  const mode = root.querySelector('[data-split-mode]:checked')?.value || "ranges";
  const count = source.pages;

  if (mode === "every") {
    return {
      groups: Array.from({ length: count }, (_, index) => ({
        label: `page-${index + 1}`,
        pages: [index + 1]
      }))
    };
  }

  if (mode === "chunk") {
    const input = root.querySelector("[data-chunk-size]");
    const raw = String(input?.value ?? "").trim();
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n) || n < 1) {
      return { groups: [], error: "Chunk size must be a whole number of at least 1." };
    }
    if (n > count) {
      return { groups: [], error: `Chunk size (${n}) is larger than this PDF (${count} pages).` };
    }

    const groups = [];
    for (let start = 1; start <= count; start += n) {
      const end = Math.min(start + n - 1, count);
      groups.push({
        label: `pages-${start}-${end}`,
        pages: Array.from({ length: end - start + 1 }, (_, i) => start + i)
      });
    }
    return { groups };
  }

  const parsed = parseRanges(root.querySelector("[data-page-range]")?.value, count);
  if (parsed.error) return { groups: [], error: parsed.error };

  const single = !!root.querySelector("[data-single-range]")?.checked;
  if (single) {
    const seen = new Set();
    for (const range of parsed.ranges) {
      for (let page = range.start; page <= range.end; page += 1) seen.add(page);
    }
    const pages = [...seen].sort((a, b) => a - b);
    return pages.length
      ? { groups: [{ label: "selected-pages", pages }] }
      : { groups: [], error: "No pages were selected." };
  }

  return {
    groups: parsed.ranges.map(range => ({
      label: range.start === range.end ? `page-${range.start}` : `pages-${range.start}-${range.end}`,
      pages: Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i)
    }))
  };
}

export function initSplitPDFController({ root, input, drop, browse, start, reset, status, list, results, maxFiles = 1, maxBytes = MAX_FILE_SIZE, minFiles = 1 }) {
  const state = {
    file: null,
    pages: 0,
    busy: false,
    outputs: [],
    urls: new Set(),
    zipUrl: null,
    readToken: 0
  };

  const progressWrap = root.querySelector("[data-progress-wrap]");
  const progressFill = root.querySelector("[data-progress-fill]");
  const progressText = root.querySelector("[data-progress-text]");
  const downloadAll = root.querySelector("[data-download-all]");
  const safety = root.querySelector('[data-step="safety"]');
  const actions = root.querySelector('[data-step="actions"]');

  function setPhase(phase) {
    root.dataset.phase = phase;
    const nodes = {
      upload: root.querySelector('[data-step="upload"]'),
      files: root.querySelector('[data-step="files"]'),
      settings: root.querySelector('[data-step="settings"]'),
      safety: root.querySelector('[data-step="safety"]'),
      status: root.querySelector('[data-step="status"]'),
      progress: root.querySelector('[data-progress-wrap]'),
      results: root.querySelector('[data-step="results"]'),
      actions: root.querySelector('[data-step="actions"]')
    };
    const visible = {
      upload: ["upload"],
      settings: ["files", "settings", "safety", "status", "actions"],
      processing: ["status", "progress"],
      results: ["status", "results"]
    };
    Object.entries(nodes).forEach(([key, node]) => {
      if (node) node.hidden = !(visible[phase] || []).includes(key);
    });
  }

  function setStatus(message = "", kind = "", visible = false) {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !visible;
    root.dataset.statusVisible = visible ? "true" : "false";
  }

  function setProgress(percent = null, text = "") {
    if (!progressWrap) return;
    const visible = Number.isFinite(percent);
    progressWrap.hidden = !visible;
    if (!visible) return;
    const safe = Math.max(0, Math.min(100, Number(percent)));
    if (progressFill) progressFill.style.width = `${safe}%`;
    if (progressText) progressText.textContent = text || `${Math.round(safe)}%`;
  }

  function revokeUrls() {
    state.urls.forEach(url => URL.revokeObjectURL(url));
    state.urls.clear();
    if (state.zipUrl) {
      URL.revokeObjectURL(state.zipUrl);
      state.zipUrl = null;
    }
  }

  function clearOutputs() {
    revokeUrls();
    state.outputs = [];
    if (results) results.replaceChildren();
    if (downloadAll) downloadAll.hidden = true;
  }

  function updateModeUI() {
    const mode = root.querySelector('[data-split-mode]:checked')?.value || "ranges";
    root.dataset.currentSplitMode = mode;
    const rangesWrap = root.querySelector("[data-split-ranges-wrap]");
    const chunkWrap = root.querySelector("[data-split-chunk-wrap]");
    if (rangesWrap) rangesWrap.hidden = mode !== "ranges";
    if (chunkWrap) chunkWrap.hidden = mode !== "chunk";
    updateReady();
  }

  function updateReady() {
    if (!start) return;
    const copy = root.querySelector("[data-ready-copy]");

    if (!state.file || !state.pages) {
      start.disabled = true;
      if (copy) copy.textContent = "Upload a PDF to start splitting.";
      return;
    }
    if (state.busy) {
      start.disabled = true;
      return;
    }

    const plan = buildGroups(root, { pages: state.pages });
    if (plan.error) {
      start.disabled = true;
      if (copy) copy.textContent = plan.error;
      return;
    }

    const totalPages = plan.groups.reduce((sum, group) => sum + group.pages.length, 0);
    if (plan.groups.length > HARD_MAX_OUTPUT_FILES) {
      start.disabled = true;
      if (copy) copy.textContent = `This split would create ${plan.groups.length} PDFs. Maximum is ${HARD_MAX_OUTPUT_FILES}.`;
      return;
    }

    if (copy) {
      const single = root.querySelector('[data-split-mode]:checked')?.value === "ranges" &&
        !!root.querySelector("[data-single-range]")?.checked;
      copy.textContent = single
        ? `Ready: 1 output PDF · ${totalPages} selected page${totalPages === 1 ? "" : "s"}.`
        : plan.groups.length === 1
          ? `Ready: 1 output PDF · ${totalPages} page${totalPages === 1 ? "" : "s"}.`
          : `Ready: ${plan.groups.length} output PDFs · ${totalPages} page references.`;
    }
    start.disabled = plan.groups.length < minFiles;
  }

  function renderThumbnail(preview, file, token) {
    loadPdfJs()
      .then(async pdfjs => {
        if (state.file !== file || token !== state.readToken || !preview.isConnected) return;
        const buffer = await file.arrayBuffer();
        const task = pdfjs.getDocument(createPdfDocumentOptions(new Uint8Array(buffer), {
          disableAutoFetch: true,
          disableStream: true
        }));
        const pdf = await task.promise;
        try {
          if (state.file !== file || token !== state.readToken || !preview.isConnected) return;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.28 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          await page.render({
            canvasContext: canvas.getContext("2d", { alpha: false }),
            viewport
          }).promise;
          if (state.file !== file || token !== state.readToken || !preview.isConnected) return;
          const img = document.createElement("img");
          img.alt = "PDF first page preview";
          img.src = canvas.toDataURL("image/jpeg", 0.82);
          preview.replaceChildren(img);
        } finally {
          try { await pdf.destroy?.(); } catch (_) {}
          try { await task.destroy?.(); } catch (_) {}
        }
      })
      .catch(() => {
        // Thumbnail failure is non-fatal; the PDF has already passed validation.
      });
  }

  function renderFile() {
    if (!list) return;
    list.replaceChildren();
    if (!state.file) {
      list.hidden = true;
      return;
    }
    list.hidden = false;

    const row = document.createElement("div");
    row.className = "file-row";

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const preview = document.createElement("div");
    preview.className = "pdf-file-preview";
    preview.textContent = "PDF";
    preview.setAttribute("aria-hidden", "true");

    const text = document.createElement("div");
    text.className = "file-text-meta";

    const name = document.createElement("div");
    name.className = "file-name";
    name.title = state.file.name;
    name.textContent = state.file.name;

    const size = document.createElement("div");
    size.className = "file-size";
    size.textContent = `${state.pages} page${state.pages === 1 ? "" : "s"} · ${formatBytes(state.file.size)}`;

    const tick = document.createElement("span");
    tick.className = "pdf-uploaded-tick";
    tick.textContent = "✓ Uploaded";

    text.append(name, size, tick);
    meta.append(preview, text);

    const controls = document.createElement("div");
    controls.className = "file-controls";

    const replace = document.createElement("button");
    replace.type = "button";
    replace.className = "remove-file pdf-replace-file";
    replace.dataset.sourceAction = "replace";
    replace.textContent = "Replace";
    replace.disabled = false;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-file pdf-remove-file";
    remove.dataset.sourceAction = "remove";
    remove.textContent = "Remove";
    remove.disabled = false;

    controls.append(replace, remove);
    row.append(meta, controls);
    list.append(row);

    renderThumbnail(preview, state.file, state.readToken);
  }

  function resetControls() {
    root.querySelectorAll("input, select, textarea").forEach(control => {
      if (control === input) return;
      if (control.type === "radio" || control.type === "checkbox") {
        control.checked = control.defaultChecked;
      } else {
        control.value = control.defaultValue;
      }
    });
  }

  function resetAll() {
    state.readToken += 1;
    state.file = null;
    state.pages = 0;
    state.busy = false;
    clearOutputs();
    resetControls();
    if (input) input.value = "";
    if (list) list.replaceChildren();
    if (safety) safety.hidden = true;
    if (actions) actions.hidden = true;
    setProgress(null);
    setStatus("", "", false);
    root.dataset.processing = "false";
    if (drop) {
      drop.hidden = false;
      drop.dataset.active = "false";
      drop.dataset.reading = "false";
      drop.setAttribute("aria-disabled", "false");
    }
    if (start) start.disabled = true;
    setPhase("upload");
    updateReady();
  }

  function removeCurrentFile() {
    if (state.busy || !state.file) return;
    resetAll();
  }

  function openReplacePicker() {
    if (state.busy || !input) return;
    // Clearing first is essential when the user chooses the same PDF again.
    // It also guarantees a fresh change event on mobile file pickers.
    input.value = "";
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch (_) {}
    input.click();
  }

  async function clearWithConfirmation() {
    if (state.busy || !state.file) return;
    const ok = await confirmAction(
      "Clear PDF?",
      "This removes the current PDF and any split results. Your original file stays unchanged.",
      "Clear All"
    );
    if (ok) resetAll();
  }

  async function inspectPDF(file) {
    const pdfjs = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const header = new TextDecoder("latin1").decode(buffer.slice(0, Math.min(buffer.byteLength, 1024)));
    if (!header.includes("%PDF-")) throw new Error("This file is not a valid PDF.");

    let pdf = null;
    let task = null;
    try {
      task = pdfjs.getDocument(createPdfDocumentOptions(new Uint8Array(buffer), {
        disableAutoFetch: true,
        disableStream: true
      }));
      pdf = await task.promise;
      const pages = Number(pdf.numPages || 0);
      if (pages < 1) throw new Error("This PDF has no pages.");
      if (pages > MAX_TOTAL_PAGES) throw new Error(`This PDF has ${pages} pages. Maximum allowed is ${MAX_TOTAL_PAGES}.`);
      return pages;
    } catch (error) {
      if (error?.name === "PasswordException" || /password|encrypted/i.test(error?.message || "")) {
        throw new Error("This PDF is password-protected or encrypted. Remove the password and try again.");
      }
      throw error;
    } finally {
      try { await pdf?.destroy?.(); } catch (_) {}
      try { await task?.destroy?.(); } catch (_) {}
    }
  }

  async function addFile(file) {
    if (state.busy || !file) return;

    const typeOk = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!typeOk) {
      await showError("Not a PDF", `"${file.name || "Selected file"}" is not a PDF file.`);
      if (input) input.value = "";
      return;
    }
    if (!file.size) {
      await showError("Empty file", `"${file.name || "Selected file"}" has no content.`);
      if (input) input.value = "";
      return;
    }
    if (file.size > maxBytes) {
      await showError("File too large", `"${file.name}" is ${formatBytes(file.size)}. Maximum allowed is ${formatBytes(maxBytes)}.`);
      if (input) input.value = "";
      return;
    }

    if (state.file) {
      const ok = await confirmAction(
        "Replace current PDF?",
        "Uploading a new PDF will clear the current file and any split results.",
        "Replace PDF"
      );
      if (!ok) {
        if (input) input.value = "";
        return;
      }
    }

    state.busy = true;
    state.readToken += 1;
    const token = state.readToken;
    clearOutputs();
    if (reset) reset.disabled = true;
    if (drop) {
      drop.dataset.reading = "true";
      drop.setAttribute("aria-disabled", "true");
    }
    setPhase("upload");
    setStatus("Reading your PDF…", "working", true);

    try {
      const pages = await inspectPDF(file);
      if (token !== state.readToken) return;
      state.file = file;
      state.pages = pages;
      renderFile();
      // Apply the active split-mode visibility after the source row is mounted.
      // This keeps Page ranges / Chunk size mutually exclusive even when the
      // workflow is restored from a cached page or the picker returns late.
      updateModeUI();
      if (safety) safety.hidden = false;
      if (actions) actions.hidden = false;
      if (drop) drop.hidden = true;
      setPhase("settings");
      setStatus(`${pages} page${pages === 1 ? "" : "s"} detected. Review the split settings, then continue.`, "success", true);
      updateReady();
    } catch (error) {
      if (token === state.readToken) {
        state.file = null;
        state.pages = 0;
        clearOutputs();
        renderFile();
        setPhase("upload");
        setStatus("", "", false);
        await showError("Could not read PDF", error?.message || "Please try another PDF file.");
      }
    } finally {
      if (token === state.readToken) state.busy = false;
      if (reset) reset.disabled = false;
      if (drop) {
        drop.dataset.reading = "false";
        drop.setAttribute("aria-disabled", "false");
      }
      if (input) input.value = "";
      // renderFile() may have been called while validation was still busy.
      // Re-render once the read lifecycle is complete so Replace/Remove are
      // actual enabled controls, not stale disabled DOM nodes.
      if (token === state.readToken && state.file) renderFile();
      updateModeUI();
      updateReady();
    }
  }

  function setProcessing(on) {
    state.busy = !!on;
    root.dataset.processing = state.busy ? "true" : "false";
    if (drop) drop.setAttribute("aria-disabled", String(state.busy));
    if (start) start.disabled = state.busy || !state.file;
    if (reset) reset.disabled = state.busy;
    list?.querySelectorAll("button").forEach(button => { button.disabled = state.busy; });
  }

  async function startSplit() {
    if (state.busy || !state.file) return;

    const plan = buildGroups(root, { pages: state.pages });
    if (plan.error) {
      await showError("Cannot split", plan.error);
      updateReady();
      return;
    }

    const groups = plan.groups;
    if (!groups.length) {
      await showError("Cannot split", "No pages were selected.");
      return;
    }
    if (groups.length > HARD_MAX_OUTPUT_FILES) {
      await showError("Too many output files", `This split would create ${groups.length} PDFs. The maximum is ${HARD_MAX_OUTPUT_FILES}. Use page ranges or a larger chunk size.`);
      return;
    }
    if (groups.length >= 50) {
      const ok = await confirmAction(
        groups.length > MAX_OUTPUT_FILES ? "Many output files" : "Large split job",
        groups.length > MAX_OUTPUT_FILES
          ? `This will create ${groups.length} PDFs. Large batches may take longer and use more browser memory. Continue?`
          : `Creating ${groups.length} PDF files may take a while and use additional browser resources. Continue?`,
        "Continue"
      );
      if (!ok) return;
    }

    clearOutputs();
    setProcessing(true);
    setPhase("processing");
    if (drop) drop.hidden = true;
    if (safety) safety.hidden = true;
    if (actions) actions.hidden = true;
    if (list) list.hidden = true;
    setProgress(2, "Loading PDF…");
    setStatus("Preparing your document…", "working", true);

    try {
      const { PDFDocument } = await loadPdfLib();
      if (!PDFDocument) throw new Error("PDF toolkit could not be loaded. Check your connection and reload the page.");

      const bytes = new Uint8Array(await state.file.arrayBuffer());
      setProgress(8, "Preparing pages…");
      await yieldToUI();

      let srcDoc;
      try {
        srcDoc = await PDFDocument.load(bytes);
      } catch (error) {
        if (/encrypt|password/i.test(error?.message || "")) {
          throw new Error("This PDF is password-protected or encrypted. Remove the password and try again.");
        }
        throw error;
      }

      if (srcDoc.isEncrypted) {
        await showWarning(
          "Encrypted PDF",
          "This PDF is marked as encrypted. The browser may not be able to preserve every protected feature while creating the split files."
        );
      }

      const base = sanitizeBaseName(state.file.name);
      const usedNames = new Set();
      const created = [];

      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const percent = 10 + Math.round(((index + 1) / groups.length) * 82);
        setProgress(percent, `Building file ${index + 1} of ${groups.length}…`);
        setStatus(`Splitting PDF · ${index + 1} of ${groups.length}`, "working", true);
        await yieldToUI();

        const outDoc = await PDFDocument.create();
        const copiedPages = await outDoc.copyPages(srcDoc, group.pages.map(page => page - 1));
        copiedPages.forEach(page => outDoc.addPage(page));
        const outputBytes = await outDoc.save();
        const blob = new Blob([outputBytes], { type: "application/pdf" });
        const name = uniqueOutputName(`${base}-${group.label}.pdf`, usedNames);
        const url = URL.createObjectURL(blob);
        state.urls.add(url);
        created.push({ name, blob, url, pages: group.pages.length });
      }

      state.outputs = created;
      setProgress(95, "Preparing downloads…");
      setStatus("Preparing downloads…", "working", true);
      await yieldToUI();

      if (created.length > 1) {
        const JSZip = await loadScript(JSZIP_URL, "JSZip");
        const zip = new JSZip();
        created.forEach(item => zip.file(item.name, item.blob));
        const zipBlob = await zip.generateAsync(
          { type: "blob", compression: "DEFLATE" },
          meta => setProgress(95 + Math.round((meta.percent / 100) * 4), "Preparing ZIP download…")
        );
        state.zipUrl = URL.createObjectURL(zipBlob);
      }

      renderResults();
      setProgress(100, "Split complete");
      setPhase("results");
      if (actions) actions.hidden = true;
      setStatus(`${created.length} result${created.length === 1 ? " is" : "s are"} ready to download.`, "success", true);
    } catch (error) {
      console.error("[Oriva Split PDF]", error);
      clearOutputs();
      setPhase("settings");
      if (safety) safety.hidden = false;
      if (actions) actions.hidden = false;
      if (list) list.hidden = false;
      setProgress(null);
      setStatus(error?.message || "The PDF could not be split. Please try again.", "error", true);
      await showError("Unable to split PDF", error?.message || "The PDF could not be split. Please try again.");
    } finally {
      setProcessing(false);
      if (progressWrap && root.dataset.phase === "results") progressWrap.hidden = true;
      updateReady();
    }
  }

  function renderResults() {
    if (!results) return;
    results.replaceChildren();

    const shell = document.createElement("section");
    shell.className = "split-results-card";

    const head = document.createElement("div");
    head.className = "split-results-head";
    const title = document.createElement("h2");
    title.textContent = "Split Ready";
    const summary = document.createElement("p");
    summary.textContent = state.outputs.length === 1
      ? `${state.outputs[0].name} is ready.`
      : `${state.outputs.length} PDF files are ready.`;
    head.append(title, summary);

    const stats = document.createElement("div");
    stats.className = "pdf-result-stats";
    const totalPages = state.outputs.reduce((sum, item) => sum + item.pages, 0);
    const totalSize = state.outputs.reduce((sum, item) => sum + item.blob.size, 0);
    [["FILES", state.outputs.length], ["PAGES", totalPages], ["SIZE", formatBytes(totalSize)]].forEach(([label, value]) => {
      const cell = document.createElement("div");
      const small = document.createElement("span");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = String(value);
      cell.append(small, strong);
      stats.append(cell);
    });

    const listWrap = document.createElement("div");
    listWrap.className = "pdf-file-queue split-result-list";
    listWrap.setAttribute("aria-live", "polite");

    state.outputs.forEach(item => {
      const row = document.createElement("div");
      row.className = "pdf-file-row";
      const main = document.createElement("div");
      main.className = "pdf-file-main";
      const icon = document.createElement("div");
      icon.className = "pdf-file-icon";
      icon.textContent = "📄";
      icon.setAttribute("aria-hidden", "true");
      const copy = document.createElement("div");
      copy.className = "pdf-file-copy";
      const name = document.createElement("strong");
      name.textContent = item.name;
      name.title = item.name;
      const meta = document.createElement("span");
      meta.textContent = `${item.pages} page${item.pages === 1 ? "" : "s"} · ${formatBytes(item.blob.size)}`;
      copy.append(name, meta);
      main.append(icon, copy);

      const controls = document.createElement("div");
      controls.className = "pdf-file-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pdf-row-btn pdf-row-btn-text";
      button.textContent = "Download";
      button.addEventListener("click", () => downloadBlob(item.url, item.name));
      controls.append(button);
      row.append(main, controls);
      listWrap.append(row);
    });

    const resultActions = document.createElement("div");
    resultActions.className = "result-actions split-result-actions";

    const another = document.createElement("button");
    another.type = "button";
    another.className = "action-btn outline";
    another.textContent = "↺ Split Another";
    another.addEventListener("click", async () => {
      if (state.busy) return;
      const ok = await confirmAction(
        "Split another PDF?",
        "This clears the current PDF and split results. Your original file stays unchanged.",
        "Clear All"
      );
      if (ok) {
        resetAll();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    resultActions.append(another);
    if (state.outputs.length > 1 && state.zipUrl) {
      const zip = document.createElement("button");
      zip.type = "button";
      zip.className = "action-btn";
      zip.textContent = "Download All as ZIP";
      zip.addEventListener("click", () => downloadBlob(state.zipUrl, `${sanitizeBaseName(state.file?.name || "document")}-split.zip`));
      resultActions.append(zip);
    }
    shell.append(head, stats, listWrap, resultActions);
    results.append(shell);
    results.hidden = false;
    if (downloadAll) downloadAll.hidden = true;
  }

  function downloadBlob(url, filename) {
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  function handleInputFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.length > maxFiles) {
      showError("Too many files", `This tool accepts only ${maxFiles} PDF at a time.`);
      if (input) input.value = "";
      return;
    }
    addFile(files[0]);
  }

  browse?.addEventListener("click", event => {
    event.stopPropagation();
    if (!state.busy) input?.click();
  });

  drop?.addEventListener("click", () => {
    if (!state.busy) input?.click();
  });

  drop?.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && !state.busy) {
      event.preventDefault();
      input?.click();
    }
  });

  ["dragenter", "dragover"].forEach(type => drop?.addEventListener(type, event => {
    event.preventDefault();
    if (!state.busy) drop.dataset.active = "true";
  }));

  ["dragleave", "drop"].forEach(type => drop?.addEventListener(type, event => {
    event.preventDefault();
    drop.dataset.active = "false";
  }));

  drop?.addEventListener("drop", event => {
    if (state.busy) return;
    handleInputFiles(event.dataTransfer?.files);
  });

  input?.addEventListener("change", event => {
    const files = event.target.files;
    handleInputFiles(files);
    event.target.value = "";
  });

  reset?.addEventListener("click", clearWithConfirmation);

  // Delegate source actions from the stable list container because the source row
  // is recreated whenever the workflow state changes. Capture the event so no
  // outer workspace handler can swallow a mobile tap.
  list?.addEventListener("click", event => {
    const button = event.target.closest("button[data-source-action]");
    if (!button || !list.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.busy) return;
    if (button.dataset.sourceAction === "replace") openReplacePicker();
    else if (button.dataset.sourceAction === "remove") removeCurrentFile();
  }, true);

  start?.addEventListener("click", startSplit);

  root.querySelectorAll("[data-split-mode]").forEach(control => control.addEventListener("change", updateModeUI));
  root.querySelector("[data-page-range]")?.addEventListener("input", updateReady);
  root.querySelector("[data-chunk-size]")?.addEventListener("input", updateReady);
  root.querySelector("[data-single-range]")?.addEventListener("change", updateReady);

  window.addEventListener("beforeunload", event => {
    if (state.busy) {
      event.preventDefault();
      event.returnValue = "";
    }
    revokeUrls();
  });

  if (progressWrap) progressWrap.hidden = true;
  if (results) results.hidden = true;
  if (safety) safety.hidden = true;
  if (actions) actions.hidden = true;
  root.dataset.phase = "upload";
  root.dataset.processing = "false";
  root.dataset.statusVisible = "false";
  updateModeUI();

  return {
    reset: resetAll,
    getState: () => ({
      file: state.file,
      pages: state.pages,
      busy: state.busy,
      outputs: [...state.outputs]
    })
  };
}
