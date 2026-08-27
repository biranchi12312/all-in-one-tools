(() => {
    "use strict";

    const view = document.getElementById("converterView");
    if (!view) return;

    const MAX_FILES = 100;
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 500 * 1024 * 1024;
    const MAX_PIXELS = 40000000;
    const MAX_DIMENSION = 9000;

    const el = {
        input: document.getElementById("convFileInput"),
        dropZone: document.getElementById("convDropZone"),
        queuePanel: document.getElementById("convQueuePanel"),
        queue: document.getElementById("convFileQueue"),
        queueSummary: document.getElementById("convQueueSummary"),
        clearButton: document.getElementById("convClearBtn"),
        settings: document.getElementById("convSettingsPanel"),
        sourceList: document.getElementById("sourceFormatList"),
        targetList: document.getElementById("targetFormatList"),
        formatSummary: document.getElementById("convFormatSummary"),
        formatNote: document.getElementById("convFormatNote"),
        qualityGroup: document.getElementById("convQualityGroup"),
        quality: document.getElementById("convQualitySlider"),
        qualityValue: document.getElementById("convQualityVal"),
        jpgBackgroundGroup: document.getElementById("convJpgBackgroundGroup"),
        customBackground: document.getElementById("convCustomBackground"),
        readySummary: document.getElementById("convReadySummary"),
        progress: document.getElementById("convProgressPanel"),
        progressTitle: document.getElementById("convProgressTitle"),
        progressPercent: document.getElementById("convProgressPercent"),
        progressFill: document.getElementById("convProgressFill"),
        progressText: document.getElementById("convProgressText"),
        count: document.getElementById("convFileCount"),
        start: document.getElementById("convStartBtn"),
        results: document.getElementById("convResultsPanel"),
        resultsList: document.getElementById("convResultsList"),
        resultSummary: document.getElementById("convResultSummary"),
        processMore: document.getElementById("convProcessMoreBtn"),
        zip: document.getElementById("convZipBtn")
    };

    if (!el.input || !el.dropZone || !el.start || !el.sourceList) return;

    const FORMAT_NAMES = {
        auto: "AUTO DETECT",
        "image/jpeg": "JPEG / JPG",
        "image/png": "PNG",
        "image/webp": "WEBP"
    };

    const FORMAT_ACCEPT = {
        auto: "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
        "image/jpeg": "image/jpeg,image/jpg,.jpg,.jpeg",
        "image/png": "image/png,.png",
        "image/webp": "image/webp,.webp"
    };

    let files = [];
    let processed = [];
    let sourceFormat = "auto";
    let targetFormat = "image/webp";
    let jpgBackground = "#ffffff";
    let processing = false;
    let addChain = Promise.resolve();

    function dialog() {
        return window.AuraDialog || null;
    }

    function popupError(title, message, items) {
        const ui = dialog();
        if (ui) return ui.error(title, message, items);
        alert([title, message, ...(items || [])].filter(Boolean).join("\n"));
        return Promise.resolve();
    }

    async function popupConfirm(title, message) {
        const ui = dialog();
        if (ui) return ui.confirm(title, message);
        return window.confirm(`${title}\n\n${message}`);
    }

    function formatBytes(bytes) {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n <= 0) return "0 Bytes";
        const units = ["Bytes", "KB", "MB", "GB"];
        const index = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
        return `${(n / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
    }

    function escapeHTML(value) {
        const map = {
            "&": "\u0026amp;",
            "<": "\u0026lt;",
            ">": "\u0026gt;",
            '"': "\u0026#34;",
            "'": "\u0026#39;"
        };
        return String(value).replace(/[&<>"']/g, ch => map[ch]);
    }

    function getBaseName(fileName) {
        const lastDot = fileName.lastIndexOf(".");
        return lastDot === -1 ? fileName : fileName.substring(0, lastDot);
    }

    function guessImageType(file) {
        const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
        if (type === "image/jpeg" || type === "image/png" || type === "image/webp") return type;
        const name = file.name.toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        return null;
    }

    function uniqueName(name, used) {
        if (!used.has(name)) {
            used.add(name);
            return name;
        }
        const lastDot = name.lastIndexOf(".");
        const stem = lastDot === -1 ? name : name.slice(0, lastDot);
        const ext = lastDot === -1 ? "" : name.slice(lastDot);
        let index = 2;
        let candidate = `${stem} (${index})${ext}`;
        while (used.has(candidate)) {
            index += 1;
            candidate = `${stem} (${index})${ext}`;
        }
        used.add(candidate);
        return candidate;
    }

    function paintRangeProgress(input) {
        if (!input) return;
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        const value = Number(input.value);
        const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
        input.style.setProperty("--range-progress", `${Math.max(0, Math.min(100, percent))}%`);
    }

    async function decodeImage(file) {
        try {
            return await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch (_) {
            return createImageBitmap(file);
        }
    }

    function sourceMatches(file) {
        const type = guessImageType(file);
        return sourceFormat === "auto" || type === sourceFormat;
    }

    function revokePreview(item) {
        if (item?.previewURL) URL.revokeObjectURL(item.previewURL);
    }

    function revokeProcessed() {
        processed.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        processed = [];
    }

    function clearResults() {
        revokeProcessed();
        el.resultsList.innerHTML = "";
        el.results.hidden = true;
        el.zip.hidden = true;
        el.progress.hidden = true;
    }

    function setProcessingState(active) {
        processing = active;
        window.__auraProcessing = !!active;
        el.start.disabled = active || files.length === 0;
        el.clearButton.disabled = active;
        el.input.disabled = active;
        el.quality.disabled = active;
        if (el.customBackground) el.customBackground.disabled = active;
        el.sourceList.querySelectorAll("button").forEach(button => {
            button.disabled = active || button.classList.contains("is-disabled");
        });
        el.targetList.querySelectorAll("button").forEach(button => {
            button.disabled = active || button.classList.contains("is-disabled");
        });
        document.querySelectorAll(".background-option[data-bg]").forEach(button => {
            button.disabled = active;
        });
        el.dropZone.classList.toggle("is-disabled", active);
    }

    function updateReadyState() {
        const alreadyTarget = files.filter(item => guessImageType(item.file) === targetFormat).length;
        const willConvert = files.length - alreadyTarget;
        el.readySummary.textContent = `${willConvert} to convert${alreadyTarget ? ` • ${alreadyTarget} already target` : ""}`;
        el.count.textContent = `${files.length} file${files.length !== 1 ? "s" : ""} loaded • ${willConvert} ready to convert`;
        if (!processing) {
            el.start.disabled = files.length === 0 || (sourceFormat !== "auto" && sourceFormat === targetFormat);
        }
    }

    function updateFormatUI() {
        el.sourceList.querySelectorAll("[data-source-format]").forEach(button => {
            button.classList.toggle("selected", button.dataset.sourceFormat === sourceFormat);
        });
        el.targetList.querySelectorAll("[data-target-format]").forEach(button => {
            button.classList.toggle("selected", button.dataset.targetFormat === targetFormat);
        });

        el.input.accept = FORMAT_ACCEPT[sourceFormat];
        el.formatSummary.innerHTML = `${FORMAT_NAMES[sourceFormat]} <span>→</span> ${FORMAT_NAMES[targetFormat]}`;

        if (sourceFormat === "auto") {
            el.formatNote.textContent = "Auto Detect accepts a mixed batch of currently supported JPG, PNG and WebP images.";
        } else {
            el.formatNote.textContent = `Upload filter is set to ${FORMAT_NAMES[sourceFormat]}. The actual image type is still verified.`;
        }

        const usesQuality = targetFormat === "image/jpeg" || targetFormat === "image/webp";
        el.qualityGroup.hidden = !usesQuality;
        el.jpgBackgroundGroup.hidden = targetFormat !== "image/jpeg";

        const sameManualFormat = sourceFormat !== "auto" && sourceFormat === targetFormat;
        if (!processing) {
            el.start.disabled = sameManualFormat || files.length === 0;
            el.start.textContent = sameManualFormat ? "Choose a Different Output Format" : "Convert Images";
        }

        if (sameManualFormat) {
            el.count.textContent = "Source and output formats are the same.";
        } else if (files.length === 0) {
            el.count.textContent = "0 files loaded";
        } else {
            updateReadyState();
        }
    }

    function renderQueue() {
        el.queue.innerHTML = "";
        if (files.length === 0) {
            el.queuePanel.hidden = true;
            return;
        }
        el.queuePanel.hidden = false;
        const totalSize = files.reduce((total, item) => total + item.file.size, 0);
        el.queueSummary.textContent =
            `${files.length} image${files.length !== 1 ? "s" : ""} uploaded • ${formatBytes(totalSize)}`;

        files.forEach((item, index) => {
            const type = guessImageType(item.file);
            const row = document.createElement("div");
            row.className = "queue-item";
            row.innerHTML = `
                <div class="file-preview"><img src="${item.previewURL}" alt=""></div>
                <div class="file-details">
                    <div class="file-name" title="${escapeHTML(item.file.name)}">${escapeHTML(item.file.name)}</div>
                    <div class="file-size">${formatBytes(item.file.size)} • ${FORMAT_NAMES[type] || "IMAGE"}</div>
                </div>
                <div class="upload-status"><div class="green-check">✓</div><span>Uploaded</span></div>
                <button type="button" class="queue-remove-btn" data-conv-remove="${index}" aria-label="Remove file" ${processing ? "disabled" : ""}>×</button>
            `;
            el.queue.appendChild(row);
        });

        el.queue.querySelectorAll("[data-conv-remove]").forEach(button => {
            button.addEventListener("click", () => removeFile(Number(button.dataset.convRemove)));
        });
        updateReadyState();
    }

    function removeFile(index) {
        if (processing) return;
        const item = files[index];
        if (!item) return;
        revokePreview(item);
        files.splice(index, 1);
        renderQueue();
        if (files.length === 0) el.settings.hidden = true;
        updateFormatUI();
    }

    async function clearSelection(skipConfirm = false) {
        if (processing) return;
        if (!skipConfirm && files.length > 0) {
            const confirmed = await popupConfirm(
                "Clear converted files?",
                "This clears the current image list. Original files on your device stay unchanged."
            );
            if (!confirmed) return;
        }
        files.forEach(revokePreview);
        revokeProcessed();
        files = [];
        el.input.value = "";
        el.resultsList.innerHTML = "";
        el.results.hidden = true;
        el.zip.hidden = true;
        el.settings.hidden = true;
        el.progress.hidden = true;
        renderQueue();
        updateFormatUI();
    }

    function addFilesInternal(fileList) {
        if (processing) return;
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;

        const rejected = [];
        const validCandidates = [];

        for (const file of incoming) {
            const type = guessImageType(file);
            if (!type) {
                rejected.push(`${file.name}: unsupported format. Use JPG, PNG or WebP.`);
                continue;
            }
            if (!sourceMatches(file)) {
                rejected.push(`${file.name}: does not match ${FORMAT_NAMES[sourceFormat]}.`);
                continue;
            }
            if (!file.size) {
                rejected.push(`${file.name}: this file is empty.`);
                continue;
            }
            if (file.size > MAX_FILE_SIZE) {
                rejected.push(`${file.name}: larger than 100 MB.`);
                continue;
            }
            validCandidates.push(file);
        }

        const existingTotal = files.reduce((total, item) => total + item.file.size, 0);
        let runningTotal = existingTotal;
        const valid = [];

        for (const file of validCandidates) {
            if (files.length + valid.length >= MAX_FILES) {
                rejected.push(`${file.name}: maximum 100 images allowed.`);
                continue;
            }
            if (runningTotal + file.size > MAX_TOTAL_SIZE) {
                rejected.push(`${file.name}: total batch limit of 500 MB would be exceeded.`);
                continue;
            }
            valid.push({ file, previewURL: URL.createObjectURL(file) });
            runningTotal += file.size;
        }

        if (rejected.length) {
            popupError(
                rejected.length === 1 ? "File could not be added" : "Some files could not be added",
                rejected.length === 1 ? "This image was skipped." : `${rejected.length} images were skipped.`,
                rejected
            );
        }

        if (!valid.length) {
            el.input.value = "";
            return;
        }

        if (processed.length > 0) clearResults();
        files = [...files, ...valid];
        el.settings.hidden = false;
        renderQueue();
        updateFormatUI();
        el.input.value = "";
    }

    function addFiles(fileList) {
        addChain = addChain
            .then(() => addFilesInternal(fileList))
            .catch(error => {
                popupError("Upload failed", error.message || "Unable to add these images.");
            });
        return addChain;
    }

    function setProgress(completed, total, statusText, currentName = "") {
        const percent = total ? Math.round((completed / total) * 100) : 0;
        el.progress.hidden = false;
        el.progressFill.style.width = `${percent}%`;
        el.progressPercent.textContent = `${percent}%`;
        el.progressTitle.textContent = statusText;
        el.progressText.textContent = currentName
            ? `${completed} of ${total} complete • ${currentName}`
            : `${completed} of ${total} complete`;
    }

    function clampQuality(value) {
        return Math.max(0.02, Math.min(1, Number(value)));
    }

    function canvasToBlob(canvas, format, quality) {
        return new Promise((resolve, reject) => {
            // PNG ignores quality; JPEG/WebP get an explicit clamped value (Safari-safe)
            const q = format === "image/png" ? undefined : clampQuality(quality);
            canvas.toBlob(
                result => result
                    ? resolve(result)
                    : reject(new Error("The browser could not create the selected output format.")),
                format,
                q
            );
        });
    }

    async function encodeWithSmartSizeGuard(canvas, sourceType, format, requestedQuality, originalSize) {
        if (format === "image/png") {
            return {
                blob: await canvasToBlob(canvas, format, undefined),
                smartGuardAdjusted: false
            };
        }

        const requested = clampQuality(requestedQuality);
        const firstBlob = await canvasToBlob(canvas, format, requested);
        const needsGuard =
            ["image/jpeg", "image/webp"].includes(sourceType) &&
            ["image/jpeg", "image/webp"].includes(format) &&
            sourceType !== format;

        if (!needsGuard || !originalSize || firstBlob.size <= originalSize) {
            return { blob: firstBlob, smartGuardAdjusted: false };
        }

        let bestBlob = firstBlob;
        let highQuality = requested;
        let lowQuality = 0.02;
        const lowBlob = await canvasToBlob(canvas, format, lowQuality);

        if (lowBlob.size <= originalSize) {
            let fittingBlob = lowBlob;
            for (let attempt = 0; attempt < 4; attempt++) {
                const midQuality = (lowQuality + highQuality) / 2;
                const midBlob = await canvasToBlob(canvas, format, midQuality);
                if (midBlob.size <= originalSize) {
                    lowQuality = midQuality;
                    fittingBlob = midBlob;
                } else {
                    highQuality = midQuality;
                }
            }
            bestBlob = fittingBlob;
        } else {
            // Keep requested quality rather than returning a 2% "smallest" mash
            bestBlob = firstBlob;
        }

        return { blob: bestBlob, smartGuardAdjusted: true };
    }

    async function convertImage(file, format, quality, background) {
        const bitmap = await decodeImage(file);
        let canvas = null;
        try {
            const pixels = bitmap.width * bitmap.height;
            if (
                pixels > MAX_PIXELS ||
                Math.max(bitmap.width, bitmap.height) > MAX_DIMENSION
            ) {
                throw new Error("Image resolution is too large for safe browser-side conversion on this device.");
            }

            canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext("2d", { alpha: format !== "image/jpeg" });
            if (!context) throw new Error("Canvas processing is unavailable in this browser.");

            if (format === "image/jpeg") {
                context.fillStyle = background || "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(bitmap, 0, 0);

            const encoded = await encodeWithSmartSizeGuard(
                canvas,
                guessImageType(file),
                format,
                quality,
                file.size
            );

            let extension = format.split("/")[1];
            if (extension === "jpeg") extension = "jpg";

            return {
                blob: encoded.blob,
                name: `${getBaseName(file.name)}_converted.${extension}`,
                smartGuardAdjusted: encoded.smartGuardAdjusted
            };
        } finally {
            // Release decode + canvas GPU/CPU memory promptly (helps iOS Safari)
            try {
                bitmap.close();
            } catch (_) {}
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }
        }
    }

    function formatDelta(original, output) {
        if (!original) return { text: "", className: "" };
        const percent = Math.round(Math.abs((output - original) / original) * 100);
        if (output < original) return { text: `${percent}% smaller`, className: "positive" };
        if (output > original) return { text: `${percent}% larger`, className: "negative" };
        return { text: "Same size", className: "" };
    }

    el.sourceList.querySelectorAll("[data-source-format]").forEach(button => {
        button.addEventListener("click", async () => {
            if (processing) return;
            const nextFormat = button.dataset.sourceFormat;
            if (nextFormat === sourceFormat) return;
            if (files.length > 0 && nextFormat !== "auto") {
                const incompatible = files.some(item => guessImageType(item.file) !== nextFormat);
                if (incompatible) {
                    const confirmed = await popupConfirm(
                        "Change source format?",
                        "Some uploaded files do not match this format. The current list will be cleared."
                    );
                    if (!confirmed) return;
                    files.forEach(revokePreview);
                    files = [];
                    renderQueue();
                    el.settings.hidden = true;
                }
            }
            sourceFormat = nextFormat;
            updateFormatUI();
        });
    });

    el.targetList.querySelectorAll("[data-target-format]").forEach(button => {
        button.addEventListener("click", () => {
            if (processing) return;
            targetFormat = button.dataset.targetFormat;
            updateFormatUI();
        });
    });

    el.quality.addEventListener("input", event => {
        el.qualityValue.textContent = `${event.target.value}%`;
        paintRangeProgress(event.target);
    });
    paintRangeProgress(el.quality);

    document.querySelectorAll(".background-option[data-bg]").forEach(button => {
        button.addEventListener("click", () => {
            jpgBackground = button.dataset.bg;
            document.querySelectorAll(".background-option[data-bg]").forEach(item => item.classList.remove("selected"));
            document.querySelector(".custom-background-option")?.classList.remove("selected");
            button.classList.add("selected");
        });
    });

    el.customBackground?.addEventListener("input", event => {
        jpgBackground = event.target.value;
        document.querySelectorAll(".background-option[data-bg]").forEach(item => item.classList.remove("selected"));
        document.querySelector(".custom-background-option")?.classList.add("selected");
    });

    el.input.addEventListener("change", event => addFiles(event.target.files));
    el.dropZone.addEventListener("click", () => {
        if (!processing) el.input.click();
    });
    el.dropZone.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!processing) el.input.click();
        }
    });

    ["dragenter", "dragover"].forEach(type => {
        el.dropZone.addEventListener(type, event => {
            event.preventDefault();
            event.stopPropagation();
            if (!processing) el.dropZone.classList.add("drag-over");
        });
    });
    ["dragleave", "drop"].forEach(type => {
        el.dropZone.addEventListener(type, event => {
            event.preventDefault();
            event.stopPropagation();
            el.dropZone.classList.remove("drag-over");
        });
    });
    el.dropZone.addEventListener("drop", event => {
        if (!processing) addFiles(event.dataTransfer?.files);
    });

    el.clearButton.addEventListener("click", () => clearSelection(false));
    el.processMore.addEventListener("click", async () => {
        await clearSelection(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    el.start.addEventListener("click", async () => {
        if (processing || files.length === 0) return;
        if (sourceFormat !== "auto" && sourceFormat === targetFormat) {
            await popupError("Choose a different output", "Source and output formats are the same.");
            return;
        }

        revokeProcessed();
        el.resultsList.innerHTML = "";
        el.results.hidden = false;
        el.zip.hidden = true;

        const snapshot = [...files];
        const targetSnapshot = targetFormat;
        const qualitySnapshot = Number(el.quality.value) / 100;
        const backgroundSnapshot = jpgBackground;
        const usedNames = new Set();
        const rows = snapshot.map(item => {
            const row = document.createElement("div");
            row.className = "result-row converter-result-row";
            row.innerHTML = `
                <div class="result-preview"><img src="${item.previewURL}" alt=""></div>
                <div class="file-meta"><h4>${escapeHTML(item.file.name)}</h4><span>Waiting to convert...</span></div>
            `;
            el.resultsList.appendChild(row);
            return row;
        });

        let successCount = 0;
        let skippedCount = 0;
        let completed = 0;
        let smartGuardCount = 0;
        const failedNames = [];

        el.start.textContent = "Converting...";
        setProcessingState(true);
        setProgress(0, snapshot.length, "Starting conversion");

        try {
            for (let index = 0; index < snapshot.length; index++) {
                const item = snapshot[index];
                const file = item.file;
                const row = rows[index];
                const actualType = guessImageType(file);
                setProgress(completed, snapshot.length, "Converting images", file.name);

                if (actualType === targetSnapshot) {
                    skippedCount += 1;
                    completed += 1;
                    row.classList.add("is-skipped");
                    row.querySelector(".file-meta").innerHTML = `
                        <h4>${escapeHTML(file.name)}</h4>
                        <div class="result-status skipped">↷ Already ${FORMAT_NAMES[targetSnapshot]} — skipped</div>
                        <div class="result-comparison"><span>No format change required</span></div>
                    `;
                    continue;
                }

                row.querySelector(".file-meta").innerHTML =
                    `<h4>${escapeHTML(file.name)}</h4><span>Converting ${index + 1} / ${snapshot.length}...</span>`;

                try {
                    const result = await convertImage(file, targetSnapshot, qualitySnapshot, backgroundSnapshot);
                    const name = uniqueName(result.name, usedNames);
                    const url = URL.createObjectURL(result.blob);
                    processed.push({ name, blob: result.blob, url });
                    successCount += 1;
                    completed += 1;
                    if (result.smartGuardAdjusted) smartGuardCount += 1;

                    const delta = formatDelta(file.size, result.blob.size);
                    const smartGuardNote = result.smartGuardAdjusted
                        ? `<span class="result-smart-guard">Smart Size Guard adjusted output</span>`
                        : "";

                    row.querySelector(".file-meta").innerHTML = `
                        <h4>${escapeHTML(name)}</h4>
                        <div class="result-status">✓ Converted successfully</div>
                        <div class="result-comparison">
                            <span>Original: <strong>${formatBytes(file.size)}</strong></span>
                            <span>→</span>
                            <span>Output: <strong>${formatBytes(result.blob.size)}</strong></span>
                            <span class="result-delta ${delta.className}">${delta.text}</span>
                            ${smartGuardNote}
                        </div>
                    `;
                    const download = document.createElement("a");
                    download.href = url;
                    download.download = name;
                    download.className = "download-link";
                    download.textContent = "Download";
                    row.appendChild(download);
                } catch (error) {
                    console.error(error);
                    completed += 1;
                    failedNames.push(`${file.name}: ${error.message || "This image could not be converted safely."}`);
                    row.classList.add("is-failed");
                    row.querySelector(".file-meta").innerHTML = `
                        <h4>${escapeHTML(file.name)}</h4>
                        <div class="result-status failed">Failed conversion</div>
                        <div class="result-comparison"><span>${escapeHTML(error.message || "This image could not be converted safely.")}</span></div>
                    `;
                }

                setProgress(
                    completed,
                    snapshot.length,
                    completed === snapshot.length ? "Finalizing results" : "Converting images",
                    file.name
                );
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            el.progressTitle.textContent = "Conversion complete";
            el.progressText.textContent = `${completed} of ${snapshot.length} files processed.`;

            const summaryParts = [`${successCount} converted successfully`];
            if (skippedCount) summaryParts.push(`${skippedCount} already in target format`);
            const failedCount = snapshot.length - successCount - skippedCount;
            if (failedCount) summaryParts.push(`${failedCount} failed`);
            el.resultSummary.textContent = summaryParts.join(" • ");

            if (processed.length > 0) el.zip.hidden = false;
            el.results.scrollIntoView({ behavior: "smooth", block: "start" });

            if (failedNames.length) {
                await popupError(
                    failedNames.length === 1 ? "1 image failed" : `${failedNames.length} images failed`,
                    "Some images could not be converted. Details are also shown in the results list.",
                    failedNames.slice(0, 12)
                );
            } else if (successCount === 0 && skippedCount > 0) {
                await popupError(
                    "Nothing to convert",
                    "Every selected image is already in the target format. Choose a different output format to continue."
                );
            } else if (smartGuardCount > 0) {
                const ui = dialog();
                if (ui) {
                    await ui.warning(
                        "Smart Size Guard",
                        `${smartGuardCount} image${smartGuardCount === 1 ? "" : "s"} had output quality adjusted so the converted file stayed closer to the original size.`
                    );
                }
            }
        } finally {
            el.start.textContent = "Convert Images";
            setProcessingState(false);
            updateFormatUI();
        }
    });

    el.zip.addEventListener("click", async () => {
        if (!processed.length) return;
        if (typeof JSZip === "undefined") {
            await popupError("ZIP unavailable", "The ZIP library could not be loaded. Check your connection and try again.");
            return;
        }
        const originalText = el.zip.textContent;
        el.zip.disabled = true;
        el.zip.textContent = "Creating ZIP...";
        try {
            const zip = new JSZip();
            processed.forEach(item => zip.file(item.name, item.blob));
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipBlob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "AuraStudio_Converted_Images.zip";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            // Longer delay so slow devices can start the download before revoke
            setTimeout(() => URL.revokeObjectURL(url), 8000);
        } catch (error) {
            console.error(error);
            await popupError("ZIP failed", "Could not create the ZIP archive.");
        } finally {
            el.zip.disabled = false;
            el.zip.textContent = originalText;
        }
    });

    window.addEventListener("beforeunload", event => {
        if (processing) {
            event.preventDefault();
            event.returnValue = "";
        }
    });

    updateFormatUI();
})();
