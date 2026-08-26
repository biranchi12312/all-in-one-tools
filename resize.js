(() => {
    "use strict";

    const view = document.getElementById("resizeView");
    if (!view) return;

    const MAX_FILES = 50;
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
    const MAX_PIXELS = 40000000;
    const MAX_SOURCE_DIMENSION = 9000;
    const MAX_OUTPUT_DIMENSION = 4096;

    const el = {
        input: document.getElementById("resizeFileInput"),
        dropZone: document.getElementById("resizeDropZone"),
        queuePanel: document.getElementById("resizeQueuePanel"),
        queue: document.getElementById("resizeFileQueue"),
        queueSummary: document.getElementById("resizeQueueSummary"),
        clearButton: document.getElementById("resizeClearBtn"),
        settings: document.getElementById("resizeSettingsPanel"),
        modeFit: document.getElementById("resizeModeFit"),
        modeExact: document.getElementById("resizeModeExact"),
        modePercent: document.getElementById("resizeModePercent"),
        widthInput: document.getElementById("resizeWidth"),
        heightInput: document.getElementById("resizeHeight"),
        percentInput: document.getElementById("resizePercent"),
        dimRow: document.getElementById("resizeDimRow"),
        percentRow: document.getElementById("resizePercentRow"),
        lockAspect: document.getElementById("resizeLockAspect"),
        noEnlarge: document.getElementById("resizeNoEnlarge"),
        formatSelect: document.getElementById("resizeFormat"),
        qualityGroup: document.getElementById("resizeQualityGroup"),
        quality: document.getElementById("resizeQualitySlider"),
        qualityValue: document.getElementById("resizeQualityVal"),
        readyText: document.getElementById("resizeReadyText"),
        start: document.getElementById("resizeStartBtn"),
        progress: document.getElementById("resizeProgressPanel"),
        progressTitle: document.getElementById("resizeProgressTitle"),
        progressPercent: document.getElementById("resizeProgressPercent"),
        progressFill: document.getElementById("resizeProgressFill"),
        progressText: document.getElementById("resizeProgressText"),
        results: document.getElementById("resizeResultsPanel"),
        resultsList: document.getElementById("resizeResultsList"),
        resultSummary: document.getElementById("resizeResultSummary"),
        processMore: document.getElementById("resizeProcessMoreBtn"),
        zip: document.getElementById("resizeZipBtn")
    };

    if (!el.input || !el.dropZone || !el.start) return;

    let files = [];
    let processed = [];
    let processing = false;
    let addChain = Promise.resolve();
    let lastEditedDim = "width";

    function dialog() {
        return window.AuraDialog || null;
    }

    function popupError(title, message, items) {
        const ui = dialog();
        if (ui) return ui.error(title, message, items);
        window.alert([title, message, (items || []).join("\n")].filter(Boolean).join("\n"));
        return Promise.resolve();
    }

    async function popupConfirm(title, message) {
        const ui = dialog();
        if (ui) return ui.confirm(title, message);
        return window.confirm(`${title}\n\n${message}`);
    }

    function formatBytes(bytes) {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
        const value = n / Math.pow(1024, index);
        return `${value < 10 && index > 0 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getBaseName(fileName) {
        return String(fileName || "image").replace(/\.[^.]+$/, "") || "image";
    }

    function guessImageType(file) {
        const t = (file.type || "").toLowerCase();
        if (t === "image/jpeg" || t === "image/jpg") return "image/jpeg";
        if (t === "image/png") return "image/png";
        if (t === "image/webp") return "image/webp";
        const n = (file.name || "").toLowerCase();
        if (/\.jpe?g$/.test(n)) return "image/jpeg";
        if (/\.png$/.test(n)) return "image/png";
        if (/\.webp$/.test(n)) return "image/webp";
        return "";
    }

    function uniqueName(name, used) {
        if (!used.has(name)) {
            used.add(name);
            return name;
        }
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        let i = 2;
        let candidate;
        do {
            candidate = `${base}-${i}${ext}`;
            i += 1;
        } while (used.has(candidate));
        used.add(candidate);
        return candidate;
    }

    function probeNaturalSize(item) {
        const img = new Image();
        img.onload = () => {
            item.natW = img.naturalWidth || 0;
            item.natH = img.naturalHeight || 0;
            img.src = "";
        };
        img.onerror = () => {
            img.src = "";
        };
        img.src = item.previewURL;
    }

    function syncLockedFields() {
        if (!el.lockAspect || !el.lockAspect.checked) return;
        if (getMode() === "percent") return;
        const w = parseInt(el.widthInput?.value, 10);
        const h = parseInt(el.heightInput?.value, 10);
        const src = files.find(f => f.natW > 0 && f.natH > 0);
        const ar = src ? src.natW / src.natH : null;

        if (lastEditedDim === "width" && Number.isFinite(w) && w > 0) {
            if (ar) {
                el.heightInput.value = String(Math.max(1, Math.round(w / ar)));
            } else if (Number.isFinite(h) && h > 0) {
                el.heightInput.value = "";
            }
        } else if (lastEditedDim === "height" && Number.isFinite(h) && h > 0) {
            if (ar) {
                el.widthInput.value = String(Math.max(1, Math.round(h * ar)));
            } else if (Number.isFinite(w) && w > 0) {
                el.widthInput.value = "";
            }
        }
    }

    function paintRangeProgress(input) {
        if (!input) return;
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        const value = Number(input.value);
        const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
        input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}%`);
    }

    function getMode() {
        if (el.modeExact?.checked) return "exact";
        if (el.modePercent?.checked) return "percent";
        return "fit";
    }

    function updateModeUI() {
        const mode = getMode();
        if (el.dimRow) el.dimRow.hidden = mode === "percent";
        if (el.percentRow) el.percentRow.hidden = mode !== "percent";
        // Fit always preserves aspect — lock toggle would confuse users.
        // Must set style.display: .split-single-row { display:flex } overrides [hidden].
        const lockRow = document.getElementById("resizeLockRow");
        if (lockRow) {
            const hideLock = mode === "fit";
            lockRow.hidden = hideLock;
            lockRow.style.display = hideLock ? "none" : "";
        }
        if (mode === "fit" && el.lockAspect) el.lockAspect.checked = true;
        updateReady();
    }

    function updateQualityUI() {
        const fmt = el.formatSelect?.value || "keep";
        const needsQuality = fmt === "image/jpeg" || fmt === "image/webp" || fmt === "keep";
        // keep: quality applies only when source is jpeg/webp at encode time — still show slider
        if (el.qualityGroup) {
            el.qualityGroup.hidden = fmt === "image/png";
        }
        updateReady();
    }

    function updateReady() {
        if (!el.readyText || !el.start) return;
        if (processing) {
            el.start.disabled = true;
            return;
        }
        if (!files.length) {
            el.readyText.textContent = "Add images to resize.";
            el.start.disabled = true;
            return;
        }
        const mode = getMode();
        if (mode === "percent") {
            const p = parseFloat(el.percentInput?.value);
            if (!Number.isFinite(p) || p <= 0) {
                el.readyText.textContent = "Enter a percentage greater than 0.";
                el.start.disabled = true;
                return;
            }
            if (p > 1000) {
                el.readyText.textContent = "Percentage is too large (max 1000%).";
                el.start.disabled = true;
                return;
            }
            el.readyText.textContent = `Ready: ${files.length} image${files.length === 1 ? "" : "s"} · ${p}% scale.`;
            el.start.disabled = false;
            return;
        }
        const w = parseInt(el.widthInput?.value, 10);
        const h = parseInt(el.heightInput?.value, 10);
        const hasW = Number.isFinite(w) && w > 0;
        const hasH = Number.isFinite(h) && h > 0;
        if (!hasW && !hasH) {
            el.readyText.textContent = "Enter width and/or height in pixels.";
            el.start.disabled = true;
            return;
        }
        const label =
            mode === "fit"
                ? `Fit inside ${hasW ? w : "…"}×${hasH ? h : "…"}`
                : `Exact ${hasW ? w : "…"}×${hasH ? h : "…"}`;
        el.readyText.textContent = `Ready: ${files.length} image${files.length === 1 ? "" : "s"} · ${label}.`;
        el.start.disabled = false;
    }

    function revokePreview(item) {
        if (item?.previewURL) {
            URL.revokeObjectURL(item.previewURL);
            item.previewURL = "";
        }
    }

    function revokeProcessed() {
        processed.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        processed = [];
    }

    function setProcessingState(active) {
        processing = active;
        if (el.dropZone) {
            el.dropZone.classList.toggle("is-disabled", active);
            el.dropZone.setAttribute("aria-disabled", String(!!active));
        }
        if (el.clearButton) el.clearButton.disabled = active;
        if (el.start) el.start.disabled = active || !files.length;
        if (el.input) el.input.disabled = active;
    }

    function setProgress(completed, total, title, currentName) {
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (el.progressFill) el.progressFill.style.width = `${pct}%`;
        if (el.progressPercent) el.progressPercent.textContent = `${pct}%`;
        if (title && el.progressTitle) el.progressTitle.textContent = title;
        if (el.progressText) {
            el.progressText.textContent = currentName
                ? `${completed}/${total} · ${currentName}`
                : `${completed}/${total}`;
        }
    }

    async function decodeImage(file) {
        try {
            return await createImageBitmap(file);
        } catch (_) {
            return await createImageBitmap(file, {
                imageOrientation: "from-image"
            });
        }
    }

    function computeTargetSize(srcW, srcH, mode, opts) {
        let tw = srcW;
        let th = srcH;
        const lock = opts.lockAspect;
        const noEnlarge = opts.noEnlarge;
        const maxOut = MAX_OUTPUT_DIMENSION;

        if (mode === "percent") {
            const scale = Math.max(0.01, opts.percent / 100);
            tw = Math.max(1, Math.round(srcW * scale));
            th = Math.max(1, Math.round(srcH * scale));
        } else {
            const hasW = opts.width > 0;
            const hasH = opts.height > 0;
            if (mode === "fit") {
                if (hasW && hasH) {
                    const scale = Math.min(opts.width / srcW, opts.height / srcH);
                    const s = noEnlarge ? Math.min(1, scale) : scale;
                    tw = Math.max(1, Math.round(srcW * s));
                    th = Math.max(1, Math.round(srcH * s));
                } else if (hasW) {
                    const scale = opts.width / srcW;
                    const s = noEnlarge ? Math.min(1, scale) : scale;
                    tw = Math.max(1, Math.round(srcW * s));
                    th = Math.max(1, Math.round(srcH * s));
                } else if (hasH) {
                    const scale = opts.height / srcH;
                    const s = noEnlarge ? Math.min(1, scale) : scale;
                    tw = Math.max(1, Math.round(srcW * s));
                    th = Math.max(1, Math.round(srcH * s));
                }
            } else {
                // exact
                if (hasW && hasH) {
                    if (lock) {
                        const scale = Math.min(opts.width / srcW, opts.height / srcH);
                        const s = noEnlarge ? Math.min(1, scale) : scale;
                        tw = Math.max(1, Math.round(srcW * s));
                        th = Math.max(1, Math.round(srcH * s));
                    } else {
                        tw = opts.width;
                        th = opts.height;
                        if (noEnlarge) {
                            tw = Math.min(tw, srcW);
                            th = Math.min(th, srcH);
                        }
                    }
                } else if (hasW) {
                    const scale = opts.width / srcW;
                    const s = noEnlarge ? Math.min(1, scale) : scale;
                    tw = Math.max(1, Math.round(srcW * s));
                    th = lock
                        ? Math.max(1, Math.round(srcH * s))
                        : srcH;
                    if (!lock) tw = noEnlarge ? Math.min(opts.width, srcW) : opts.width;
                } else if (hasH) {
                    const scale = opts.height / srcH;
                    const s = noEnlarge ? Math.min(1, scale) : scale;
                    th = Math.max(1, Math.round(srcH * s));
                    tw = lock
                        ? Math.max(1, Math.round(srcW * s))
                        : srcW;
                    if (!lock) th = noEnlarge ? Math.min(opts.height, srcH) : opts.height;
                }
            }
        }

        // Clamp long side to MAX_OUTPUT_DIMENSION
        const long = Math.max(tw, th);
        if (long > maxOut) {
            const s = maxOut / long;
            tw = Math.max(1, Math.round(tw * s));
            th = Math.max(1, Math.round(th * s));
        }
        return { width: tw, height: th };
    }

    function extensionForType(mime) {
        if (mime === "image/png") return "png";
        if (mime === "image/webp") return "webp";
        return "jpg";
    }

    function resolveOutputType(file, formatChoice) {
        if (formatChoice && formatChoice !== "keep") return formatChoice;
        return guessImageType(file) || "image/jpeg";
    }

    function canvasToBlob(canvas, mime, quality) {
        return new Promise((resolve, reject) => {
            if (mime === "image/png") {
                canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Encode failed"))), mime);
            } else {
                canvas.toBlob(
                    b => (b ? resolve(b) : reject(new Error("Encode failed"))),
                    mime,
                    quality
                );
            }
        });
    }

    async function resizeOne(file, opts) {
        let bitmap;
        try {
            bitmap = await decodeImage(file);
            const srcW = bitmap.width;
            const srcH = bitmap.height;
            const pixels = srcW * srcH;
            if (
                pixels > MAX_PIXELS ||
                Math.max(srcW, srcH) > MAX_SOURCE_DIMENSION
            ) {
                throw new Error(
                    `Image too large (${srcW}×${srcH}). Max ${MAX_SOURCE_DIMENSION}px side / ${MAX_PIXELS.toLocaleString()} pixels.`
                );
            }

            const target = computeTargetSize(srcW, srcH, opts.mode, opts);
            const canvas = document.createElement("canvas");
            canvas.width = target.width;
            canvas.height = target.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas unavailable on this device.");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            // PNG transparency: clear; JPEG fill white if needed handled by browser encode
            if (opts.outputType === "image/jpeg") {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

            const quality = opts.outputType === "image/png" ? undefined : opts.quality;
            const blob = await canvasToBlob(canvas, opts.outputType, quality);
            canvas.width = 0;
            canvas.height = 0;

            return {
                blob,
                fromWidth: srcW,
                fromHeight: srcH,
                toWidth: target.width,
                toHeight: target.height,
                outputType: opts.outputType
            };
        } finally {
            if (bitmap && typeof bitmap.close === "function") {
                try {
                    bitmap.close();
                } catch (_) {
                    /* ignore */
                }
            }
        }
    }

    function renderQueue() {
        if (!el.queue) return;
        el.queue.innerHTML = files
            .map((item, index) => {
                const type = guessImageType(item.file) || "image";
                return `
                <div class="queue-item">
                    <div class="file-preview"><img src="${item.previewURL}" alt=""></div>
                    <div class="file-details">
                        <div class="file-name" title="${escapeHTML(item.file.name)}">${escapeHTML(item.file.name)}</div>
                        <div class="file-size">${formatBytes(item.file.size)} · ${type.replace("image/", "").toUpperCase()}</div>
                    </div>
                    <button type="button" class="queue-remove-btn" data-remove="${index}" aria-label="Remove">×</button>
                </div>`;
            })
            .join("");
        if (el.queueSummary) {
            el.queueSummary.textContent = `${files.length} image${files.length === 1 ? "" : "s"} uploaded`;
        }
        if (el.queuePanel) el.queuePanel.hidden = files.length === 0;
        if (el.settings) el.settings.hidden = files.length === 0;
        updateReady();
    }

    function removeFile(index) {
        if (processing) return;
        const item = files[index];
        if (!item) return;
        revokePreview(item);
        files.splice(index, 1);
        renderQueue();
        if (!files.length) {
            if (el.results) el.results.hidden = true;
            revokeProcessed();
            if (el.zip) el.zip.hidden = true;
        }
    }

    async function clearSelection(skipConfirm = false) {
        if (processing) return;
        if (!skipConfirm && files.length > 0) {
            const ok = await popupConfirm(
                "Clear images?",
                "This clears the current list and results. Original files on your device stay unchanged."
            );
            if (!ok) return;
        }
        files.forEach(revokePreview);
        files = [];
        revokeProcessed();
        if (el.input) el.input.value = "";
        if (el.resultsList) el.resultsList.innerHTML = "";
        if (el.results) el.results.hidden = true;
        if (el.zip) el.zip.hidden = true;
        if (el.progress) el.progress.hidden = true;
        renderQueue();
    }

    function addFilesInternal(fileList) {
        const list = Array.from(fileList || []);
        if (!list.length) return;
        const rejected = [];
        const valid = [];
        let running = files.reduce((s, f) => s + f.file.size, 0);

        for (const file of list) {
            if (files.length + valid.length >= MAX_FILES) {
                rejected.push(`${file.name}: maximum ${MAX_FILES} images at a time.`);
                continue;
            }
            const type = guessImageType(file);
            if (!type) {
                rejected.push(`${file.name}: only JPG, PNG, and WebP are supported.`);
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                rejected.push(`${file.name}: max ${formatBytes(MAX_FILE_SIZE)} per file.`);
                continue;
            }
            if (file.size <= 0) {
                rejected.push(`${file.name}: empty file.`);
                continue;
            }
            if (running + file.size > MAX_TOTAL_SIZE) {
                rejected.push(`${file.name}: would exceed ${formatBytes(MAX_TOTAL_SIZE)} total.`);
                continue;
            }
            // duplicate name+size
            const dup =
                files.some(f => f.file.name === file.name && f.file.size === file.size) ||
                valid.some(f => f.file.name === file.name && f.file.size === file.size);
            if (dup) {
                rejected.push(`${file.name}: already in the list.`);
                continue;
            }
            running += file.size;
            const previewURL = URL.createObjectURL(file);
            const item = { file, previewURL, natW: 0, natH: 0 };
            probeNaturalSize(item);
            valid.push(item);
        }

        if (valid.length) {
            files = files.concat(valid);
            if (el.results) el.results.hidden = true;
            revokeProcessed();
            if (el.zip) el.zip.hidden = true;
            renderQueue();
        }
        if (rejected.length) {
            popupError(
                "Some files were skipped",
                "These files could not be added:",
                rejected.slice(0, 12)
            );
        }
    }

    function addFiles(fileList) {
        addChain = addChain
            .then(() => addFilesInternal(fileList))
            .catch(err => popupError("Upload failed", err.message || "Unable to add these images."));
        return addChain;
    }

    async function startResize() {
        if (processing || !files.length) return;
        const mode = getMode();
        const width = parseInt(el.widthInput?.value, 10) || 0;
        const height = parseInt(el.heightInput?.value, 10) || 0;
        const percent = parseFloat(el.percentInput?.value) || 0;
        if (mode === "percent") {
            if (!(percent > 0)) {
                await popupError("Invalid percentage", "Enter a percentage greater than 0.");
                return;
            }
        } else if (!(width > 0 || height > 0)) {
            await popupError("Missing size", "Enter width and/or height in pixels.");
            return;
        }

        const formatChoice = el.formatSelect?.value || "keep";
        const quality = Math.min(1, Math.max(0.01, (parseInt(el.quality?.value, 10) || 80) / 100));
        const lockAspect = !!(el.lockAspect && el.lockAspect.checked);
        const noEnlarge = !!(el.noEnlarge && el.noEnlarge.checked);

        setProcessingState(true);
        revokeProcessed();
        if (el.resultsList) el.resultsList.innerHTML = "";
        if (el.results) el.results.hidden = true;
        if (el.zip) el.zip.hidden = true;
        if (el.progress) el.progress.hidden = false;
        setProgress(0, files.length, "Preparing resize", "");

        const snapshot = files.slice();
        const usedNames = new Set();
        let success = 0;
        const failed = [];

        for (let i = 0; i < snapshot.length; i++) {
            const item = snapshot[i];
            const file = item.file;
            const row = document.createElement("div");
            row.className = "result-row";
            if (el.resultsList) el.resultsList.appendChild(row);

            try {
                const outputType = resolveOutputType(file, formatChoice);
                const result = await resizeOne(file, {
                    mode,
                    width,
                    height,
                    percent,
                    lockAspect,
                    noEnlarge,
                    outputType,
                    quality
                });
                const ext = extensionForType(result.outputType);
                const name = uniqueName(`${getBaseName(file.name)}.${ext}`, usedNames);
                const url = URL.createObjectURL(result.blob);
                processed.push({ name, blob: result.blob, url });
                success += 1;
                row.innerHTML = `
                    <div class="result-preview"><img src="${item.previewURL}" alt="" loading="lazy"></div>
                    <div class="file-meta">
                        <h4>${escapeHTML(name)}</h4>
                        <span>${result.fromWidth}×${result.fromHeight} → <strong>${result.toWidth}×${result.toHeight}</strong> · ${formatBytes(file.size)} → ${formatBytes(result.blob.size)}</span>
                    </div>
                    <a href="${url}" download="${escapeHTML(name)}" class="download-link">Download</a>
                `;
            } catch (error) {
                console.error(error);
                failed.push(`${file.name}: ${error.message || "Failed"}`);
                row.classList.add("is-failed");
                row.innerHTML = `
                    <div class="result-preview"><img src="${item.previewURL}" alt="" loading="lazy"></div>
                    <div class="file-meta">
                        <h4>${escapeHTML(file.name)}</h4>
                        <span style="color:#ef4444;">${escapeHTML(error.message || "Failed to process")}</span>
                    </div>
                `;
            }
            setProgress(i + 1, snapshot.length, "Resizing images", file.name);
            await new Promise(r => setTimeout(r, 0));
        }

        if (el.progress) el.progress.hidden = true;
        if (el.resultSummary) {
            el.resultSummary.textContent = `${success} of ${snapshot.length} image${snapshot.length !== 1 ? "s" : ""} resized successfully.`;
        }
        if (el.results) el.results.hidden = false;
        if (el.zip) el.zip.hidden = processed.length < 2;
        if (failed.length) {
            await popupError("Some images failed", "These could not be resized:", failed.slice(0, 12));
        }
        el.results?.scrollIntoView({ behavior: "smooth", block: "start" });
        setProcessingState(false);
        updateReady();
    }

    async function downloadZip() {
        if (processed.length < 2) return;
        if (!window.JSZip) {
            await popupError("ZIP unavailable", "ZIP library is still loading. Wait a moment and try again.");
            return;
        }
        try {
            const zip = new window.JSZip();
            processed.forEach(item => zip.file(item.name, item.blob));
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "resized-images.zip";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (error) {
            await popupError("ZIP failed", error.message || "Could not create the ZIP file.");
        }
    }

    // Events
    el.dropZone.addEventListener("click", () => {
        if (!processing) el.input.click();
    });
    el.dropZone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!processing) el.input.click();
        }
    });
    ["dragenter", "dragover"].forEach(type => {
        el.dropZone.addEventListener(type, e => {
            e.preventDefault();
            if (!processing) el.dropZone.classList.add("is-dragover");
        });
    });
    ["dragleave", "drop"].forEach(type => {
        el.dropZone.addEventListener(type, e => {
            e.preventDefault();
            el.dropZone.classList.remove("is-dragover");
        });
    });
    el.dropZone.addEventListener("drop", e => {
        if (processing) return;
        addFiles(e.dataTransfer?.files);
    });
    el.input.addEventListener("change", () => {
        const list = Array.from(el.input.files || []);
        el.input.value = "";
        addFiles(list);
    });
    el.clearButton?.addEventListener("click", () => clearSelection(false));
    el.processMore?.addEventListener("click", async () => {
        await clearSelection(false);
        window.scrollTo(0, 0);
    });
    el.start.addEventListener("click", () => startResize());
    el.zip?.addEventListener("click", () => downloadZip());
    el.queue?.addEventListener("click", e => {
        const btn = e.target.closest("[data-remove]");
        if (!btn || processing) return;
        removeFile(parseInt(btn.getAttribute("data-remove"), 10));
    });

    [el.modeFit, el.modeExact, el.modePercent].forEach(n => {
        n?.addEventListener("change", updateModeUI);
    });
    el.widthInput?.addEventListener("input", () => {
        lastEditedDim = "width";
        if (el.lockAspect?.checked && getMode() !== "fit") syncLockedFields();
        updateReady();
    });
    el.heightInput?.addEventListener("input", () => {
        lastEditedDim = "height";
        if (el.lockAspect?.checked && getMode() !== "fit") syncLockedFields();
        updateReady();
    });
    el.percentInput?.addEventListener("input", updateReady);
    el.lockAspect?.addEventListener("change", () => {
        if (el.lockAspect.checked) syncLockedFields();
        updateReady();
    });
    el.noEnlarge?.addEventListener("change", updateReady);
    el.formatSelect?.addEventListener("change", updateQualityUI);
    el.quality?.addEventListener("input", () => {
        if (el.qualityValue) el.qualityValue.textContent = `${el.quality.value}%`;
        paintRangeProgress(el.quality);
    });
    paintRangeProgress(el.quality);

    window.addEventListener("beforeunload", e => {
        if (processing) {
            e.preventDefault();
            e.returnValue = "";
        }
        files.forEach(revokePreview);
        revokeProcessed();
    });

    updateModeUI();
    updateQualityUI();
    updateReady();
})();
