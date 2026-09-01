const MAX_FILES = 50;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_SOURCE_DIMENSION = 9000;
const MAX_OUTPUT_DIMENSION = 4096;

export function initResizeImagesRuntime(root) {
  if (!root) return;

const el = {
  input: root.querySelector('[data-image-input]'),
  drop: root.querySelector('[data-drop-zone]'),
  browse: root.querySelector('[data-browse]'),
  list: root.querySelector('[data-file-list]'),
  settings: root.querySelector('[data-step="settings"]'),
  status: root.querySelector('[data-tool-status]'),
  progress: root.querySelector('[data-progress-wrap]'),
  progressFill: root.querySelector('[data-progress-fill]'),
  progressText: root.querySelector('[data-progress-text]'),
  results: root.querySelector('[data-resize-results]'),
  resultsList: root.querySelector('[data-result-list]'),
  resultSummary: root.querySelector('[data-resize-result-summary]'),
  processMore: root.querySelector('[data-resize-more]'),
  downloadAll: root.querySelector('[data-download-all]'),
  modeFit: root.querySelector('[data-resize-mode][value="fit"]'),
  modeExact: root.querySelector('[data-resize-mode][value="exact"]'),
  modePercent: root.querySelector('[data-resize-mode][value="percent"]'),
  width: root.querySelector('[data-width]'),
  height: root.querySelector('[data-height]'),
  percent: root.querySelector('[data-percent]'),
  keepRatio: root.querySelector('[data-keep-ratio]'),
  noEnlarge: root.querySelector('[data-no-enlarge]'),
  format: root.querySelector('[data-output-format]'),
  quality: root.querySelector('[data-quality]'),
  qualityOutput: root.querySelector('.range-row output'),
  action: root.querySelector('.resize-action-card[data-step="actions"]')
};

const required = [el.input, el.drop, el.browse, el.list, el.settings, el.status, el.progress,
  el.progressFill, el.progressText, el.results, el.resultsList, el.resultSummary,
  el.processMore, el.downloadAll, el.modeFit, el.modeExact, el.modePercent, el.width,
  el.height, el.percent, el.keepRatio, el.noEnlarge, el.format, el.quality, el.action];
if (required.some(node => !node)) throw new Error('Resize Images is missing required controls.');

const startButton = el.action.querySelector('[data-start]');
const clearButton = el.action.querySelector('[data-reset]');
if (!startButton || !clearButton) throw new Error('Resize Images action controls are missing.');

// Root-level lifecycle ownership. The action card caused regressions because older
// generic CSS could still paint it after RESULTS/PROCESSING. Keep an anchor and
// physically remove the node outside SETTINGS; detached controls retain listeners.
const actionParent = el.action.parentNode;
const actionAnchor = document.createComment('resize-action-card-anchor');
actionParent.insertBefore(actionAnchor, el.action);

function mountActionCard() {
  if (el.action.parentNode !== actionParent) actionParent.insertBefore(el.action, actionAnchor.nextSibling);
  el.action.hidden = false;
  el.action.style.removeProperty('display');
}
function unmountActionCard() {
  el.action.hidden = true;
  el.action.style.setProperty('display', 'none', 'important');
  if (el.action.parentNode) el.action.remove();
}
function forceStepHidden(node, hidden) {
  if (!node) return;
  node.hidden = !!hidden;
  if (hidden) node.style.setProperty('display', 'none', 'important');
  else node.style.removeProperty('display');
}

let files = [];
let processed = [];
let busy = false;
let addChain = Promise.resolve();
let lastEdited = 'width';
let activeZipURL = null;

function callDialog(method, options) {
  const api = window.OrivaDialog?.[method] || window.OrivaDialog?.show;
  if (typeof api === 'function') return api(options);
  if (method === 'confirm') return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
  window.alert(`${options.title}\n\n${options.message}`);
  return Promise.resolve(true);
}
function popupError(title, message, items) { return callDialog('error', {title, message, items, variant:'error'}); }
function popupConfirm(title, message) { return callDialog('confirm', {title, message, confirmLabel:'Clear All', cancelLabel:'Cancel', variant:'confirm'}); }

function fmt(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / (1024 ** i);
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}
function imageType(file) {
  const t = String(file?.type || '').toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg') return 'image/jpeg';
  if (t === 'image/png') return 'image/png';
  if (t === 'image/webp') return 'image/webp';
  const n = String(file?.name || '').toLowerCase();
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  if (/\.png$/.test(n)) return 'image/png';
  if (/\.webp$/.test(n)) return 'image/webp';
  return '';
}
function baseName(name) { return String(name || 'image').replace(/\.[^.]+$/, '') || 'image'; }
function extension(type) { return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'; }
function uniqueName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  let candidate = '';
  do candidate = `${stem}-${i++}${ext}`; while (used.has(candidate));
  used.add(candidate);
  return candidate;
}
function getMode() { return el.modeExact.checked ? 'exact' : el.modePercent.checked ? 'percent' : 'fit'; }
function setPhase(next) {
  root.dataset.phase = next;
  root.dataset.processing = String(next === 'processing');

  // Structural state authority. Do not rely solely on CSS selectors because this
  // project has legacy generic workspace rules and users can still have an older
  // stylesheet in an active service-worker cache during a local replacement.
  if (next === 'settings') mountActionCard();
  else unmountActionCard();

  if (next === 'results') {
    forceStepHidden(el.progress, true);
    forceStepHidden(el.status, true);
  }
  if (next === 'upload') {
    forceStepHidden(el.progress, true);
    forceStepHidden(el.status, true);
  }
}
function setStatus(message = '', kind = '', visible = false) {
  el.status.textContent = message;
  el.status.dataset.kind = kind;
  forceStepHidden(el.status, !visible);
  root.dataset.statusVisible = visible ? 'true' : 'false';
}
function setProgress(percent = null, text = '') {
  const show = Number.isFinite(percent);
  forceStepHidden(el.progress, !show);
  if (!show) return;
  const safe = Math.max(0, Math.min(100, Number(percent)));
  el.progressFill.style.width = `${safe}%`;
  el.progressText.textContent = text || `${Math.round(safe)}%`;
}
function revokePreviews() {
  files.forEach(item => {
    if (item.previewURL) {
      try { URL.revokeObjectURL(item.previewURL); } catch (_) {}
      item.previewURL = '';
    }
  });
}
function revokeProcessed() {
  processed.forEach(item => {
    if (item.url) {
      try { URL.revokeObjectURL(item.url); } catch (_) {}
    }
  });
  processed = [];
  if (activeZipURL) {
    try { URL.revokeObjectURL(activeZipURL); } catch (_) {}
    activeZipURL = null;
  }
}
function setBusy(active) {
  busy = !!active;
  el.input.disabled = busy;
  el.browse.disabled = busy;
  el.drop.classList.toggle('is-disabled', busy);
  el.drop.setAttribute('aria-disabled', String(busy));
  clearButton.disabled = busy;
  startButton.disabled = busy || !files.length;
}

function firstNatural() { return files.find(item => item.natW > 0 && item.natH > 0); }
function probeNaturalSize(item) {
  const img = new Image();
  img.onload = () => {
    item.natW = img.naturalWidth || 0;
    item.natH = img.naturalHeight || 0;
    img.src = '';
  };
  img.onerror = () => { img.src = ''; };
  img.src = item.previewURL;
}
function syncLockedFields() {
  if (!el.keepRatio.checked || getMode() === 'fit') return;
  const src = firstNatural();
  if (!src || !src.natW || !src.natH) return;
  const ratio = src.natW / src.natH;
  const w = parseInt(el.width.value, 10);
  const h = parseInt(el.height.value, 10);
  if (lastEdited === 'width' && Number.isFinite(w) && w > 0) el.height.value = String(Math.max(1, Math.round(w / ratio)));
  if (lastEdited === 'height' && Number.isFinite(h) && h > 0) el.width.value = String(Math.max(1, Math.round(h * ratio)));
}
function setHidden(node, hidden) {
  if (!node) return;
  // The stylesheet gives .field/.choice-row/.range-row an explicit display value.
  // Set both the semantic hidden state and an inline display guard so mode changes
  // cannot be undone by a generic layout selector.
  node.hidden = !!hidden;
  node.style.display = hidden ? 'none' : '';
}
function updateModeUI() {
  const mode = getMode();
  const widthField = el.width.closest('label');
  const heightField = el.height.closest('label');
  const percentField = el.percent.closest('label');
  const lockLabel = el.keepRatio.closest('label');

  setHidden(widthField, mode === 'percent');
  setHidden(heightField, mode === 'percent');
  setHidden(percentField, mode !== 'percent');
  setHidden(lockLabel, mode === 'fit');

  if (mode === 'fit') el.keepRatio.checked = true;
  updateReady();
}
function updateQualityUI() {
  const row = el.quality.closest('.range-row');
  setHidden(row, el.format.value === 'image/png');
}
function updateReady() {
  if (busy) { startButton.disabled = true; return false; }
  if (!files.length) { startButton.disabled = true; return false; }
  const mode = getMode();
  if (mode === 'percent') {
    const p = parseFloat(el.percent.value);
    if (!Number.isFinite(p) || p <= 0 || p > 1000) { startButton.disabled = true; return false; }
  } else {
    const w = parseInt(el.width.value, 10);
    const h = parseInt(el.height.value, 10);
    const hasW = Number.isFinite(w) && w > 0;
    const hasH = Number.isFinite(h) && h > 0;
    if (!hasW && !hasH) { startButton.disabled = true; return false; }
  }
  startButton.disabled = false;
  return true;
}

function renderFiles() {
  el.list.replaceChildren();
  files.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const preview = document.createElement('div');
    preview.className = 'image-file-preview';
    const img = document.createElement('img');
    img.alt = '';
    img.src = item.previewURL;
    preview.append(img);
    const text = document.createElement('div');
    text.className = 'file-text-meta';
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = item.file.name;
    const info = document.createElement('div');
    info.className = 'file-size';
    info.textContent = `${fmt(item.file.size)} · ${(imageType(item.file) || 'image').replace('image/', '').toUpperCase()}`;
    text.append(name, info);
    meta.append(preview, text);
    const controls = document.createElement('div');
    controls.className = 'file-controls';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-file';
    remove.textContent = 'Remove';
    remove.disabled = busy;
    remove.addEventListener('click', () => removeFile(index));
    controls.append(remove);
    row.append(meta, controls);
    el.list.append(row);
  });
  el.list.hidden = files.length === 0;
}

function enterUploadPhase() {
  revokeProcessed();
  el.resultsList.replaceChildren();
  el.results.hidden = true;
  el.downloadAll.hidden = true;
  setProgress(null);
  renderFiles();
  setStatus('', '', false);
  setPhase('upload');
  updateReady();
}
function enterSettingsPhase() {
  revokeProcessed();
  el.resultsList.replaceChildren();
  el.results.hidden = true;
  el.downloadAll.hidden = true;
  setProgress(null);
  renderFiles();
  setStatus('', '', false);
  setPhase('settings');
  updateReady();
}
async function afterFilesChanged() {
  if (!files.length) enterUploadPhase();
  else enterSettingsPhase();
}

async function removeFile(index) {
  if (busy) return;
  const item = files[index];
  if (!item) return;
  if (item.previewURL) {
    try { URL.revokeObjectURL(item.previewURL); } catch (_) {}
  }
  files.splice(index, 1);
  await afterFilesChanged();
}
async function clearAll(skipConfirm = false) {
  if (busy) return false;
  if (!skipConfirm && files.length) {
    const ok = await popupConfirm('Clear images?', 'This clears the current list and results. Original files stay unchanged.');
    if (!ok) return false;
  }
  revokePreviews();
  files = [];
  if (el.input) el.input.value = '';
  enterUploadPhase();
  return true;
}

function addFilesInternal(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length || busy) return Promise.resolve();
  const rejected = [];
  const valid = [];
  let running = files.reduce((sum, item) => sum + item.file.size, 0);

  for (const file of incoming) {
    if (files.length + valid.length >= MAX_FILES) { rejected.push(`${file.name}: maximum ${MAX_FILES} images at a time.`); continue; }
    if (!imageType(file)) { rejected.push(`${file.name}: only JPG, PNG, and WebP are supported.`); continue; }
    if (file.size > MAX_FILE_SIZE) { rejected.push(`${file.name}: max ${fmt(MAX_FILE_SIZE)} per file.`); continue; }
    if (file.size <= 0) { rejected.push(`${file.name}: empty file.`); continue; }
    if (running + file.size > MAX_TOTAL_SIZE) { rejected.push(`${file.name}: would exceed ${fmt(MAX_TOTAL_SIZE)} total.`); continue; }
    const duplicate = files.some(item => item.file.name === file.name && item.file.size === file.size) || valid.some(item => item.file.name === file.name && item.file.size === file.size);
    if (duplicate) { rejected.push(`${file.name}: already in the list.`); continue; }
    running += file.size;
    const item = {file, previewURL: URL.createObjectURL(file), natW: 0, natH: 0};
    probeNaturalSize(item);
    valid.push(item);
  }

  if (valid.length) {
    files = files.concat(valid);
    return afterFilesChanged().then(async () => {
      if (rejected.length) await popupError('Some files were skipped', 'These files could not be added:', rejected.slice(0, 12));
    });
  }
  if (rejected.length) return popupError('Some files were skipped', 'These files could not be added:', rejected.slice(0, 12));
  return Promise.resolve();
}
function addFiles(fileList) {
  addChain = addChain.then(() => addFilesInternal(fileList)).catch(async err => {
    console.error('Resize upload transition failed:', err);
    await popupError('Upload failed', err?.message || 'Unable to add these images.');
  });
  return addChain;
}

async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, {imageOrientation:'from-image'}); }
    catch (_) { return await createImageBitmap(file); }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The image could not be decoded.'));
      img.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}
function computeTarget(srcW, srcH, mode, opts) {
  let tw = srcW;
  let th = srcH;
  if (mode === 'percent') {
    const scale = Math.max(0.01, opts.percent / 100);
    tw = Math.max(1, Math.round(srcW * scale));
    th = Math.max(1, Math.round(srcH * scale));
  } else {
    const hasW = opts.width > 0;
    const hasH = opts.height > 0;
    if (mode === 'fit') {
      if (hasW && hasH) {
        let scale = Math.min(opts.width / srcW, opts.height / srcH);
        if (opts.noEnlarge) scale = Math.min(1, scale);
        tw = Math.max(1, Math.round(srcW * scale)); th = Math.max(1, Math.round(srcH * scale));
      } else if (hasW) {
        let scale = opts.width / srcW; if (opts.noEnlarge) scale = Math.min(1, scale);
        tw = Math.max(1, Math.round(srcW * scale)); th = Math.max(1, Math.round(srcH * scale));
      } else if (hasH) {
        let scale = opts.height / srcH; if (opts.noEnlarge) scale = Math.min(1, scale);
        tw = Math.max(1, Math.round(srcW * scale)); th = Math.max(1, Math.round(srcH * scale));
      }
    } else if (hasW && hasH) {
      if (opts.lockAspect) {
        let scale = Math.min(opts.width / srcW, opts.height / srcH);
        if (opts.noEnlarge) scale = Math.min(1, scale);
        tw = Math.max(1, Math.round(srcW * scale)); th = Math.max(1, Math.round(srcH * scale));
      } else {
        tw = opts.noEnlarge ? Math.min(opts.width, srcW) : opts.width;
        th = opts.noEnlarge ? Math.min(opts.height, srcH) : opts.height;
      }
    } else if (hasW) {
      let scale = opts.width / srcW; if (opts.noEnlarge) scale = Math.min(1, scale);
      tw = opts.lockAspect ? Math.max(1, Math.round(srcW * scale)) : (opts.noEnlarge ? Math.min(opts.width, srcW) : opts.width);
      th = opts.lockAspect ? Math.max(1, Math.round(srcH * scale)) : srcH;
    } else if (hasH) {
      let scale = opts.height / srcH; if (opts.noEnlarge) scale = Math.min(1, scale);
      th = opts.lockAspect ? Math.max(1, Math.round(srcH * scale)) : (opts.noEnlarge ? Math.min(opts.height, srcH) : opts.height);
      tw = opts.lockAspect ? Math.max(1, Math.round(srcW * scale)) : srcW;
    }
  }
  const longSide = Math.max(tw, th);
  if (longSide > MAX_OUTPUT_DIMENSION) {
    const scale = MAX_OUTPUT_DIMENSION / longSide;
    tw = Math.max(1, Math.round(tw * scale));
    th = Math.max(1, Math.round(th * scale));
  }
  return {width: tw, height: th};
}
function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this image.')), type, type === 'image/png' ? undefined : quality));
}
async function resizeOne(file, opts) {
  let image;
  try {
    image = await decodeImage(file);
    const sw = image.width || image.naturalWidth;
    const sh = image.height || image.naturalHeight;
    if (!sw || !sh) throw new Error('Image dimensions could not be read.');
    if (sw * sh > MAX_PIXELS || Math.max(sw, sh) > MAX_SOURCE_DIMENSION) throw new Error(`Image too large (${sw}×${sh}). Max ${MAX_SOURCE_DIMENSION}px side / ${MAX_PIXELS.toLocaleString()} pixels.`);
    const target = computeTarget(sw, sh, opts.mode, opts);
    const canvas = document.createElement('canvas');
    canvas.width = target.width; canvas.height = target.height;
    const ctx = canvas.getContext('2d', {alpha: opts.outputType !== 'image/jpeg'});
    if (!ctx) throw new Error('The required image processing capability is unavailable for this operation.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opts.outputType === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, target.width, target.height); }
    ctx.drawImage(image, 0, 0, target.width, target.height);
    const blob = await canvasToBlob(canvas, opts.outputType, opts.quality);
    canvas.width = 0; canvas.height = 0;
    return {blob, fromWidth: sw, fromHeight: sh, toWidth: target.width, toHeight: target.height, outputType: opts.outputType};
  } finally { try { image?.close?.(); } catch (_) {} }
}

async function startResize() {
  if (busy || !files.length) return;
  const mode = getMode();
  const width = parseInt(el.width.value, 10) || 0;
  const height = parseInt(el.height.value, 10) || 0;
  const percent = parseFloat(el.percent.value) || 0;
  if (mode === 'percent' && !(percent > 0 && percent <= 1000)) { await popupError('Invalid percentage', 'Enter a percentage between 1 and 1000.'); return; }
  if (mode !== 'percent' && !(width > 0 || height > 0)) { await popupError('Missing size', 'Enter width and/or height in pixels.'); return; }

  setBusy(true);
  revokeProcessed();
  el.resultsList.replaceChildren();
  el.results.hidden = true;
  el.downloadAll.hidden = true;
  setPhase('processing');
  setStatus('Preparing the selected images…', 'working', true);
  setProgress(0, `Preparing resize… 0/${files.length}`);

  const snapshot = files.slice();
  const used = new Set();
  const failed = [];
  let successCount = 0;
  for (let i = 0; i < snapshot.length; i += 1) {
    const item = snapshot[i];
    const file = item.file;
    try {
      const outputType = el.format.value === 'keep' ? (imageType(file) || 'image/jpeg') : el.format.value;
      const quality = Math.min(1, Math.max(0.01, (Number(el.quality.value) || 80) / 100));
      const result = await resizeOne(file, {mode, width, height, percent, lockAspect: el.keepRatio.checked, noEnlarge: el.noEnlarge.checked, outputType, quality});
      const name = uniqueName(`${baseName(file.name)}.${extension(result.outputType)}`, used);
      const url = URL.createObjectURL(result.blob);
      processed.push({name, blob: result.blob, url});
      successCount += 1;
      const row = document.createElement('div'); row.className = 'result-row';
      const left = document.createElement('div');
      const n = document.createElement('div'); n.className = 'result-name'; n.textContent = name;
      const m = document.createElement('div'); m.className = 'result-meta'; m.textContent = `${result.fromWidth}×${result.fromHeight} → ${result.toWidth}×${result.toHeight} · ${fmt(file.size)} → ${fmt(result.blob.size)}`;
      left.append(n, m);
      const link = document.createElement('a'); link.className = 'btn secondary'; link.textContent = 'Download'; link.href = url; link.download = name;
      row.append(left, link); el.resultsList.append(row);
    } catch (err) {
      console.error('Resize failed:', err);
      failed.push(`${file.name}: ${err?.message || 'Failed'}`);
      const row = document.createElement('div'); row.className = 'result-row is-failed';
      const left = document.createElement('div');
      const n = document.createElement('div'); n.className = 'result-name'; n.textContent = file.name;
      const m = document.createElement('div'); m.className = 'result-meta'; m.textContent = err?.message || 'Failed to process';
      left.append(n, m); row.append(left); el.resultsList.append(row);
    }
    const completed = i + 1;
    const pct = Math.round((completed / snapshot.length) * 100);
    setProgress(pct, `Resizing ${completed} of ${snapshot.length} · ${file.name}`);
    setStatus(`Resizing ${completed} of ${snapshot.length}…`, 'working', true);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  setProgress(null);
  setBusy(false);
  el.resultSummary.textContent = `${successCount} of ${snapshot.length} image${snapshot.length === 1 ? '' : 's'} resized successfully.`;
  el.downloadAll.hidden = processed.length < 2;
  el.results.hidden = false;
  setStatus('', '', false);
  setPhase('results');
  if (failed.length) await popupError('Some images failed', 'These could not be resized:', failed.slice(0, 12));
  el.results.scrollIntoView({behavior:'smooth', block:'start'});
  updateReady();
}

async function loadZipForResize() {
  if (window.JSZip) return window.JSZip;
  const existing = document.querySelector('script[data-oriva-jszip]');
  if (existing) {
    if (window.JSZip) return window.JSZip;
    await new Promise((resolve, reject) => {
      let timer = setTimeout(() => reject(new Error('The ZIP component could not be loaded in time. Check your connection and try again.')), 20000);
      const done = () => { clearTimeout(timer); window.JSZip ? resolve() : reject(new Error('The ZIP component did not initialize.')); };
      existing.addEventListener('load', done, {once:true}); existing.addEventListener('error', () => { clearTimeout(timer); reject(new Error('The ZIP component could not be loaded.')); }, {once:true});
    });
    return window.JSZip;
  }
  const script=document.createElement('script'); script.dataset.orivaJszip='true'; script.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'; script.async=true;
  await new Promise((resolve,reject)=>{let settled=false; const timer=setTimeout(()=>{if(settled)return;settled=true;try{script.remove();}catch(_){}reject(new Error('The ZIP component could not be loaded in time. Check your connection and try again.'));},20000); script.onload=()=>{if(settled)return;settled=true;clearTimeout(timer);window.JSZip?resolve():reject(new Error('The ZIP component did not initialize.'));}; script.onerror=()=>{if(settled)return;settled=true;clearTimeout(timer);try{script.remove();}catch(_){}reject(new Error('The ZIP component could not be loaded.'));}; document.head.append(script);});
  return window.JSZip;
}
async function downloadAll() {
  if (processed.length < 2 || busy) return;
  const original = el.downloadAll.textContent;
  el.downloadAll.disabled = true;
  el.downloadAll.textContent = 'Creating ZIP…';
  try {
    const JSZip = await loadZipForResize();
    const zip = new JSZip();
    processed.forEach(item => zip.file(item.name, item.blob));
    setPhase('processing');
    setStatus('Preparing ZIP…', 'working', true);
    const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE'}, meta => setProgress(meta.percent, 'Preparing ZIP…'));
    activeZipURL = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = activeZipURL; a.download = 'resized-images.zip'; document.body.append(a); a.click(); a.remove();
    window.setTimeout(() => { if (activeZipURL) { try { URL.revokeObjectURL(activeZipURL); } catch (_) {} activeZipURL = null; } }, 2000);
    setProgress(null); setStatus('', '', false); setPhase('results');
  } catch (err) {
    setProgress(null); setStatus('', '', false); setPhase('results');
    await popupError('ZIP failed', err?.message || 'Could not create the ZIP file.');
  } finally {
    el.downloadAll.disabled = false;
    el.downloadAll.textContent = original;
  }
}

function openFilePicker() {
  if (busy || el.input.disabled) return;
  el.input.click();
}

el.browse.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  openFilePicker();
});
el.drop.addEventListener('click', event => {
  if (busy || event.target.closest('[data-browse]')) return;
  openFilePicker();
});
el.drop.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!event.target.closest('[data-browse]')) openFilePicker();
  }
});
['dragenter', 'dragover'].forEach(type => el.drop.addEventListener(type, event => {
  event.preventDefault();
  if (!busy) el.drop.dataset.active = 'true';
}));
['dragleave', 'drop'].forEach(type => el.drop.addEventListener(type, event => {
  event.preventDefault();
  el.drop.dataset.active = 'false';
}));
el.drop.addEventListener('drop', event => { if (!busy) addFiles(event.dataTransfer?.files); });
el.input.addEventListener('change', () => {
  const selected = Array.from(el.input.files || []);
  el.input.value = '';
  addFiles(selected);
});
clearButton.addEventListener('click', () => clearAll(false));
startButton.addEventListener('click', startResize);
el.processMore.addEventListener('click', async () => { const cleared = await clearAll(false); if (cleared) window.scrollTo({top:0, behavior:'smooth'}); });
el.downloadAll.addEventListener('click', downloadAll);
[el.modeFit, el.modeExact, el.modePercent].forEach(node => node.addEventListener('change', updateModeUI));
el.width.addEventListener('input', () => { lastEdited = 'width'; syncLockedFields(); updateReady(); });
el.height.addEventListener('input', () => { lastEdited = 'height'; syncLockedFields(); updateReady(); });
el.percent.addEventListener('input', updateReady);
el.keepRatio.addEventListener('change', () => { if (el.keepRatio.checked) syncLockedFields(); updateReady(); });
el.noEnlarge.addEventListener('change', updateReady);
el.format.addEventListener('change', updateQualityUI);
el.quality.addEventListener('input', () => { if (el.qualityOutput) el.qualityOutput.textContent = `${el.quality.value}%`; });
window.addEventListener('beforeunload', event => {
  if (busy) { event.preventDefault(); event.returnValue = ''; }
  revokePreviews(); revokeProcessed();
});

if (el.qualityOutput) el.qualityOutput.textContent = `${el.quality.value}%`;
el.list.hidden = true;
el.results.hidden = true;
el.downloadAll.hidden = true;
setProgress(null);
setStatus('', '', false);
setPhase('upload');
updateModeUI();
updateQualityUI();
}
