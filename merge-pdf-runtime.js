// OrivaStudio v23 Merge PDF runtime — v76 minimum-file gating and full lifecycle parity.
import { loadPdfLib, loadPdfJs, createPdfDocumentOptions } from "./pdf-library-loader.js";

const LIMITS = Object.freeze({
  minFiles: 2,
  maxFiles: 20,
  maxFileSize: 100 * 1024 * 1024,
  maxTotalSize: 250 * 1024 * 1024,
  maxTotalPages: 500,
  largeFileSize: 75 * 1024 * 1024,
  largeBatchSize: 150 * 1024 * 1024,
  largePageCount: 300
});

const PHASE = Object.freeze({ UPLOAD: "upload", COLLECTING: "collecting", REVIEW: "review", PROCESSING: "processing", RESULTS: "results" });

const frame = () => new Promise(resolve => setTimeout(resolve, 0));
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / (1024 ** index);
  return `${scaled >= 10 || index === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${units[index]}`;
}

function isPdf(file) {
  return Boolean(file) && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""));
}

function sanitizeOutputName(value) {
  const raw = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.+$/g, "");
  const base = (raw.replace(/\.pdf$/i, "") || "merged-document").slice(0, 116);
  return `${base}.pdf`;
}

function dialogCall(kind, title, message, items = []) {
  const api = window.OrivaDialog;
  if (api?.[kind]) return api[kind]({ title, message, items, confirmText: kind === "warning" ? "Got it" : "OK" });
  if (api?.show) return api.show({ title, message, items, confirmText: "OK", variant: kind });
  window.alert(`${title}\n\n${message}${items.length ? `\n\n${items.join("\n")}` : ""}`);
  return Promise.resolve(true);
}

function askConfirm(title, message, confirmText = "Continue") {
  if (window.OrivaDialog?.confirm) return window.OrivaDialog.confirm({ title, message, confirmText, cancelText: "Cancel" });
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

async function inspectPdf(file) {
  const bytes = await file.arrayBuffer();
  const header = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.byteLength, 1024)));
  if (!header.includes("%PDF-")) throw new Error("This file is not a valid PDF.");

  const pdfjs = await loadPdfJs();
  let task = null;
  let pdf = null;
  let thumbUrl = "";
  try {
    task = pdfjs.getDocument(createPdfDocumentOptions(new Uint8Array(bytes), {
      disableAutoFetch: true,
      disableStream: true
    }));
    pdf = await task.promise;
    const pages = pdf.numPages;
    if (!Number.isFinite(pages) || pages < 1) throw new Error("This PDF has no pages.");

    try {
      const page = await pdf.getPage(1);
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min(108 / Math.max(natural.height || 1, 1), 0.42);
      const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      if (context) {
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.76));
        if (blob) thumbUrl = URL.createObjectURL(blob);
      }
      try { page.cleanup?.(); } catch (_) {}
      canvas.width = 0;
      canvas.height = 0;
    } catch (_) {
      thumbUrl = "";
    }
    return { pages, thumbUrl };
  } catch (error) {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    if (error?.name === "PasswordException") throw new Error("Password-protected PDFs are not supported.");
    if (error?.name === "InvalidPDFException") throw new Error("This file is not a valid or readable PDF.");
    if (error?.message === "This PDF has no pages.") throw error;
    throw new Error(error?.message || "Unable to read this PDF.");
  } finally {
    try { await pdf?.destroy?.(); } catch (_) {}
    try { await task?.destroy?.(); } catch (_) {}
  }
}

export function initMergePdfRuntime(root) {
  if (!root || root.dataset.mergeRuntimeInitialized === "true") return null;

  const ui = {
    input: root.querySelector("[data-pdf-input]"),
    drop: root.querySelector("[data-drop-zone]"),
    browse: root.querySelector("[data-browse]"),
    list: root.querySelector("[data-file-list]"),
    start: root.querySelector("[data-start]"),
    clear: root.querySelector("[data-reset]"),
    inlineClear: root.querySelector("[data-reset-inline]"),
    status: root.querySelector("[data-tool-status]"),
    progress: root.querySelector("[data-progress-wrap]"),
    progressFill: root.querySelector("[data-progress-fill]"),
    progressText: root.querySelector("[data-progress-text]"),
    results: root.querySelector("[data-result-list]"),
    totalFiles: root.querySelector("[data-merge-total-files]"),
    totalSize: root.querySelector("[data-merge-total-size]"),
    totalPages: root.querySelector("[data-merge-total-pages]"),
    capacity: root.querySelector("[data-merge-capacity]"),
    ready: root.querySelector("[data-merge-ready]"),
    outputName: root.querySelector("[data-output-name]"),
    actionCard: root.querySelector('.merge-action-card[data-step="actions"]')
  };

  // v25 structural ownership: the editable Clear All / Merge PDFs surface is
  // physically mounted only during REVIEW. Hiding it with CSS/hidden was not
  // sufficient because legacy responsive workflow selectors used display:*!important
  // and could resurrect the card after RESULTS. Detaching the node removes it
  // from every selector/cascade path while preserving its listeners and state.
  const actionCardAnchor = ui.actionCard ? document.createComment('merge-action-card-anchor') : null;
  const actionCardParent = ui.actionCard?.parentNode || null;
  if (ui.actionCard && actionCardAnchor) {
    actionCardParent.insertBefore(actionCardAnchor, ui.actionCard);
  }

  function mountActionCard() {
    if (!ui.actionCard || !actionCardParent || !actionCardAnchor) return;
    if (ui.actionCard.parentNode !== actionCardParent) {
      actionCardParent.insertBefore(ui.actionCard, actionCardAnchor.nextSibling);
    }
    ui.actionCard.hidden = false;
  }

  function unmountActionCard() {
    if (!ui.actionCard) return;
    ui.actionCard.hidden = true;
    if (ui.actionCard.parentNode) ui.actionCard.remove();
  }

  if (Object.values(ui).some(value => !value)) return null;
  root.dataset.mergeRuntimeInitialized = "true";

  const state = {
    items: [],
    phase: PHASE.UPLOAD,
    busy: false,
    adding: false,
    addChain: Promise.resolve(),
    session: 0,
    dragId: null,
    touchDrag: null,
    warningDismissed: false,
    outputBlob: null,
    outputUrl: null,
    outputName: "merged-document.pdf"
  };

  function totals() {
    return state.items.reduce((sum, item) => ({ size: sum.size + item.file.size, pages: sum.pages + item.pages }), { size: 0, pages: 0 });
  }

  function revokeItemPreview(item) {
    if (item?.thumbUrl) {
      try { URL.revokeObjectURL(item.thumbUrl); } catch (_) {}
      item.thumbUrl = "";
    }
  }

  function revokeOutput() {
    if (state.outputUrl) {
      try { URL.revokeObjectURL(state.outputUrl); } catch (_) {}
    }
    state.outputUrl = null;
    state.outputBlob = null;
    state.outputName = "merged-document.pdf";
  }

  function setStatus(message = "", kind = "", visible = false) {
    const shouldShow = Boolean(visible && message);
    ui.status.textContent = shouldShow ? message : "";
    ui.status.dataset.kind = shouldShow ? kind : "";
    root.dataset.statusVisible = shouldShow ? "true" : "false";
    ui.status.hidden = !shouldShow;
  }

  // Upload milestones use the same modal system as v76 errors/confirmations so the
  // user gets an explicit acknowledgement without creating duplicate inline notices.
  async function showUploadMilestone(previousCount, addedCount) {
    const count = state.items.length;
    if (!addedCount || count <= previousCount) return;
    if (previousCount < LIMITS.minFiles && count === 1) {
      await dialogCall(
        "success",
        "1 PDF added",
        "Your PDF has been added successfully. Add at least 1 more PDF to enable merging."
      );
      return;
    }
    if (previousCount < LIMITS.minFiles && count >= LIMITS.minFiles) {
      await dialogCall(
        "success",
        "Ready to merge",
        `${count} PDFs are ready. Review the order and output name, then merge them.`
      );
    }
  }

  function setProgress(percent = null, text = "") {
    const visible = Number.isFinite(percent);
    ui.progress.hidden = !visible;
    if (!visible) {
      ui.progressFill.style.width = "0%";
      ui.progressText.textContent = "";
      return;
    }
    const safe = Math.max(0, Math.min(100, Math.round(percent)));
    ui.progressFill.style.width = `${safe}%`;
    ui.progressText.textContent = text || `${safe}%`;
  }

  function setPhase(next) {
    const phase = Object.values(PHASE).includes(next) ? next : PHASE.UPLOAD;
    state.phase = phase;
    root.dataset.phase = phase;
    root.dataset.workflow = phase;

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
    const show = (...names) => names.forEach(name => steps[name]?.forEach(node => { node.hidden = false; }));
    const hide = (...names) => names.forEach(name => steps[name]?.forEach(node => { node.hidden = true; }));

    // Reset every workflow surface first. Individual phases then opt in to the
    // exact nodes they own. This prevents shared [data-step="status"] and
    // [data-step="actions"] selectors from leaking empty cards between phases.
    hide('upload', 'files', 'settings', 'safety', 'status', 'progress', 'results', 'actions');

    // The editable Clear All / Merge PDFs card belongs ONLY to REVIEW. v25 uses
    // structural ownership instead of visual hiding: outside REVIEW the node is
    // removed from the workspace DOM, so no legacy CSS selector can resurrect it.
    if (phase === PHASE.REVIEW) mountActionCard();
    else unmountActionCard();
    root.classList.toggle('merge-actions-active', phase === PHASE.REVIEW);

    if (phase === PHASE.UPLOAD) {
      show('upload');
    } else if (phase === PHASE.COLLECTING) {
      // Exactly one valid PDF: keep the queue and upload/settings surfaces, but
      // show only the dedicated minimum-file guidance. The generic tool-status
      // node stays hidden so it cannot render as an empty bordered card.
      show('upload', 'files', 'settings', 'safety');
      ui.ready.hidden = false;
      ui.status.hidden = true;
    } else if (phase === PHASE.REVIEW) {
      show('upload', 'files', 'settings', 'safety', 'status', 'actions');
    } else if (phase === PHASE.PROCESSING) {
      show('status', 'progress');
    } else if (phase === PHASE.RESULTS) {
      show('results');
    }
  }

  function phaseForItems() {
    if (!state.items.length) return PHASE.UPLOAD;
    return state.items.length < LIMITS.minFiles ? PHASE.COLLECTING : PHASE.REVIEW;
  }

  function updateSummary() {
    const count = state.items.length;
    const { size, pages } = totals();
    const filesLeft = Math.max(0, LIMITS.maxFiles - count);
    const sizeLeft = Math.max(0, LIMITS.maxTotalSize - size);
    const pagesLeft = Math.max(0, LIMITS.maxTotalPages - pages);

    ui.totalFiles.textContent = String(count);
    ui.totalSize.textContent = formatBytes(size);
    ui.totalPages.textContent = String(pages);
    ui.capacity.textContent = `${filesLeft} PDF slot${filesLeft === 1 ? "" : "s"} · ${formatBytes(sizeLeft)} · ${pagesLeft} pages remaining`;
    ui.ready.textContent = count === 0
      ? "Add at least 2 PDFs to merge."
      : count === 1
        ? "1 PDF selected. Add at least 1 more PDF to enable merging."
        : `${count} PDFs ready to merge in the order shown.`;

    ui.start.disabled = state.busy || state.adding || count < LIMITS.minFiles;
    ui.clear.disabled = state.busy || (!count && !state.outputBlob);
    if (ui.inlineClear) ui.inlineClear.hidden = count !== 1 || state.busy || state.adding;
    ui.browse.disabled = state.busy || state.adding;
    ui.drop.dataset.disabled = String(state.busy || state.adding);
  }

  function invalidateResult() {
    revokeOutput();
    ui.results.replaceChildren();
  }

  function moveItem(id, direction) {
    if (state.busy || state.adding) return;
    const from = state.items.findIndex(item => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= state.items.length) return;
    [state.items[from], state.items[to]] = [state.items[to], state.items[from]];
    invalidateResult();
    renderFiles();
    setPhase(phaseForItems());
    if (state.items.length < LIMITS.minFiles) setStatus("", "", false);
    else setStatus("Merge order updated. Review the list, then continue.", "success", true);
  }

  function moveItemBefore(id, targetId) {
    if (state.busy || state.adding || !id || !targetId || id === targetId) return;
    const from = state.items.findIndex(item => item.id === id);
    const to = state.items.findIndex(item => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = state.items.splice(from, 1);
    state.items.splice(to, 0, item);
    invalidateResult();
    renderFiles();
    setPhase(phaseForItems());
    if (state.items.length < LIMITS.minFiles) setStatus("", "", false);
    else setStatus("Merge order updated. Review the list, then continue.", "success", true);
  }

  function removeItem(id) {
    if (state.busy || state.adding) return;
    const index = state.items.findIndex(item => item.id === id);
    if (index < 0) return;
    const [removed] = state.items.splice(index, 1);
    revokeItemPreview(removed);
    state.warningDismissed = false;
    invalidateResult();
    renderFiles();
    if (!state.items.length) {
      setStatus("", "", false);
      setPhase(PHASE.UPLOAD);
    } else {
      setPhase(phaseForItems());
      if (state.items.length < LIMITS.minFiles) setStatus("", "", false);
      else setStatus("PDF removed. Review the remaining files, then continue.", "success", true);
    }
  }

  function renderFiles() {
    ui.list.replaceChildren();
    ui.list.hidden = state.items.length === 0;
    if (!state.items.length) {
      updateSummary();
      return;
    }

    state.items.forEach((item, index) => {
      const row = document.createElement("article");
      row.className = "file-row merge-file-row";
      row.dataset.id = item.id;
      row.draggable = !state.busy && !state.adding;

      const order = document.createElement("span");
      order.className = "merge-order-badge";
      order.textContent = String(index + 1).padStart(2, "0");

      const meta = document.createElement("div");
      meta.className = "file-meta";
      const preview = document.createElement("div");
      preview.className = "pdf-file-preview";
      if (item.thumbUrl) {
        const image = document.createElement("img");
        image.alt = "";
        image.src = item.thumbUrl;
        preview.append(image);
      } else {
        preview.textContent = "PDF";
      }
      const text = document.createElement("div");
      text.className = "file-text-meta";
      const name = document.createElement("div");
      name.className = "file-name";
      name.title = item.file.name;
      name.textContent = item.file.name;
      const details = document.createElement("div");
      details.className = "file-size";
      details.textContent = `${formatBytes(item.file.size)} · ${item.pages} page${item.pages === 1 ? "" : "s"}`;
      text.append(name, details);
      meta.append(preview, text);

      const controls = document.createElement("div");
      controls.className = "file-controls merge-file-controls";
      const uploaded = document.createElement("span");
      uploaded.className = "merge-uploaded-tick";
      uploaded.title = "Ready";
      uploaded.textContent = "✓";

      const up = document.createElement("button");
      up.type = "button"; up.className = "icon-btn"; up.textContent = "↑";
      up.setAttribute("aria-label", "Move PDF up"); up.disabled = state.busy || state.adding || index === 0;
      up.addEventListener("click", () => moveItem(item.id, -1));

      const down = document.createElement("button");
      down.type = "button"; down.className = "icon-btn"; down.textContent = "↓";
      down.setAttribute("aria-label", "Move PDF down"); down.disabled = state.busy || state.adding || index === state.items.length - 1;
      down.addEventListener("click", () => moveItem(item.id, 1));

      const remove = document.createElement("button");
      remove.type = "button"; remove.className = "remove-file"; remove.textContent = "Remove";
      remove.disabled = state.busy || state.adding;
      remove.addEventListener("click", () => removeItem(item.id));

      const handle = document.createElement("button");
      handle.type = "button"; handle.className = "merge-drag-handle"; handle.textContent = "⋮⋮";
      handle.title = "Drag to reorder"; handle.setAttribute("aria-label", "Drag to reorder");
      handle.disabled = state.busy || state.adding;

      controls.append(uploaded, up, down, remove, handle);
      row.append(order, meta, controls);

      row.addEventListener("dragstart", event => {
        if (state.busy || state.adding || !event.target.closest(".merge-drag-handle")) { event.preventDefault(); return; }
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
        if (state.busy || state.adding || !state.dragId || state.dragId === item.id) return;
        event.preventDefault();
        row.dataset.dragOver = "true";
      });
      row.addEventListener("dragleave", () => delete row.dataset.dragOver);
      row.addEventListener("drop", event => {
        if (state.busy || state.adding) return;
        event.preventDefault();
        delete row.dataset.dragOver;
        moveItemBefore(state.dragId || event.dataTransfer.getData("text/plain"), item.id);
        state.dragId = null;
      });

      // Touch drag is handled centrally below so a re-render during reordering
      // cannot detach the active pointer handler mid-gesture.

      ui.list.append(row);
    });
    updateSummary();
  }

  function warningReasons() {
    const { size, pages } = totals();
    const largeFiles = state.items.filter(item => item.file.size >= LIMITS.largeFileSize);
    const reasons = [];
    if (largeFiles.length) {
      const largest = Math.max(...largeFiles.map(item => item.file.size));
      reasons.push(`${largeFiles.length} large PDF${largeFiles.length === 1 ? "" : "s"} selected (largest ${formatBytes(largest)}).`);
    }
    if (size >= LIMITS.largeBatchSize) reasons.push(`Batch size is ${formatBytes(size)}.`);
    if (pages >= LIMITS.largePageCount) reasons.push(`${pages} pages are queued.`);
    return reasons;
  }

  async function maybeShowLargeWarning() {
    if (state.warningDismissed || state.phase !== PHASE.REVIEW) return;
    const reasons = warningReasons();
    if (!reasons.length) return;
    state.warningDismissed = true;
    await dialogCall("warning", reasons.some(text => text.includes("large PDF")) ? "Large PDF Files Detected" : "Large PDF Batch Detected", "Merging can still continue, but very large files may take longer or require more browser resources.", reasons);
  }

  function enterReview(message = "", warn = true) {
    invalidateResult();
    renderFiles();
    const nextPhase = phaseForItems();
    setPhase(nextPhase);

    // Exactly one valid PDF is a collecting state, not an error and not a second
    // persistent notification. The guidance is already shown by data-merge-ready.
    if (nextPhase === PHASE.COLLECTING) {
      setStatus("", "", false);
    } else {
      setStatus(message || `${state.items.length} PDFs ready. Review the order and settings, then continue.`, "success", Boolean(message));
    }
    updateSummary();
    if (warn && nextPhase === PHASE.REVIEW) void maybeShowLargeWarning();
  }

  async function addFilesInternal(fileList, session) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length || state.busy || session !== state.session) return;

    state.adding = true;
    ui.drop.dataset.reading = "true";
    updateSummary();

    const rejected = [];
    const staged = [];
    let stagedSize = 0;
    let stagedPages = 0;

    try {
      await loadPdfJs();
      for (const file of incoming) {
        if (session !== state.session || state.busy) break;
        const currentCount = state.items.length + staged.length;
        const current = totals();

        if (currentCount >= LIMITS.maxFiles) { rejected.push(`${file.name}: maximum ${LIMITS.maxFiles} PDFs allowed.`); continue; }
        if (!isPdf(file)) { rejected.push(`${file.name}: only PDF files are supported.`); continue; }
        if (!file.size) { rejected.push(`${file.name}: this file is empty.`); continue; }
        if (file.size > LIMITS.maxFileSize) { rejected.push(`${file.name}: file is larger than 100 MB.`); continue; }
        if (state.items.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified) || staged.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
          rejected.push(`${file.name}: already in the merge list.`); continue;
        }
        if (current.size + stagedSize + file.size > LIMITS.maxTotalSize) { rejected.push(`${file.name}: total batch limit of 250 MB would be exceeded.`); continue; }

        try {
          const inspected = await inspectPdf(file);
          if (session !== state.session || state.busy) {
            if (inspected.thumbUrl) URL.revokeObjectURL(inspected.thumbUrl);
            break;
          }
          if (current.pages + stagedPages + inspected.pages > LIMITS.maxTotalPages) {
            if (inspected.thumbUrl) URL.revokeObjectURL(inspected.thumbUrl);
            rejected.push(`${file.name}: total page limit of 500 pages would be exceeded.`);
            continue;
          }
          staged.push({ id: uid(), file, pages: inspected.pages, thumbUrl: inspected.thumbUrl || "" });
          stagedSize += file.size;
          stagedPages += inspected.pages;
          await frame();
        } catch (error) {
          rejected.push(`${file.name}: ${error?.message || "unable to validate this PDF."}`);
        }
      }
    } catch (error) {
      if (session === state.session) rejected.push(error?.message || "PDF reader could not be initialized.");
    } finally {
      if (session === state.session) {
        state.adding = false;
        delete ui.drop.dataset.reading;
        ui.input.value = "";
      }
    }

    if (session !== state.session) {
      staged.forEach(revokeItemPreview);
      return;
    }

    const previousCount = state.items.length;
    if (staged.length) {
      state.items.push(...staged);
      state.warningDismissed = false;
      const addedMessage = state.items.length >= LIMITS.minFiles
        ? `${staged.length} PDF${staged.length === 1 ? "" : "s"} added. Review the order and settings, then continue.`
        : "";
      enterReview(addedMessage, false);
    } else if (!state.items.length) {
      renderFiles();
      setStatus("", "", false);
      setPhase(PHASE.UPLOAD);
    } else {
      renderFiles();
      setPhase(phaseForItems());
    }

    if (rejected.length) {
      const title = rejected.length === 1 ? "File could not be added" : "Some files could not be added";
      const message = rejected.length === 1 ? "This file was skipped." : `${rejected.length} files were skipped.`;
      await dialogCall("error", title, message, rejected.slice(0, 12));
    }
    if (staged.length) await showUploadMilestone(previousCount, staged.length);
    if (state.items.length) await maybeShowLargeWarning();
  }

  function addFiles(fileList) {
    const snapshot = Array.from(fileList || []);
    if (!snapshot.length || state.busy) return;
    const session = state.session;
    state.addChain = state.addChain
      .then(() => addFilesInternal(snapshot, session))
      .catch(async error => {
        if (session !== state.session) return;
        console.error(error);
        state.adding = false;
        delete ui.drop.dataset.reading;
        await dialogCall("error", "Upload failed", error?.message || "Could not add the selected PDFs.");
      });
  }

  function resetToUpload() {
    if (state.busy) return;
    state.session += 1;
    state.items.forEach(revokeItemPreview);
    state.items = [];
    state.adding = false;
    state.dragId = null;
    state.touchDrag = null;
    state.warningDismissed = false;
    revokeOutput();
    ui.results.replaceChildren();
    ui.input.value = "";
    ui.outputName.value = "merged-document.pdf";
    delete ui.drop.dataset.reading;
    setStatus("", "", false);
    setProgress(null);
    renderFiles();
    setPhase(PHASE.UPLOAD);
  }

  async function clearAll() {
    if (state.busy || (!state.items.length && !state.outputBlob)) return;
    const confirmed = await askConfirm("Clear all PDFs?", "This removes the current PDF list and merged result. Your original files stay unchanged.", "Clear All");
    if (confirmed) resetToUpload();
  }

  async function mergeMore() {
    if (state.busy) return;
    const confirmed = await askConfirm("Start a new merge?", "This clears the current list and result. Your original files stay unchanged.", "Start New");
    if (!confirmed) return;
    resetToUpload();
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function processMerge() {
    if (state.busy || state.adding) return;
    if (state.items.length < LIMITS.minFiles) {
      await dialogCall("error", "Cannot merge yet", "Add at least 2 PDF files before merging.");
      return;
    }

    const snapshot = state.items.map(item => ({ ...item }));
    const outputName = sanitizeOutputName(ui.outputName.value);
    ui.outputName.value = outputName;
    state.busy = true;
    root.dataset.processing = "true";
    const processingManager = window.AuraProcessingManager;
    let processingOperationId = null;
    if (processingManager) {
      const started = processingManager.start("pdf-merge");
      if (!started?.ok) {
        state.busy = false;
        root.dataset.processing = "false";
        updateSummary();
        await dialogCall("error", "Another task is processing", "Please wait for the current file operation to finish, then try again.");
        return;
      }
      processingOperationId = started.operationId;
    } else {
      window.__auraProcessing = true;
    }
    setStatus("Merging your PDF files…", "working", true);
    setProgress(3, "Preparing PDF files…");
    setPhase(PHASE.PROCESSING);
    updateSummary();

    try {
      const { PDFDocument } = await loadPdfLib();
      const merged = await PDFDocument.create();
      merged.setTitle?.(outputName.replace(/\.pdf$/i, ""));
      merged.setProducer?.("Oriva Studio");
      merged.setCreator?.("Oriva Studio PDF Merge");
      let mergedPages = 0;

      for (let index = 0; index < snapshot.length; index += 1) {
        const item = snapshot[index];
        setProgress(7 + (index / snapshot.length) * 84, `Reading document ${index + 1} of ${snapshot.length}: ${item.file.name}`);
        await frame();
        let source;
        try {
          source = await PDFDocument.load(await item.file.arrayBuffer(), { ignoreEncryption: false });
        } catch (error) {
          const encrypted = /password|encrypt/i.test(String(error?.message || ""));
          throw new Error(`${item.file.name}: ${encrypted ? "this PDF is encrypted or password-protected." : "this PDF could not be read for merging."}`);
        }
        const pageIndexes = source.getPageIndices();
        if (!pageIndexes.length) throw new Error(`${item.file.name}: this PDF has no pages to copy.`);
        mergedPages += pageIndexes.length;
        if (mergedPages > LIMITS.maxTotalPages) throw new Error("The selected PDFs exceed the 500-page browser safety limit.");
        const copiedPages = await merged.copyPages(source, pageIndexes);
        copiedPages.forEach(page => merged.addPage(page));
        setProgress(7 + ((index + 1) / snapshot.length) * 84, `Merged document ${index + 1} of ${snapshot.length}: ${item.file.name}`);
        await frame();
      }

      if (merged.getPageCount() < 1) throw new Error("The merged document has no pages.");
      setProgress(93, "Finalizing merged PDF…");
      await frame();
      const bytes = await merged.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      revokeOutput();
      state.outputBlob = blob;
      state.outputUrl = URL.createObjectURL(blob);
      state.outputName = outputName;
      setProgress(100, "PDF ready to download.");
      await new Promise(resolve => setTimeout(resolve, 120));
      renderResult(snapshot.length, mergedPages, outputName);
      setStatus("PDF ready to download.", "success", true);
      setPhase(PHASE.RESULTS);
      ui.results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error(error);
      setProgress(null);
      setPhase(phaseForItems());
      const message = error?.message || "The selected PDFs could not be merged.";
      setStatus(message, "error", true);
      await dialogCall("error", "Unable to merge PDFs", message);
    } finally {
      state.busy = false;
      root.dataset.processing = "false";
      if (processingManager && processingOperationId) {
        if (state.outputBlob) processingManager.finish(processingOperationId);
        else processingManager.fail(processingOperationId);
        processingManager.reset(processingOperationId);
      } else {
        window.__auraProcessing = false;
      }
      updateSummary();
    }
  }

  function downloadOutput() {
    if (!state.outputUrl) {
      void dialogCall("error", "Nothing to download", "Merge PDFs first, then download the result.");
      return;
    }
    const link = document.createElement("a");
    link.href = state.outputUrl;
    link.download = state.outputName || sanitizeOutputName(ui.outputName.value);
    document.body.append(link);
    link.click();
    link.remove();
  }

  function previewOutput() {
    if (!state.outputUrl) {
      void dialogCall("error", "Nothing to preview", "Merge PDFs first, then open the preview.");
      return;
    }
    let opened = null;
    try { opened = window.open(state.outputUrl, "_blank"); } catch (_) { opened = null; }
    if (opened) {
      try { opened.opener = null; } catch (_) {}
      return;
    }

    // Mobile browsers may return null even when a user-triggered new-tab
    // navigation is allowed. Try a normal anchor before showing a warning.
    let fallbackOpened = false;
    try {
      const link = document.createElement("a");
      link.href = state.outputUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      fallbackOpened = true;
    } catch (_) {
      fallbackOpened = false;
    }

    if (!fallbackOpened) {
      void dialogCall("error", "Preview unavailable", "Could not open the preview. Download the PDF instead.");
      return;
    }

    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    if (!coarse && !mobile) void dialogCall("warning", "Preview blocked", "The browser blocked the preview window. Allow popups for this site, or download the PDF instead.");
  }

  function renderResult(filesMerged, pages, name) {
    ui.results.replaceChildren();
    const card = document.createElement("section");
    card.className = "merge-result-card";
    const title = document.createElement("h2"); title.textContent = "Merged PDF Ready";
    const summary = document.createElement("p"); summary.textContent = `${filesMerged} PDF${filesMerged === 1 ? "" : "s"} · ${pages} page${pages === 1 ? "" : "s"} · ${name} is ready to download.`;
    const stats = document.createElement("div"); stats.className = "merge-result-stats";
    [["FILES MERGED", filesMerged], ["TOTAL PAGES", pages], ["OUTPUT SIZE", formatBytes(state.outputBlob?.size || 0)]].forEach(([label, value]) => {
      const stat = document.createElement("div");
      const labelNode = document.createElement("span"); labelNode.textContent = label;
      const valueNode = document.createElement("strong"); valueNode.textContent = String(value);
      stat.append(labelNode, valueNode); stats.append(stat);
    });
    const actions = document.createElement("div"); actions.className = "result-actions";
    const again = document.createElement("button"); again.type = "button"; again.className = "btn secondary"; again.textContent = "Merge More PDFs"; again.addEventListener("click", mergeMore);
    const preview = document.createElement("button"); preview.type = "button"; preview.className = "btn secondary"; preview.textContent = "Open Preview"; preview.addEventListener("click", previewOutput);
    const download = document.createElement("button"); download.type = "button"; download.className = "btn primary"; download.textContent = "Download PDF"; download.addEventListener("click", downloadOutput);
    actions.append(again, preview, download);
    card.append(title, summary, stats, actions);
    ui.results.append(card);
  }

  ui.browse.addEventListener("click", event => { event.preventDefault(); if (!state.busy && !state.adding) ui.input.click(); });
  ui.drop.tabIndex = 0;
  ui.drop.setAttribute("role", "button");
  ui.drop.setAttribute("aria-label", "Upload PDF files");
  ui.drop.addEventListener("click", event => { if (event.target.closest("button,a,input,label")) return; if (!state.busy && !state.adding) ui.input.click(); });
  ui.drop.addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && !state.busy && !state.adding) { event.preventDefault(); ui.input.click(); } });
  ui.input.addEventListener("change", event => { addFiles(event.target.files); event.target.value = ""; });
  ["dragenter", "dragover"].forEach(type => ui.drop.addEventListener(type, event => { event.preventDefault(); if (!state.busy && !state.adding) ui.drop.dataset.active = "true"; }));
  ["dragleave", "drop"].forEach(type => ui.drop.addEventListener(type, event => { event.preventDefault(); delete ui.drop.dataset.active; }));
  ui.drop.addEventListener("drop", event => { if (!state.busy && !state.adding) addFiles(event.dataTransfer?.files); });

  ui.list.addEventListener("pointerdown", event => {
    const handle = event.target.closest(".merge-drag-handle");
    if (!handle || state.busy || state.adding || event.pointerType === "mouse") return;
    const row = handle.closest(".merge-file-row");
    if (!row) return;
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    state.touchDrag = { id: row.dataset.id, pointerId: event.pointerId };
    row.classList.add("is-dragging");
  });

  const finishTouchDrag = event => {
    if (!state.touchDrag || (event && state.touchDrag.pointerId !== event.pointerId)) return;
    ui.list.querySelectorAll(".merge-file-row.is-dragging").forEach(node => node.classList.remove("is-dragging"));
    state.touchDrag = null;
  };

  document.addEventListener("pointermove", event => {
    const drag = state.touchDrag;
    if (!drag || drag.pointerId !== event.pointerId || state.busy || state.adding) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".merge-file-row");
    if (!target || target.dataset.id === drag.id) return;
    event.preventDefault();
    moveItemBefore(drag.id, target.dataset.id);
    ui.list.querySelector(`[data-id="${drag.id}"]`)?.classList.add("is-dragging");
  }, { passive: false });

  document.addEventListener("pointerup", finishTouchDrag);
  document.addEventListener("pointercancel", finishTouchDrag);

  ui.clear.addEventListener("click", clearAll);
  ui.inlineClear?.addEventListener("click", clearAll);
  ui.start.addEventListener("click", processMerge);
  ui.outputName.addEventListener("blur", () => { ui.outputName.value = sanitizeOutputName(ui.outputName.value); });
  window.addEventListener("beforeunload", event => { if (state.busy) { event.preventDefault(); event.returnValue = ""; } });
  window.addEventListener("pagehide", () => { revokeOutput(); state.items.forEach(revokeItemPreview); }, { once: true });

  setStatus("", "", false);
  setProgress(null);
  renderFiles();
  setPhase(PHASE.UPLOAD);
  root.dataset.processing = "false";
  return { reset: resetToUpload, getFiles: () => state.items.map(item => item.file) };
}
