import * as engine from "../engines/convert-images.js";

const LIMITS = Object.freeze({
  maxFiles: 100,
  maxFileBytes: 100 * 1024 * 1024,
  maxTotalBytes: 500 * 1024 * 1024
});

const TYPES = new Map([
  ["image/jpeg", "JPEG / JPG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"]
]);

const ACCEPT = Object.freeze({
  auto: "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
  "image/jpeg": "image/jpeg,image/jpg,.jpg,.jpeg",
  "image/png": "image/png,.png",
  "image/webp": "image/webp,.webp"
});

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes <= 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  })[char]);
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

function sizeDelta(original, output) {
  if (!original) return "";
  const percent = Math.round(Math.abs((output - original) / original) * 100);
  if (output < original) return `${percent}% smaller`;
  if (output > original) return `${percent}% larger`;
  return "Same size";
}

function ask(kind, title, message, items = [], options = {}) {
  const variant = ["error", "warning", "success", "confirm"].includes(kind) ? kind : "error";
  const api = window.OrivaDialog;
  const payload = {
    title, message, items: Array.isArray(items) ? items : [], variant,
    confirmLabel: options.confirmLabel || (variant === "confirm" ? "Continue" : "OK"),
    cancelLabel: variant === "confirm" ? (options.cancelLabel || "Cancel") : null
  };
  if (api?.[variant]) return api[variant](payload);
  if (api?.show) return api.show(payload);
  if (variant === "confirm") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  window.alert(`${title}\n\n${message}`);
  return Promise.resolve(true);
}

const lazyLoads = new Map();
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

export function initConvertImagesController(root) {
  if (!root || root.dataset.runtimeReady === "true") return null;

  const find = selector => root.querySelector(selector);
  const ui = {
    input: find("[data-image-input]"), drop: find("[data-drop-zone]"), browse: find("[data-browse]"),
    files: find("[data-file-list]"), settings: find("[data-step=settings]"), safety: find("[data-step=safety]"),
    status: find("[data-tool-status]"), progress: find("[data-progress-wrap]"), progressFill: find("[data-progress-fill]"),
    progressText: find("[data-progress-text]"), progressTitle: find("[data-progress-title]"), progressPercent: find("[data-progress-percent]"),
    results: find("[data-result-list]"), actions: find("[data-step=actions]"), start: find("[data-start]"), reset: find("[data-reset]"),
    source: find("[data-source-format]"), target: find("[data-output-format]"), quality: find("[data-quality]"),
    qualityOutput: find("[data-quality-output]"), background: find("[data-background]"), qualityCard: find(".image-settings .setting-card:first-child"),
    backgroundField: find("[data-background-field]"), formatSummary: find("[data-format-summary]"), formatNote: find("[data-format-note]")
  };
  if (Object.values(ui).some(node => !node)) return null;
  root.dataset.runtimeReady = "true";

  const state = { items: [], outputs: [], busy: false, operationId: null, uploadQueue: Promise.resolve(), outputUrls: new Set(), zipPromise: null, disposed: false };
  let sourceFormat = ui.source.value || "auto";
  let targetFormat = ui.target.value || "image/webp";
  let jpgBackground = ui.background.value || "#ffffff";

  function setPhase(phase) { root.dataset.phase = phase; }
  function setStatus(text = "", kind = "", visible = false) {
    ui.status.textContent = text;
    if (kind) ui.status.dataset.kind = kind; else delete ui.status.dataset.kind;
    ui.status.hidden = !visible;
  }
  function showProgress(percent, text = "") {
    if (!Number.isFinite(percent)) {
      ui.progress.hidden = true; ui.progressFill.style.width = "0%"; ui.progressText.textContent = "";
      if (ui.progressTitle) ui.progressTitle.textContent = "";
      if (ui.progressPercent) ui.progressPercent.textContent = "0%";
      return;
    }
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    ui.progress.hidden = false; ui.progressFill.style.width = `${value}%`; ui.progressText.textContent = text || `${value}%`;
    if (ui.progressPercent) ui.progressPercent.textContent = `${value}%`;
  }
  function revokeOutputUrls() { for (const url of state.outputUrls) { try { URL.revokeObjectURL(url); } catch {} } state.outputUrls.clear(); state.outputs = []; }
  function revokeItemPreviews(items = state.items) { for (const item of items) if (item.preview) { try { URL.revokeObjectURL(item.preview); } catch {} } }
  function clearResults({ hideProgress = true } = {}) { revokeOutputUrls(); ui.results.replaceChildren(); ui.results.hidden = true; if (hideProgress) showProgress(NaN); }

  function setBusy(active) {
    if (active) {
      if (state.busy || window.__orivaProcessing) return false;
      state.busy = true; state.operationId = `${Date.now()}-${Math.random().toString(36).slice(2)}`; window.__orivaProcessing = state.operationId;
    } else if (state.operationId && window.__orivaProcessing === state.operationId) {
      window.__orivaProcessing = false; state.busy = false; state.operationId = null;
    } else { state.busy = false; state.operationId = null; }
    root.dataset.processing = String(active);
    ui.input.disabled = active; ui.browse.disabled = active; ui.reset.disabled = active; ui.source.disabled = active; ui.target.disabled = active;
    ui.quality.disabled = active; ui.background.disabled = active; ui.start.disabled = active || state.items.length === 0;
    ui.drop.setAttribute("aria-disabled", String(active));
    return true;
  }

  function updateFormatControls() {
    sourceFormat = ui.source.value; targetFormat = ui.target.value;
    ui.input.accept = ACCEPT[sourceFormat] || ACCEPT.auto;
    const usesQuality = targetFormat === "image/jpeg" || targetFormat === "image/webp";
    ui.qualityCard.hidden = !usesQuality;
    ui.backgroundField.hidden = targetFormat !== "image/jpeg";
    ui.qualityOutput.textContent = `${ui.quality.value}%`;
    ui.formatSummary.textContent = `${sourceFormat === "auto" ? "AUTO DETECT" : TYPES.get(sourceFormat)} → ${TYPES.get(targetFormat)}`;
    ui.formatNote.textContent = sourceFormat === "auto"
      ? "Auto Detect accepts a mixed batch of supported JPG, PNG and WebP images."
      : `Upload filter is set to ${TYPES.get(sourceFormat)}. The actual image type is still verified.`;
    const sameManual = sourceFormat !== "auto" && sourceFormat === targetFormat;
    ui.start.disabled = state.busy || state.items.length === 0 || sameManual;
    ui.start.textContent = sameManual ? "Choose a Different Output Format" : "Convert Images";
    if (sameManual) setStatus("Source and output formats are the same.", "error", true);
    else if (state.items.length) setStatus(`${state.items.length} image${state.items.length === 1 ? "" : "s"} ready. Choose an output format, then convert.`, "success", true);
    else setStatus("", "", false);
  }

  function renderFiles() {
    ui.files.replaceChildren();
    if (!state.items.length) { ui.files.hidden = true; return; }
    const total = state.items.reduce((sum, item) => sum + item.file.size, 0);
    const summary = document.createElement("div"); summary.className = "batch-summary"; summary.textContent = `${state.items.length} image${state.items.length === 1 ? "" : "s"} uploaded • ${formatBytes(total)}`; ui.files.append(summary);
    state.items.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "file-row";
      const meta = document.createElement("div"); meta.className = "file-meta";
      const preview = document.createElement("div"); preview.className = "image-file-preview"; const image = document.createElement("img"); image.src = item.preview; image.alt = ""; preview.append(image);
      const text = document.createElement("div"); text.className = "file-text-meta";
      const name = document.createElement("div"); name.className = "file-name"; name.title = item.file.name; name.textContent = item.file.name;
      const size = document.createElement("div"); size.className = "file-size"; size.textContent = `${formatBytes(item.file.size)} • ${TYPES.get(item.type) || "Image"}`;
      const uploaded = document.createElement("div"); uploaded.className = "upload-status"; uploaded.textContent = "✓ Uploaded"; text.append(name, size, uploaded); meta.append(preview, text);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-file"; remove.textContent = "Remove"; remove.disabled = state.busy; remove.addEventListener("click", () => removeFile(index));
      row.append(meta, remove); ui.files.append(row);
    });
    ui.files.hidden = false;
  }

  function syncReadySurface() {
    const hasFiles = state.items.length > 0; ui.settings.hidden = !hasFiles; ui.safety.hidden = !hasFiles; ui.actions.hidden = !hasFiles;
    renderFiles(); if (!state.busy) setPhase(hasFiles ? "settings" : "upload"); updateFormatControls();
  }

  function removeFile(index) { if (state.busy) return; const [item] = state.items.splice(index, 1); if (item?.preview) { try { URL.revokeObjectURL(item.preview); } catch {} } clearResults(); syncReadySurface(); }

  async function reset(skipConfirm = false) {
    if (state.busy) return;
    if (!skipConfirm && (state.items.length || state.outputs.length)) {
      const confirmed = await ask("confirm", "Clear all images?", "This clears the current image list and conversion results. Your original files stay unchanged.", [], { confirmLabel: "Clear All", cancelLabel: "Cancel" });
      if (!confirmed) return;
    }
    revokeItemPreviews(); state.items = []; clearResults(); ui.input.value = ""; ui.source.value = "auto"; ui.target.value = "image/webp"; ui.quality.value = "92"; ui.background.value = "#ffffff"; sourceFormat = "auto"; targetFormat = "image/webp"; jpgBackground = "#ffffff";
    updateFormatControls(); syncReadySurface();
  }

  async function changeSource(next) {
    if (state.busy || next === sourceFormat) return;
    if (state.items.length && next !== "auto" && state.items.some(item => item.type !== next)) {
      const confirmed = await ask("confirm", "Change source format?", "Some uploaded images do not match this format. The current list will be cleared.", [], { confirmLabel: "Change Format", cancelLabel: "Cancel" });
      if (!confirmed) { ui.source.value = sourceFormat; return; }
      revokeItemPreviews(); state.items = []; clearResults();
    }
    sourceFormat = next; ui.source.value = next; syncReadySurface();
  }

  function validateAndAdd(fileList) {
    if (state.busy || state.disposed) return Promise.resolve();
    const incoming = Array.from(fileList || []); if (!incoming.length) return Promise.resolve();
    const accepted = [], rejected = []; let runningTotal = state.items.reduce((sum, item) => sum + item.file.size, 0);
    for (const file of incoming) {
      const type = resolveType(file);
      if (!type) { rejected.push(`${file.name || "Unnamed file"}: unsupported format. Use JPG, PNG or WebP.`); continue; }
      if (sourceFormat !== "auto" && type !== sourceFormat) { rejected.push(`${file.name}: does not match ${TYPES.get(sourceFormat)}.`); continue; }
      if (!file.size) { rejected.push(`${file.name}: this file is empty.`); continue; }
      if (file.size > LIMITS.maxFileBytes) { rejected.push(`${file.name}: larger than 100 MB.`); continue; }
      if (state.items.length + accepted.length >= LIMITS.maxFiles) { rejected.push(`${file.name}: maximum 100 images allowed.`); continue; }
      if (runningTotal + file.size > LIMITS.maxTotalBytes) { rejected.push(`${file.name}: total batch limit of 500 MB would be exceeded.`); continue; }
      accepted.push({ file, type, preview: URL.createObjectURL(file) }); runningTotal += file.size;
    }
    if (accepted.length) { clearResults(); state.items.push(...accepted); syncReadySurface(); }
    ui.input.value = "";
    if (!rejected.length) return Promise.resolve();
    return ask("error", rejected.length === 1 ? "Image could not be added" : "Some images could not be added", rejected.length === 1 ? "This image was skipped." : `${rejected.length} images were skipped.`, rejected);
  }

  function enqueueFiles(fileList) { state.uploadQueue = state.uploadQueue.then(() => validateAndAdd(fileList)).catch(async error => { console.error(error); ui.input.value = ""; await ask("error", "Upload failed", error?.message || "Unable to add these images.", []); }); return state.uploadQueue; }

  async function convertMore() {
    if (state.busy) return;
    const confirmed = await ask("confirm", "Convert more images?", "This clears the current conversion results and returns you to the upload workflow. Your downloaded files are not affected.", [], { confirmLabel: "Continue", cancelLabel: "Cancel" });
    if (!confirmed) return;
    await reset(true); root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function uniqueName(name, used) {
    if (!used.has(name)) { used.add(name); return name; }
    const dot = name.lastIndexOf("."); const stem = dot === -1 ? name : name.slice(0, dot); const ext = dot === -1 ? "" : name.slice(dot);
    let i = 2; let candidate = `${stem} (${i})${ext}`; while (used.has(candidate)) candidate = `${stem} (${++i})${ext}`; used.add(candidate); return candidate;
  }

  async function process() {
    if (state.busy) { await ask("warning", "Please wait", "Another file operation is already in progress. Wait for it to finish before starting conversion.", []); return; }
    if (!state.items.length) return;
    if (sourceFormat !== "auto" && sourceFormat === targetFormat) { await ask("error", "Choose a different output", "Source and output formats are the same.", []); return; }
    const snapshot = [...state.items]; const target = targetFormat; const quality = Number(ui.quality.value) / 100; const background = jpgBackground;
    clearResults({ hideProgress: false }); ui.actions.hidden = true; setPhase("processing"); setBusy(true); ui.start.textContent = "Converting...";
    setStatus("Preparing the selected images…", "working", true); showProgress(0, "Starting conversion…");
    const failures = [], usedNames = new Set(); let successCount = 0, skippedCount = 0, smartGuardCount = 0;
    try {
      for (let index = 0; index < snapshot.length; index += 1) {
        const item = snapshot[index]; const row = document.createElement("div"); row.className = "result-row is-processing";
        const meta = document.createElement("div"); meta.className = "result-meta"; meta.innerHTML = `<strong>${escapeHTML(item.file.name)}</strong><span>Converting ${index + 1} of ${snapshot.length}…</span>`; row.append(meta); ui.results.append(row); ui.results.hidden = false;
        setStatus(`Converting ${index + 1} of ${snapshot.length}…`, "working", true); showProgress((index / snapshot.length) * 100, `Converting ${index + 1} of ${snapshot.length}… ${item.file.name}`);
        if (item.type === target) {
          skippedCount += 1; row.classList.remove("is-processing"); row.classList.add("is-skipped"); meta.innerHTML = `<strong>${escapeHTML(item.file.name)}</strong><span>↷ Already ${TYPES.get(target)} — skipped • No format change required</span>`;
          await nextFrame(); continue;
        }
        try {
          const result = await engine.convert(item.file, { target, quality, bg: background }); const name = uniqueName(result.name, usedNames); const url = URL.createObjectURL(result.blob);
          state.outputUrls.add(url); state.outputs.push({ kind: "success", name, type: target, blob: result.blob, url, originalSize: item.file.size, smartGuardAdjusted: !!result.smartGuardAdjusted });
          successCount += 1; if (result.smartGuardAdjusted) smartGuardCount += 1; row.classList.remove("is-processing"); row.classList.add("is-success");
          const note = result.smartGuardAdjusted ? " • Smart Size Guard adjusted output" : "";
          meta.innerHTML = `<strong>${escapeHTML(name)}</strong><span>✓ Converted successfully • ${formatBytes(item.file.size)} → ${formatBytes(result.blob.size)} • ${sizeDelta(item.file.size, result.blob.size)}${note}</span>`;
          const download = document.createElement("a"); download.className = "btn secondary"; download.textContent = "Download"; download.href = url; download.download = name; row.append(download);
        } catch (error) {
          const message = error?.message || "This image could not be converted safely."; failures.push(`${item.file.name}: ${message}`); state.outputs.push({ kind: "failed", name: item.file.name, message, originalSize: item.file.size });
          row.classList.remove("is-processing"); row.classList.add("is-failed"); meta.innerHTML = `<strong>${escapeHTML(item.file.name)}</strong><span>Conversion failed • ${escapeHTML(message)}</span>`;
        }
        showProgress(((index + 1) / snapshot.length) * 100, index + 1 === snapshot.length ? "Finalizing results…" : `Completed ${index + 1} of ${snapshot.length}`); await nextFrame();
      }
      setPhase("results"); showProgress(100, "Conversion complete");
      const summary = `${successCount} converted successfully${skippedCount ? ` • ${skippedCount} already in target format` : ""}${failures.length ? ` • ${failures.length} failed` : ""}`;
      setStatus(successCount ? summary : "No images could be converted.", successCount ? "success" : "error", true);
      renderResultActions();
      if (failures.length) await ask("error", failures.length === 1 ? "1 image failed" : `${failures.length} images failed`, "Some images could not be converted. Details are also shown in the results list.", failures.slice(0, 12));
      if (!successCount && !skippedCount) await ask("error", "Conversion could not be completed", "None of the selected images produced a downloadable result.", []);
      if (!successCount && skippedCount) await ask("error", "Nothing to convert", "Every selected image is already in the target format. Choose a different output format to continue.", []);
      if (smartGuardCount) await ask("warning", "Smart Size Guard", `${smartGuardCount} image${smartGuardCount === 1 ? "" : "s"} had output quality adjusted so the converted file stayed closer to the original size.`, []);
      ui.results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error(error); setPhase("results"); setStatus(error?.message || "Conversion could not be completed.", "error", true); showProgress(NaN); await ask("error", "Conversion failed", error?.message || "Conversion could not be completed safely.", []); renderResultActions();
    } finally {
      setBusy(false); ui.actions.hidden = false; ui.start.textContent = "Convert Images"; if (state.items.length) { ui.settings.hidden = false; ui.safety.hidden = false; }
    }
  }

  function renderResultActions() {
    const existing = root.querySelector(".result-actions"); existing?.remove(); const actions = document.createElement("div"); actions.className = "result-actions";
    const more = document.createElement("button"); more.type = "button"; more.className = "btn secondary"; more.textContent = "Convert More Images"; more.addEventListener("click", convertMore); actions.append(more);
    if (state.outputs.some(output => output.kind === "success")) { const zip = document.createElement("button"); zip.type = "button"; zip.className = "btn primary"; zip.textContent = "Download All as ZIP"; zip.addEventListener("click", downloadZip); actions.append(zip); }
    ui.results.append(actions);
  }

  async function downloadZip() {
    const outputs = state.outputs.filter(output => output.kind === "success"); if (!outputs.length || state.busy) return;
    try {
      setStatus("Creating ZIP download…", "working", true); const JSZip = await loadExternal("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "jszip", "JSZip"); const zip = new JSZip();
      outputs.forEach(output => zip.file(output.name, output.blob));
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" }, meta => showProgress(meta.percent, `Preparing ZIP… ${Math.round(meta.percent)}%`));
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "OrivaStudio_Converted_Images.zip"; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000);
      showProgress(NaN); setStatus("ZIP download is ready.", "success", true);
    } catch (error) { showProgress(NaN); setStatus(error?.message || "ZIP could not be created.", "error", true); await ask("error", "Could not create ZIP archive", error?.message || "Please try again.", []); }
  }

  ui.browse.addEventListener("click", event => { event.stopPropagation(); if (!state.busy) ui.input.click(); });
  ui.drop.addEventListener("click", () => { if (!state.busy) ui.input.click(); });
  ui.drop.addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && !state.busy) { event.preventDefault(); ui.input.click(); } });
  ui.input.addEventListener("change", event => enqueueFiles(event.target.files));
  ["dragenter", "dragover"].forEach(type => ui.drop.addEventListener(type, event => { event.preventDefault(); if (!state.busy) ui.drop.dataset.active = "true"; }));
  ["dragleave", "drop"].forEach(type => ui.drop.addEventListener(type, event => { event.preventDefault(); ui.drop.dataset.active = "false"; }));
  ui.drop.addEventListener("drop", event => enqueueFiles(event.dataTransfer?.files));
  ui.reset.addEventListener("click", () => reset(false));
  ui.start.addEventListener("click", process);
  ui.source.addEventListener("change", event => changeSource(event.target.value));
  ui.target.addEventListener("change", () => { if (!state.busy) { targetFormat = ui.target.value; updateFormatControls(); } });
  ui.quality.addEventListener("input", () => { ui.qualityOutput.textContent = `${ui.quality.value}%`; });
  ui.background.addEventListener("input", () => { jpgBackground = ui.background.value; });
  window.addEventListener("beforeunload", event => { if (state.busy) { event.preventDefault(); event.returnValue = ""; } });
  updateFormatControls(); showProgress(NaN); syncReadySurface();
  return { dispose: () => { state.disposed = true; if (!state.busy) reset(true); } };
}
