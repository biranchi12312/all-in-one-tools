(() => {
    "use strict";

    const view = document.getElementById("compressorView");
    if (!view) return;

    const MAX_FILES = 100;
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 500 * 1024 * 1024;
    const MAX_PIXELS = 40000000;
    const MAX_SOURCE_DIMENSION = 9000;
    const MAX_OUTPUT_DIMENSION = 4096;

    const el = {
        input: document.getElementById("compFileInput"),
        dropZone: document.getElementById("compDropZone"),
        queuePanel: document.getElementById("compQueuePanel"),
        queue: document.getElementById("compFileQueue"),
        queueSummary: document.getElementById("compQueueSummary"),
        clearButton: document.getElementById("compClearBtn"),
        settings: document.getElementById("compSettingsPanel"),
        quality: document.getElementById("compQualitySlider"),
        qualityValue: document.getElementById("compQualityVal"),
        count: document.getElementById("compFileCount"),
        start: document.getElementById("compStartBtn"),
        results: document.getElementById("compResultsPanel"),
        resultsList: document.getElementById("compResultsList"),
        resultSummary: document.getElementById("compResultSummary"),
        processMore: document.getElementById("compProcessMoreBtn"),
        zip: document.getElementById("compZipBtn"),
        progress: document.getElementById("compProgressPanel"),
        progressTitle: document.getElementById("compProgressTitle"),
        progressPercent: document.getElementById("compProgressPercent"),
        progressFill: document.getElementById("compProgressFill"),
        progressText: document.getElementById("compProgressText")
    };

    if (!el.input || !el.dropZone || !el.start) return;

    let files = [];
    let processed = [];
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

    function popupWarning(title, message, items) {
        const ui = dialog();
        if (ui) return ui.warning(title, message, items);
        return Promise.resolve();
    }

    async function popupConfirm(title, message) {
        const ui = dialog();
        if (ui) return ui.confirm(title, message);
        return window.confirm(`${title}\n\n${message}`);
    }

    function formatBytes(bytes) {
        if (!bytes) return "0 Bytes";
        const units = ["Bytes", "KB", "MB", "GB"];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
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

    function revokePreview(item) {
        if (item?.previewURL) URL.revokeObjectURL(item.previewURL);
    }

    function revokeProcessed() {
        processed.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        processed = [];
    }

    function setProgress(completed, total, title, name) {
        if (!el.progress) return;
        const percent = total ? Math.round((completed / total) * 100) : 0;
        el.progress.hidden = false;
        if (el.progressFill) el.progressFill.style.width = `${percent}%`;
        if (el.progressPercent) el.progressPercent.textContent = `${percent}%`;
        if (el.progressTitle) el.progressTitle.textContent = title;
        if (el.progressText) {
            el.progressText.textContent = name
                ? `${completed} of ${total} complete • ${name}`
                : `${completed} of ${total} complete`;
        }
    }

    function setProcessingState(active) {
        processing = active;
        el.start.disabled = active || files.length === 0;
        el.clearButton.disabled = active;
        el.input.disabled = active;
        el.quality.disabled = active;
        el.dropZone.classList.toggle("is-disabled", active);
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
            const row = document.createElement("div");
            row.className = "queue-item";
            row.innerHTML = `
                <div class="file-preview"><img src="${item.previewURL}" alt=""></div>
                <div class="file-details">
                    <div class="file-name" title="${escapeHTML(item.file.name)}">${escapeHTML(item.file.name)}</div>
                    <div class="file-size">${formatBytes(item.file.size)}</div>
                </div>
                <div class="upload-status"><div class="green-check">✓</div><span>Uploaded</span></div>
                <button type="button" class="queue-remove-btn" data-comp-remove="${index}" aria-label="Remove file" ${processing ? "disabled" : ""}>×</button>
            `;
            el.queue.appendChild(row);
        });

        el.queue.querySelectorAll("[data-comp-remove]").forEach(button => {
            button.addEventListener("click", () => removeFile(Number(button.dataset.compRemove)));
        });

        el.count.textContent = `${files.length} file${files.length !== 1 ? "s" : ""} ready`;
        if (!processing) el.start.disabled = files.length === 0;
    }

    function removeFile(index) {
        if (processing) return;
        const item = files[index];
        if (!item) return;
        revokePreview(item);
        files.splice(index, 1);
        renderQueue();
        if (files.length === 0) {
            el.settings.hidden = true;
            el.count.textContent = "0 files loaded";
        }
    }

    function clearResults() {
        revokeProcessed();
        el.resultsList.innerHTML = "";
        el.results.hidden = true;
        el.zip.hidden = true;
        if (el.progress) el.progress.hidden = true;
    }

    function addFilesInternal(fileList) {
        if (processing) return;
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;

        const rejected = [];
        const valid = [];
        const existingTotal = files.reduce((total, item) => total + item.file.size, 0);
        let runningTotal = existingTotal;

        for (const file of incoming) {
            const type = guessImageType(file);
            if (!type) {
                rejected.push(`${file.name}: unsupported format. Use JPG, PNG or WebP.`);
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
            if (files.length + valid.length >= MAX_FILES) {
                rejected.push(`${file.name}: maximum 100 images allowed.`);
                continue;
            }
            if (runningTotal + file.size > MAX_TOTAL_SIZE) {
                rejected.push(`${file.name}: total batch limit of 500 MB would be exceeded.`);
                continue;
            }
            valid.push({
                file,
                type,
                previewURL: URL.createObjectURL(file)
            });
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

    async function compressImage(file, quality) {
        const type = guessImageType(file) || "image/jpeg";
        const bitmap = await decodeImage(file);
        try {
            const pixels = bitmap.width * bitmap.height;
            if (
                pixels > MAX_PIXELS ||
                Math.max(bitmap.width, bitmap.height) > MAX_SOURCE_DIMENSION
            ) {
                throw new Error("Image resolution is too large for safe browser-side compression on this device.");
            }

            let width = bitmap.width;
            let height = bitmap.height;
            const longestSide = Math.max(width, height);
            let resized = false;
            if (longestSide > MAX_OUTPUT_DIMENSION) {
                const ratio = MAX_OUTPUT_DIMENSION / longestSide;
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                resized = true;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d", { alpha: true });
            if (!context) throw new Error("Canvas processing is unavailable in this browser.");
            context.drawImage(bitmap, 0, 0, width, height);

            const outputType = type === "image/jpg" ? "image/jpeg" : type;
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    result => result ? resolve(result) : reject(new Error("Compression failed")),
                    outputType,
                    outputType === "image/png" ? undefined : quality
                );
            });

            let usedBlob = blob;
            let keptOriginal = false;
            if (blob.size >= file.size) {
                usedBlob = file;
                keptOriginal = true;
            }

            let extension = outputType.split("/")[1];
            if (extension === "jpeg") extension = "jpg";

            const outputName = keptOriginal
                ? file.name
                : `${getBaseName(file.name)}_compressed.${extension}`;

            return {
                blob: usedBlob,
                name: outputName,
                resized,
                keptOriginal,
                fromWidth: bitmap.width,
                fromHeight: bitmap.height,
                toWidth: width,
                toHeight: height
            };
        } finally {
            bitmap.close();
        }
    }

    async function resetCompressor(skipConfirm = false) {
        if (processing) return;
        if (!skipConfirm && files.length > 0) {
            const confirmed = await popupConfirm(
                "Clear compressed files?",
                "This clears the current image list. Original files on your device stay unchanged."
            );
            if (!confirmed) return;
        }
        revokeProcessed();
        files.forEach(revokePreview);
        files = [];
        el.input.value = "";
        el.resultsList.innerHTML = "";
        el.results.hidden = true;
        el.zip.hidden = true;
        el.settings.hidden = true;
        if (el.progress) el.progress.hidden = true;
        renderQueue();
        el.count.textContent = "0 files loaded";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

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

    el.clearButton.addEventListener("click", () => resetCompressor(false));
    el.processMore.addEventListener("click", () => resetCompressor(true));

    el.quality.addEventListener("input", event => {
        el.qualityValue.textContent = `${event.target.value}%`;
        paintRangeProgress(event.target);
    });
    paintRangeProgress(el.quality);

    el.start.addEventListener("click", async () => {
        if (processing || files.length === 0) return;

        revokeProcessed();
        el.resultsList.innerHTML = "";
        const snapshot = [...files];
        const quality = Number(el.quality.value) / 100;
        const usedNames = new Set();
        let successCount = 0;
        let resizedCount = 0;
        let keptOriginalCount = 0;
        const failedNames = [];

        el.results.hidden = false;
        el.zip.hidden = true;
        el.start.textContent = "Compressing...";
        setProcessingState(true);
        setProgress(0, snapshot.length, "Starting compression");

        try {
            for (let index = 0; index < snapshot.length; index++) {
                const item = snapshot[index];
                const file = item.file;
                const row = document.createElement("div");
                row.className = "result-row";
                row.innerHTML = `
                    <div class="result-preview"><img src="${item.previewURL}" alt=""></div>
                    <div class="file-meta">
                        <h4>${escapeHTML(file.name)}</h4>
                        <span>Compressing ${index + 1} / ${snapshot.length}...</span>
                    </div>
                `;
                el.resultsList.appendChild(row);
                setProgress(index, snapshot.length, "Compressing images", file.name);

                try {
                    const result = await compressImage(file, quality);
                    const name = uniqueName(result.name, usedNames);
                    const url = URL.createObjectURL(result.blob);
                    processed.push({ name, blob: result.blob, url });
                    successCount += 1;
                    if (result.resized) resizedCount += 1;
                    if (result.keptOriginal) keptOriginalCount += 1;

                    const originalSize = formatBytes(file.size);
                    const newSize = formatBytes(result.blob.size);
                    const delta = result.blob.size - file.size;
                    const percent = file.size > 0 ? Math.round(Math.abs(delta / file.size) * 100) : 0;
                    const sizeText = delta < 0
                        ? `${percent}% smaller`
                        : delta > 0
                            ? `${percent}% larger`
                            : "Same size";
                    const notes = [];
                    if (result.keptOriginal) notes.push("Original kept — compressed file was not smaller");
                    if (result.resized) notes.push(`Resized ${result.fromWidth}×${result.fromHeight} → ${result.toWidth}×${result.toHeight}`);

                    row.innerHTML = `
                        <div class="result-preview"><img src="${item.previewURL}" alt=""></div>
                        <div class="file-meta">
                            <h4>${escapeHTML(name)}</h4>
                            <span>${originalSize} → <strong>${newSize}</strong> • ${sizeText}${notes.length ? ` • ${notes.join(" • ")}` : ""}</span>
                        </div>
                        <a href="${url}" download="${escapeHTML(name)}" class="download-link">Download</a>
                    `;
                } catch (error) {
                    console.error(error);
                    failedNames.push(`${file.name}: ${error.message || "Failed to process"}`);
                    row.classList.add("is-failed");
                    row.innerHTML = `
                        <div class="result-preview"><img src="${item.previewURL}" alt=""></div>
                        <div class="file-meta">
                            <h4>${escapeHTML(file.name)}</h4>
                            <span style="color:#ef4444;">${escapeHTML(error.message || "Failed to process")}</span>
                        </div>
                    `;
                }

                setProgress(index + 1, snapshot.length, "Compressing images", file.name);
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            el.resultSummary.textContent =
                `${successCount} of ${snapshot.length} image${snapshot.length !== 1 ? "s" : ""} processed successfully.`;
            if (processed.length > 0) el.zip.hidden = false;
            if (el.progressTitle) el.progressTitle.textContent = "Compression complete";
            el.results.scrollIntoView({ behavior: "smooth", block: "start" });

            if (failedNames.length) {
                await popupError(
                    failedNames.length === 1 ? "1 image failed" : `${failedNames.length} images failed`,
                    "Some images could not be compressed. Details are also shown in the results list.",
                    failedNames.slice(0, 12)
                );
            }

            const notices = [];
            if (resizedCount) notices.push(`${resizedCount} image${resizedCount === 1 ? " was" : "s were"} resized to a 4096px max edge so this browser can process them safely.`);
            if (keptOriginalCount) notices.push(`${keptOriginalCount} image${keptOriginalCount === 1 ? "" : "s"} stayed original because compression did not reduce the file size.`);
            if (notices.length) {
                await popupWarning("Compression notes", notices.join(" "), []);
            }
        } finally {
            el.start.textContent = "Compress Images";
            setProcessingState(false);
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
            anchor.download = "AuraStudio_Compressed_Images.zip";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
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
})();
