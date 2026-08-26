(() => {
    "use strict";

    const view = document.getElementById("pdfMergeView");
    if (!view) return;

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_FILES = 20;
    const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
    const MAX_TOTAL_PAGES = 500;
    const LARGE_FILE_WARNING = 75 * 1024 * 1024;
    const LARGE_SIZE_WARNING = 150 * 1024 * 1024;
    const LARGE_PAGE_WARNING = 300;
    const PDFJS_WORKER =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const el = {
        dropZone: document.getElementById("pdfMergeDropZone"),
        input: document.getElementById("pdfMergeFileInput"),
        queuePanel: document.getElementById("pdfMergeQueuePanel"),
        queue: document.getElementById("pdfMergeFileQueue"),
        queueSummary: document.getElementById("pdfMergeQueueSummary"),
        clear: document.getElementById("pdfMergeClearBtn"),
        totalFiles: document.getElementById("pdfMergeTotalFiles"),
        totalSize: document.getElementById("pdfMergeTotalSize"),
        totalPages: document.getElementById("pdfMergeTotalPages"),
        capacity: document.getElementById("pdfMergeCapacity"),
        settings: document.getElementById("pdfMergeSettingsPanel"),
        outputName: document.getElementById("pdfMergeOutputName"),
        readyText: document.getElementById("pdfMergeReadyText"),
        start: document.getElementById("pdfMergeStartBtn"),
        processing: document.getElementById("pdfMergeProcessingPanel"),
        progressTitle: document.getElementById("pdfMergeProgressTitle"),
        progressText: document.getElementById("pdfMergeProgressText"),
        progressFill: document.getElementById("pdfMergeProgressFill"),
        progressPercent: document.getElementById("pdfMergeProgressPercent"),
        results: document.getElementById("pdfMergeResultsPanel"),
        resultName: document.getElementById("pdfMergeResultName"),
        resultFiles: document.getElementById("pdfMergeResultFiles"),
        resultPages: document.getElementById("pdfMergeResultPages"),
        resultSize: document.getElementById("pdfMergeResultSize"),
        download: document.getElementById("pdfMergeDownloadBtn"),
        preview: document.getElementById("pdfMergePreviewBtn"),
        mergeMore: document.getElementById("pdfMergeMoreBtn")
    };

    if (!el.dropZone || !el.input || !el.queue || !el.start) return;

    let files = [];
    let outputBlobUrl = null;
    let processing = false;
    let addChain = Promise.resolve();
    let warningDismissed = false;
    let draggedId = null;
    let touchDrag = null;

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
        if (!bytes) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );
        const value = bytes / Math.pow(1024, index);
        return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
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

    function yieldToUI() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function totals() {
        return files.reduce((result, item) => {
            result.size += item.file.size;
            result.pages += item.pages;
            return result;
        }, { size: 0, pages: 0 });
    }

    function ensurePdfJs() {
        if (!window.pdfjsLib) {
            throw new Error("PDF reader library could not be loaded. Check your connection and reload the page.");
        }
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        }
    }

    function ensurePdfLib() {
        if (!window.PDFLib?.PDFDocument) {
            throw new Error("PDF merge library could not be loaded. Check your connection and reload the page.");
        }
    }

    function waitForPdfJs(timeoutMs) {
        const limit = timeoutMs || 15000;
        if (window.pdfjsLib) {
            ensurePdfJs();
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.pdfjsLib) {
                    clearInterval(timer);
                    try {
                        ensurePdfJs();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                    return;
                }
                if (Date.now() - start > limit) {
                    clearInterval(timer);
                    reject(
                        new Error(
                            "PDF reader is still loading. Check your connection, wait a moment, and try again."
                        )
                    );
                }
            }, 100);
        });
    }

    function waitForPdfLib(timeoutMs) {
        const limit = timeoutMs || 15000;
        if (window.PDFLib?.PDFDocument) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.PDFLib?.PDFDocument) {
                    clearInterval(timer);
                    resolve();
                    return;
                }
                if (Date.now() - start > limit) {
                    clearInterval(timer);
                    reject(
                        new Error(
                            "PDF merge library is still loading. Check your connection, wait a moment, and try again."
                        )
                    );
                }
            }, 100);
        });
    }

    function updateSummary() {
        const { size, pages } = totals();
        const count = files.length;

        el.queuePanel.hidden = count === 0;
        el.settings.hidden = count === 0;

        el.queueSummary.textContent =
            `${count} PDF${count === 1 ? "" : "s"} selected`;

        el.totalFiles.textContent = count;
        el.totalSize.textContent = formatBytes(size);
        el.totalPages.textContent = pages;

        const remainingFiles = Math.max(0, MAX_FILES - count);
        const remainingSize = Math.max(0, MAX_TOTAL_SIZE - size);
        const remainingPages = Math.max(0, MAX_TOTAL_PAGES - pages);
        if (el.capacity) {
            el.capacity.textContent =
                `${remainingFiles} file slot${remainingFiles === 1 ? "" : "s"} • ${formatBytes(remainingSize)} • ${remainingPages} pages remaining`;
        }

        const ready = count >= 2 && !processing;
        el.start.disabled = !ready;
        el.readyText.textContent = count < 2
            ? "Add at least 2 PDFs to merge."
            : `${count} PDFs ready to merge in the order shown.`;
    }

    function maybeWarnLargeBatch() {
        if (warningDismissed) return;
        const { size, pages } = totals();
        const largeFiles = files.filter(item => item.file.size >= LARGE_FILE_WARNING);
        const reasons = [];

        if (largeFiles.length) {
            const largest = Math.max(...largeFiles.map(item => item.file.size));
            reasons.push(
                `${largeFiles.length} large file${largeFiles.length === 1 ? "" : "s"} selected (largest ${formatBytes(largest)}).`
            );
        }
        if (size >= LARGE_SIZE_WARNING) reasons.push(`The batch is ${formatBytes(size)}.`);
        if (pages >= LARGE_PAGE_WARNING) reasons.push(`${pages} pages are queued.`);
        if (!reasons.length) return;

        warningDismissed = true;
        popupWarning(
            largeFiles.length ? "Large PDF Files Detected" : "Large PDF Batch Detected",
            "Merging can still continue, but very large files may take longer or use more memory on this device.",
            reasons
        );
    }

    function createRow(item, index) {
        const article = document.createElement("article");
        article.className = "pdf-queue-item";
        article.dataset.id = item.id;
        article.draggable = true;
        article.innerHTML = `
            <div class="pdf-order-badge">${String(index + 1).padStart(2, "0")}</div>
            <div class="pdf-file-main">
                <div class="pdf-thumb-wrap">
                    ${item.thumbUrl
                        ? `<img class="pdf-thumb" src="${item.thumbUrl}" alt="">`
                        : `<div class="pdf-file-icon">📄</div>`}
                </div>
                <div class="pdf-file-copy">
                    <h4 title="${escapeHTML(item.file.name)}">${escapeHTML(item.file.name)}</h4>
                    <p>${formatBytes(item.file.size)} • ${item.pages} page${item.pages === 1 ? "" : "s"}</p>
                </div>
            </div>
            <div class="pdf-file-actions">
                <span class="pdf-uploaded-tick" title="Uploaded">✓</span>
                <button type="button" class="pdf-action-btn" data-action="up" data-id="${item.id}" ${index === 0 || processing ? "disabled" : ""} aria-label="Move up">↑</button>
                <button type="button" class="pdf-action-btn" data-action="down" data-id="${item.id}" ${index === files.length - 1 || processing ? "disabled" : ""} aria-label="Move down">↓</button>
                <button type="button" class="pdf-action-btn remove" data-action="remove" data-id="${item.id}" ${processing ? "disabled" : ""} aria-label="Remove PDF">✕</button>
                <span class="pdf-drag-handle" data-drag-handle="${item.id}" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span>
            </div>
        `;
        return article;
    }

    function applyOrderToDom() {
        files.forEach((item, index) => {
            let node = el.queue.querySelector(`[data-id="${item.id}"]`);
            if (!node) {
                node = createRow(item, index);
            }
            const badge = node.querySelector(".pdf-order-badge");
            if (badge) badge.textContent = String(index + 1).padStart(2, "0");
            const up = node.querySelector('[data-action="up"]');
            const down = node.querySelector('[data-action="down"]');
            const remove = node.querySelector('[data-action="remove"]');
            if (up) up.disabled = processing || index === 0;
            if (down) down.disabled = processing || index === files.length - 1;
            if (remove) remove.disabled = processing;
            node.draggable = !processing;
            el.queue.appendChild(node);
        });
        updateSummary();
    }

    function renderQueue() {
        const existing = new Map();
        el.queue.querySelectorAll(".pdf-queue-item").forEach(node => {
            existing.set(node.dataset.id, node);
        });
        files.forEach((item, index) => {
            let node = existing.get(item.id);
            if (!node) node = createRow(item, index);
            existing.delete(item.id);
            const badge = node.querySelector(".pdf-order-badge");
            if (badge) badge.textContent = String(index + 1).padStart(2, "0");
            const up = node.querySelector('[data-action="up"]');
            const down = node.querySelector('[data-action="down"]');
            const remove = node.querySelector('[data-action="remove"]');
            if (up) up.disabled = processing || index === 0;
            if (down) down.disabled = processing || index === files.length - 1;
            if (remove) remove.disabled = processing;
            node.draggable = !processing;
            el.queue.appendChild(node);
        });
        existing.forEach(node => node.remove());
        updateSummary();
    }

    function moveItem(id, direction) {
        const index = files.findIndex(item => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= files.length) return;
        [files[index], files[target]] = [files[target], files[index]];
        applyOrderToDom();
    }

    function moveItemTo(id, targetId) {
        if (!id || !targetId || id === targetId) return;
        const from = files.findIndex(item => item.id === id);
        const to = files.findIndex(item => item.id === targetId);
        if (from < 0 || to < 0) return;
        const [item] = files.splice(from, 1);
        files.splice(to, 0, item);
        applyOrderToDom();
    }

    function removeItem(id) {
        const item = files.find(entry => entry.id === id);
        if (item?.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
        files = files.filter(entry => entry.id !== id);
        warningDismissed = false;
        renderQueue();
    }

    async function inspectPDF(file) {
        ensurePdfJs();
        const buffer = await file.arrayBuffer();
        const signature = new TextDecoder("latin1").decode(
            buffer.slice(0, Math.min(buffer.byteLength, 1024))
        );
        if (!signature.includes("%PDF-")) {
            throw new Error("This file is not a valid PDF.");
        }

        let loadingTask;
        try {
            loadingTask = window.pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                disableAutoFetch: true,
                disableStream: true
            });
            const pdf = await loadingTask.promise;
            const pageCount = pdf.numPages;
            if (pageCount < 1) {
                await pdf.destroy();
                throw new Error("This PDF has no pages.");
            }

            let thumbUrl = "";
            try {
                const page = await pdf.getPage(1);
                const unscaled = page.getViewport({ scale: 1 });
                const scale = Math.min(96 / Math.max(unscaled.height, 1), 0.45);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(viewport.width));
                canvas.height = Math.max(1, Math.round(viewport.height));
                const context = canvas.getContext("2d");
                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                    thumbUrl = await new Promise(resolve => {
                        canvas.toBlob(blob => {
                            resolve(blob ? URL.createObjectURL(blob) : "");
                        }, "image/jpeg", 0.72);
                    });
                }
                // Free canvas/page memory (helps iOS/Safari with many thumbnails)
                if (page.cleanup) page.cleanup();
                canvas.width = 0;
                canvas.height = 0;
            } catch (_) {
                thumbUrl = "";
            }

            await pdf.destroy();
            return { pages: pageCount, thumbUrl };
        } catch (error) {
            if (error?.name === "PasswordException") {
                throw new Error("Password-protected PDFs are not supported.");
            }
            if (error?.name === "InvalidPDFException") {
                throw new Error("This file is not a valid or readable PDF.");
            }
            if (error?.message === "This PDF has no pages.") {
                throw error;
            }
            throw new Error(error?.message || "Unable to read this PDF.");
        } finally {
            if (loadingTask) {
                try { await loadingTask.destroy(); } catch (_) {}
            }
        }
    }

    async function addFilesInternal(fileList) {
        if (processing) return;

        const candidates = Array.from(fileList || []);
        if (!candidates.length) return;

        try {
            await waitForPdfJs();
        } catch (error) {
            await popupError(
                "PDF reader not ready",
                error.message || "Please wait a moment and try again."
            );
            return;
        }

        const rejected = [];
        el.dropZone.classList.add("is-reading");

        try {
            for (const file of candidates) {
                if (files.length >= MAX_FILES) {
                    rejected.push(`${file.name}: maximum ${MAX_FILES} PDFs allowed.`);
                    continue;
                }
                if (file.size > MAX_FILE_SIZE) {
                    rejected.push(`${file.name}: larger than 100 MB.`);
                    continue;
                }
                if (file.size === 0) {
                    rejected.push(`${file.name}: this file is empty.`);
                    continue;
                }
                if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
                    rejected.push(`${file.name}: only PDF files are supported.`);
                    continue;
                }

                if (
                    files.some(
                        item =>
                            item.file.name === file.name && item.file.size === file.size
                    )
                ) {
                    rejected.push(`${file.name}: already in the merge list.`);
                    continue;
                }

                const current = totals();
                if (current.size + file.size > MAX_TOTAL_SIZE) {
                    rejected.push(`${file.name}: total batch limit of 250 MB would be exceeded.`);
                    continue;
                }

                try {
                    const inspected = await inspectPDF(file);
                    const pages = inspected.pages;
                    if (current.pages + pages > MAX_TOTAL_PAGES) {
                        if (inspected.thumbUrl) URL.revokeObjectURL(inspected.thumbUrl);
                        rejected.push(`${file.name}: total page limit of 500 pages would be exceeded.`);
                        continue;
                    }

                    const id = crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random()}`;

                    files.push({
                        id,
                        file,
                        pages,
                        thumbUrl: inspected.thumbUrl || ""
                    });
                    renderQueue();
                } catch (error) {
                    rejected.push(`${file.name}: ${error.message || "unable to validate this PDF."}`);
                }

                await yieldToUI();
            }
        } finally {
            el.dropZone.classList.remove("is-reading");
            el.input.value = "";
        }

        if (rejected.length) {
            await popupError(
                rejected.length === 1 ? "File could not be added" : "Some files could not be added",
                rejected.length === 1
                    ? "This PDF was skipped."
                    : `${rejected.length} files were skipped.`,
                rejected
            );
        }

        if (files.length) maybeWarnLargeBatch();
    }

    function addFiles(fileList) {
        addChain = addChain
            .then(() => addFilesInternal(fileList))
            .catch(error => {
                popupError("Upload failed", error.message || "Unable to add these PDF files.");
            });
        return addChain;
    }

    function sanitizeFileName(value) {
        let name = String(value || "")
            .trim()
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\.+$/g, "");
        if (!name) name = "merged-document";
        // Strip extension, truncate base, then always append .pdf
        // (avoids cutting ".pdf" when the full string is near the max length)
        const base = name.replace(/\.pdf$/i, "").slice(0, 116) || "merged-document";
        return `${base}.pdf`;
    }

    function setProcessingProgress(percent, title, text) {
        const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
        el.progressFill.style.width = `${safePercent}%`;
        el.progressPercent.textContent = `${safePercent}%`;
        if (title) el.progressTitle.textContent = title;
        if (text) el.progressText.textContent = text;
    }

    function setProcessingState(active) {
        processing = active;
        el.dropZone.classList.toggle("is-disabled", active);
        el.clear.disabled = active;
        el.outputName.disabled = active;
        el.start.disabled = active || files.length < 2;
        el.dropZone.setAttribute("aria-disabled", String(active));
        renderQueue();
    }

    async function mergePDFs() {
        if (processing || files.length < 2) {
            await popupError("Cannot merge yet", "Add at least 2 PDF files before merging.");
            return;
        }

        try {
            await waitForPdfLib();
        } catch (error) {
            await popupError("Merge library missing", error.message);
            return;
        }

        const snapshot = [...files];
        const outputName = sanitizeFileName(el.outputName.value);
        el.outputName.value = outputName;

        setProcessingState(true);
        el.results.hidden = true;
        el.processing.hidden = false;
        setProcessingProgress(4, "Preparing PDF files", "Preparing your documents.");

        try {
            const merged = await window.PDFLib.PDFDocument.create();
            merged.setTitle(outputName.replace(/\.pdf$/i, ""));
            merged.setProducer("AuraStudio");
            merged.setCreator("AuraStudio PDF Merge");

            for (let index = 0; index < snapshot.length; index++) {
                const item = snapshot[index];
                const start = 8 + (index / snapshot.length) * 82;
                setProcessingProgress(
                    start,
                    `Reading document ${index + 1} of ${snapshot.length}`,
                    item.file.name
                );
                await yieldToUI();

                const bytes = await item.file.arrayBuffer();
                let source;
                try {
                    source = await window.PDFLib.PDFDocument.load(bytes, {
                        ignoreEncryption: false
                    });
                } catch (error) {
                    const message = /password|encrypt/i.test(String(error?.message || ""))
                        ? "This PDF is encrypted or password-protected."
                        : "This PDF could not be read for merging.";
                    throw new Error(`${item.file.name}: ${message}`);
                }

                const pageIndexes = source.getPageIndices();
                if (!pageIndexes.length) {
                    throw new Error(`${item.file.name}: this PDF has no pages to copy.`);
                }
                const copiedPages = await merged.copyPages(source, pageIndexes);
                copiedPages.forEach(page => merged.addPage(page));

                setProcessingProgress(
                    8 + ((index + 1) / snapshot.length) * 82,
                    `Merging document ${index + 1} of ${snapshot.length}`,
                    item.file.name
                );
                await yieldToUI();
            }

            if (merged.getPageCount() < 1) {
                throw new Error("The merged document has no pages.");
            }

            setProcessingProgress(93, "Finalizing merged PDF", "Creating your download file.");
            await yieldToUI();
            const mergedBytes = await merged.save();
            const blob = new Blob([mergedBytes], { type: "application/pdf" });

            if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
            outputBlobUrl = URL.createObjectURL(blob);

            const total = snapshot.reduce((result, item) => {
                result.size += item.file.size;
                result.pages += item.pages;
                return result;
            }, { size: 0, pages: 0 });

            setProcessingProgress(100, "PDF merge complete", "Your merged PDF is ready.");
            await new Promise(resolve => setTimeout(resolve, 180));

            el.processing.hidden = true;
            el.resultName.textContent = outputName;
            el.resultFiles.textContent = snapshot.length;
            el.resultPages.textContent = total.pages;
            el.resultSize.textContent = formatBytes(blob.size);
            el.results.hidden = false;
            el.results.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            el.processing.hidden = true;
            console.error(error);
            await popupError(
                "Unable to merge PDFs",
                error.message || "Please remove the problematic file and try again."
            );
        } finally {
            setProcessingState(false);
        }
    }

    function resetTool() {
        if (processing) return;

        if (outputBlobUrl) {
            URL.revokeObjectURL(outputBlobUrl);
            outputBlobUrl = null;
        }
        files.forEach(item => {
            if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
        });

        files = [];
        processing = false;
        warningDismissed = false;
        draggedId = null;
        touchDrag = null;

        el.input.value = "";
        el.outputName.value = "merged-document.pdf";
        el.queue.innerHTML = "";
        el.queuePanel.hidden = true;
        el.settings.hidden = true;
        el.processing.hidden = true;
        el.results.hidden = true;
        setProcessingProgress(0, "Preparing PDF files", "Preparing your documents.");
        updateSummary();
    }

    function openFilePicker() {
        if (processing) return;
        el.input.click();
    }

    el.input.addEventListener("change", event => addFiles(event.target.files));

    el.dropZone.addEventListener("click", openFilePicker);
    el.dropZone.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
        }
    });

    ["dragenter", "dragover"].forEach(type => {
        el.dropZone.addEventListener(type, event => {
            event.preventDefault();
            event.stopPropagation();
            if (!processing) el.dropZone.classList.add("is-dragover");
        });
    });

    ["dragleave", "drop"].forEach(type => {
        el.dropZone.addEventListener(type, event => {
            event.preventDefault();
            event.stopPropagation();
            el.dropZone.classList.remove("is-dragover");
        });
    });

    el.dropZone.addEventListener("drop", event => {
        if (!processing) addFiles(event.dataTransfer?.files);
    });

    el.clear.addEventListener("click", async () => {
        if (processing || files.length === 0) return;
        const confirmed = await popupConfirm(
            "Clear all PDFs?",
            "This removes the current merge list. Your original files on the device stay unchanged."
        );
        if (confirmed) resetTool();
    });

    el.queue.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button || processing) return;
        const { action, id } = button.dataset;
        if (action === "remove") removeItem(id);
        if (action === "up") moveItem(id, -1);
        if (action === "down") moveItem(id, 1);
    });

    el.queue.addEventListener("dragstart", event => {
        if (processing) {
            event.preventDefault();
            return;
        }
        if (event.target.closest("button")) {
            event.preventDefault();
            return;
        }
        const item = event.target.closest(".pdf-queue-item");
        if (!item) return;
        draggedId = item.dataset.id;
        item.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedId);
    });

    el.queue.addEventListener("dragover", event => {
        if (!draggedId || processing) return;
        const target = event.target.closest(".pdf-queue-item");
        if (!target) return;
        event.preventDefault();
        el.queue.querySelectorAll(".pdf-queue-item.is-drop-target")
            .forEach(node => node.classList.remove("is-drop-target"));
        if (target.dataset.id !== draggedId) target.classList.add("is-drop-target");
    });

    el.queue.addEventListener("drop", event => {
        if (!draggedId || processing) return;
        event.preventDefault();
        const target = event.target.closest(".pdf-queue-item");
        if (target) moveItemTo(draggedId, target.dataset.id);
        draggedId = null;
        el.queue.querySelectorAll(".pdf-queue-item")
            .forEach(node => node.classList.remove("is-dragging", "is-drop-target"));
    });

    el.queue.addEventListener("dragend", () => {
        draggedId = null;
        el.queue.querySelectorAll(".pdf-queue-item")
            .forEach(node => node.classList.remove("is-dragging", "is-drop-target"));
    });

    el.queue.addEventListener("pointerdown", event => {
        const handle = event.target.closest("[data-drag-handle]");
        if (!handle || processing || event.pointerType === "mouse") return;
        const item = handle.closest(".pdf-queue-item");
        touchDrag = {
            id: handle.dataset.dragHandle,
            item
        };
        handle.setPointerCapture?.(event.pointerId);
        item?.classList.add("is-dragging");
        event.preventDefault();
    });

    el.queue.addEventListener("pointermove", event => {
        if (!touchDrag || processing) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)
            ?.closest(".pdf-queue-item");
        if (!target || target.dataset.id === touchDrag.id) return;
        moveItemTo(touchDrag.id, target.dataset.id);
        const current = el.queue.querySelector(`[data-id="${touchDrag.id}"]`);
        current?.classList.add("is-dragging");
        touchDrag.item = current;
    });

    function endTouchDrag() {
        if (touchDrag?.item) touchDrag.item.classList.remove("is-dragging");
        el.queue.querySelectorAll(".pdf-queue-item")
            .forEach(node => node.classList.remove("is-dragging", "is-drop-target"));
        touchDrag = null;
    }

    el.queue.addEventListener("pointerup", endTouchDrag);
    el.queue.addEventListener("pointercancel", endTouchDrag);

    el.outputName.addEventListener("blur", () => {
        el.outputName.value = sanitizeFileName(el.outputName.value);
    });

    el.start.addEventListener("click", mergePDFs);

    function triggerDownload() {
        if (!outputBlobUrl) {
            popupError("Nothing to download", "Merge PDFs first, then download the result.");
            return;
        }
        const anchor = document.createElement("a");
        anchor.href = outputBlobUrl;
        anchor.download = sanitizeFileName(el.outputName.value);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    el.download.addEventListener("click", triggerDownload);

    el.preview?.addEventListener("click", () => {
        if (!outputBlobUrl) {
            popupError("Nothing to preview", "Merge PDFs first, then open the preview.");
            return;
        }
        // Anchor click is more reliable than window.open on mobile.
        // Note: window.open(url, "_blank", "noopener") returns null even when
        // the tab opens, which caused a false "Preview blocked" dialog.
        try {
            const anchor = document.createElement("a");
            anchor.href = outputBlobUrl;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } catch (err) {
            popupError(
                "Preview unavailable",
                "Could not open the preview. Download the PDF instead."
            );
        }
    });

    el.mergeMore.addEventListener("click", async () => {
        if (processing) return;
        if (files.length > 0) {
            const confirmed = await popupConfirm(
                "Start a new merge?",
                "This clears the current list and result. Original files on your device stay unchanged."
            );
            if (!confirmed) return;
        }
        resetTool();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("beforeunload", event => {
        if (processing) {
            event.preventDefault();
            event.returnValue = "";
        }
        if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    });

    updateSummary();
})();
