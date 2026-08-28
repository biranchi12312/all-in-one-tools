(() => {
    "use strict";

    const view = document.getElementById("imagesToPdfView");
    if (!view) return;

    const MAX_FILES = 30;
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
    const MAX_PIXELS = 40000000;
    const MAX_SOURCE_DIMENSION = 9000;
    const MAX_EMBED_DIMENSION = 4096;

    const PAGE_A4 = { w: 595.28, h: 841.89 };
    const PAGE_LETTER = { w: 612, h: 792 };

    const el = {
        dropZone: document.getElementById("i2pDropZone"),
        fileInput: document.getElementById("i2pFileInput"),
        queuePanel: document.getElementById("i2pQueuePanel"),
        queueList: document.getElementById("i2pFileQueue"),
        queueSummary: document.getElementById("i2pQueueSummary"),
        clearBtn: document.getElementById("i2pClearBtn"),
        totalFiles: document.getElementById("i2pTotalFiles"),
        totalSize: document.getElementById("i2pTotalSize"),
        capacity: document.getElementById("i2pCapacity"),
        settingsPanel: document.getElementById("i2pSettingsPanel"),
        pageFit: document.getElementById("i2pPageFit"),
        pageA4: document.getElementById("i2pPageA4"),
        pageLetter: document.getElementById("i2pPageLetter"),
        readyText: document.getElementById("i2pReadyText"),
        startBtn: document.getElementById("i2pStartBtn"),
        processingPanel: document.getElementById("i2pProcessingPanel"),
        progressTitle: document.getElementById("i2pProgressTitle"),
        progressText: document.getElementById("i2pProgressText"),
        progressFill: document.getElementById("i2pProgressFill"),
        progressPercent: document.getElementById("i2pProgressPercent"),
        resultsPanel: document.getElementById("i2pResultsPanel"),
        resultSummary: document.getElementById("i2pResultSummary"),
        resultPages: document.getElementById("i2pResultPages"),
        resultSize: document.getElementById("i2pResultSize"),
        downloadBtn: document.getElementById("i2pDownloadBtn"),
        moreBtn: document.getElementById("i2pMoreBtn")
    };

    let files = [];
    let processing = false;
    let processingOperationId = null;

    function syncProcessingManager(active) {
        const manager = window.AuraProcessingManager;
        if (!manager) {
            window.__auraProcessing = !!active;
            return;
        }

        if (active) {
            const started = manager.start("images-to-pdf");
            if (started && started.ok) {
                processingOperationId = started.operationId;
            }
        } else if (processingOperationId) {
            manager.finish(processingOperationId);
            processingOperationId = null;
        }
    }

    let addChain = Promise.resolve();
    let resultUrl = null;
    let resultBlob = null;
    let dragId = null;

    function dialog() {
        return window.AuraDialog || null;
    }

    function popupError(title, message, items) {
        const ui = dialog();
        if (ui) return ui.error(title, message, items);
        window.alert([title, message, (items || []).join("\n")].filter(Boolean).join("\n"));
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

    function yieldToUI() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function totals() {
        return files.reduce((acc, item) => acc + item.file.size, 0);
    }

    function guessImageType(file) {
        const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
        if (type === "image/jpeg" || type === "image/png" || type === "image/webp") {
            return type;
        }
        const name = (file.name || "").toLowerCase();
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        return null;
    }

    function getPageMode() {
        if (el.pageA4 && el.pageA4.checked) return "a4";
        if (el.pageLetter && el.pageLetter.checked) return "letter";
        return "fit";
    }

    function ensurePdfLib() {
        if (!window.PDFLib || !window.PDFLib.PDFDocument) {
            throw new Error("PDF library is still loading. Please try again in a moment.");
        }
    }

    function waitForPdfLib(timeoutMs) {
        const limit = timeoutMs || 15000;
        if (window.PDFLib && window.PDFLib.PDFDocument) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (window.PDFLib && window.PDFLib.PDFDocument) {
                    clearInterval(timer);
                    resolve();
                    return;
                }
                if (Date.now() - start > limit) {
                    clearInterval(timer);
                    reject(
                        new Error(
                            "PDF library failed to load. Check your connection and refresh the page."
                        )
                    );
                }
            }, 100);
        });
    }

    async function decodeImage(file) {
        try {
            return await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch (_) {
            return createImageBitmap(file);
        }
    }

    function updateSummary() {
        const size = totals();
        const count = files.length;
        const remainingFiles = Math.max(0, MAX_FILES - count);
        const remainingSize = Math.max(0, MAX_TOTAL_SIZE - size);

        if (el.totalFiles) el.totalFiles.textContent = String(count);
        if (el.totalSize) el.totalSize.textContent = formatBytes(size);
        if (el.capacity) {
            el.capacity.textContent = `${remainingFiles} image slot${remainingFiles !== 1 ? "s" : ""} • ${formatBytes(remainingSize)} remaining`;
        }
        if (el.queueSummary) {
            el.queueSummary.textContent =
                count === 0
                    ? "No images selected"
                    : `${count} image${count !== 1 ? "s" : ""} · ${formatBytes(size)} · drag to reorder`;
        }

        const ready = count >= 1 && !processing;
        if (el.startBtn) el.startBtn.disabled = !ready;
        if (el.readyText) {
            const mode = getPageMode();
            const modeLabel =
                mode === "a4" ? "A4" : mode === "letter" ? "Letter" : "fit-to-image";
            el.readyText.textContent = ready
                ? `Ready to create a ${count}-page PDF (${modeLabel}).`
                : "Add at least 1 image to create a PDF.";
        }

        if (!processing && !resultBlob) {
            if (el.queuePanel) el.queuePanel.hidden = count === 0;
            if (el.settingsPanel) el.settingsPanel.hidden = count === 0;
            if (el.dropZone) el.dropZone.hidden = false;
            if (el.processingPanel) el.processingPanel.hidden = true;
            if (el.resultsPanel) el.resultsPanel.hidden = true;
        }
    }

    function createRow(item, index) {
        const article = document.createElement("article");
        article.className = "pdf-file-row i2p-queue-item";
        article.dataset.id = item.id;
        article.draggable = true;
        const type = guessImageType(item.file) || "image";
        article.innerHTML = `
            <div class="pdf-file-main">
                <div class="pdf-file-icon">🖼</div>
                <div class="pdf-file-copy">
                    <strong>${escapeHTML(item.file.name)}</strong>
                    <span>${formatBytes(item.file.size)} · ${type.replace("image/", "").toUpperCase()} · #${index + 1}</span>
                </div>
            </div>
            <div class="pdf-file-actions">
                <button type="button" class="pdf-row-btn" data-action="up" aria-label="Move up"${index === 0 ? " disabled" : ""}>↑</button>
                <button type="button" class="pdf-row-btn" data-action="down" aria-label="Move down"${index === files.length - 1 ? " disabled" : ""}>↓</button>
                <button type="button" class="pdf-row-btn remove" data-action="remove" aria-label="Remove">✕</button>
            </div>
        `;
        article.querySelector('[data-action="remove"]')?.addEventListener("click", () => {
            removeItem(item.id);
        });
        article.querySelector('[data-action="up"]')?.addEventListener("click", () => {
            moveItem(item.id, -1);
        });
        article.querySelector('[data-action="down"]')?.addEventListener("click", () => {
            moveItem(item.id, 1);
        });

        article.addEventListener("dragstart", () => {
            dragId = item.id;
            article.classList.add("is-dragging");
        });
        article.addEventListener("dragend", () => {
            dragId = null;
            article.classList.remove("is-dragging");
        });
        article.addEventListener("dragover", event => {
            event.preventDefault();
        });
        article.addEventListener("drop", event => {
            event.preventDefault();
            if (!dragId || dragId === item.id) return;
            moveItemTo(dragId, item.id);
        });
        return article;
    }

    function renderQueue() {
        if (!el.queueList) return;
        el.queueList.innerHTML = "";
        files.forEach((item, index) => {
            el.queueList.appendChild(createRow(item, index));
        });
        updateSummary();
    }

    function removeItem(id) {
        if (processing) return;
        files = files.filter(item => item.id !== id);
        renderQueue();
        if (files.length === 0) resetAll(false);
    }

    function moveItem(id, direction) {
        if (processing) return;
        const index = files.findIndex(item => item.id === id);
        if (index < 0) return;
        const next = index + direction;
        if (next < 0 || next >= files.length) return;
        const copy = files.slice();
        const tmp = copy[index];
        copy[index] = copy[next];
        copy[next] = tmp;
        files = copy;
        renderQueue();
    }

    function moveItemTo(id, targetId) {
        if (processing) return;
        const from = files.findIndex(item => item.id === id);
        const to = files.findIndex(item => item.id === targetId);
        if (from < 0 || to < 0 || from === to) return;
        const copy = files.slice();
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        files = copy;
        renderQueue();
    }

    async function addFilesInternal(fileList) {
        const incoming = Array.isArray(fileList)
            ? fileList
            : Array.from(fileList || []);
        if (!incoming.length) return;

        if (el.dropZone) el.dropZone.classList.add("is-reading");

        const rejected = [];
        let currentSize = totals();

        for (const file of incoming) {
            try {
                if (files.length >= MAX_FILES) {
                    rejected.push(`${file.name}: maximum ${MAX_FILES} images at a time.`);
                    continue;
                }
                const type = guessImageType(file);
                if (!type) {
                    rejected.push(`${file.name}: only JPG, PNG and WebP are supported.`);
                    continue;
                }
                if (file.size > MAX_FILE_SIZE) {
                    rejected.push(`${file.name}: larger than 100 MB.`);
                    continue;
                }
                if (file.size === 0) {
                    rejected.push(`${file.name}: empty file.`);
                    continue;
                }
                if (currentSize + file.size > MAX_TOTAL_SIZE) {
                    rejected.push(`${file.name}: total batch limit of 250 MB would be exceeded.`);
                    continue;
                }
                if (
                    files.some(
                        item =>
                            item.file.name === file.name && item.file.size === file.size
                    )
                ) {
                    rejected.push(`${file.name}: already in the list.`);
                    continue;
                }

                files.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    file,
                    type
                });
                currentSize += file.size;
            } catch (error) {
                rejected.push(
                    `${file.name}: ${(error && error.message) || "could not be added."}`
                );
            }
            await yieldToUI();
        }

        if (el.dropZone) el.dropZone.classList.remove("is-reading");
        renderQueue();

        if (rejected.length) {
            popupError(
                "Some files were skipped",
                "Check the limits and try again with supported images.",
                rejected.slice(0, 8)
            );
        }
    }

    function addFiles(fileList) {
        if (processing) return;
        const snapshot = Array.isArray(fileList)
            ? fileList.slice()
            : Array.from(fileList || []);
        if (!snapshot.length) return;
        addChain = addChain
            .then(() => addFilesInternal(snapshot))
            .catch(err => {
                console.error(err);
                popupError("Upload failed", (err && err.message) || "Could not add files.");
            });
    }

    function setProgress(percent, title, text) {
        const value = Math.max(0, Math.min(100, Math.round(percent)));
        if (el.progressFill) el.progressFill.style.width = `${value}%`;
        if (el.progressPercent) el.progressPercent.textContent = `${value}%`;
        if (title && el.progressTitle) el.progressTitle.textContent = title;
        if (text && el.progressText) el.progressText.textContent = text;
    }

    function resetAll(clearFiles) {
        if (clearFiles !== false) files = [];
        processing = false;
        syncProcessingManager(false);
        window.__auraProcessing = false;
        if (resultUrl) {
            URL.revokeObjectURL(resultUrl);
            resultUrl = null;
        }
        resultBlob = null;
        if (el.fileInput) el.fileInput.value = "";
        if (el.dropZone) {
            el.dropZone.hidden = false;
            el.dropZone.classList.remove("is-reading", "is-dragover");
        }
        if (el.processingPanel) el.processingPanel.hidden = true;
        if (el.resultsPanel) el.resultsPanel.hidden = true;
        renderQueue();
    }

    /**
     * Scale bitmap into a canvas ≤ MAX_EMBED_DIMENSION and return
     * { bytes, width, height, mime } ready for pdf-lib.
     */
    async function prepareImageForPdf(file, type) {
        const bitmap = await decodeImage(file);
        let canvas = null;
        try {
            const pixels = bitmap.width * bitmap.height;
            if (
                pixels > MAX_PIXELS ||
                Math.max(bitmap.width, bitmap.height) > MAX_SOURCE_DIMENSION
            ) {
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
            const ctx = canvas.getContext("2d", { alpha: type === "image/png" });
            if (!ctx) throw new Error("Canvas unavailable.");
            if (type !== "image/png") {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
            }
            ctx.drawImage(bitmap, 0, 0, width, height);

            // pdf-lib embeds JPEG/PNG only — WebP becomes JPEG
            const outMime = type === "image/png" ? "image/png" : "image/jpeg";
            const quality = outMime === "image/jpeg" ? 0.92 : undefined;
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    b => (b ? resolve(b) : reject(new Error("Could not encode image."))),
                    outMime,
                    quality
                );
            });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            return { bytes, width, height, mime: outMime };
        } finally {
            try {
                bitmap.close();
            } catch (_) {}
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
            }
        }
    }

    function fitRect(imgW, imgH, pageW, pageH) {
        const scale = Math.min(pageW / imgW, pageH / imgH);
        const w = imgW * scale;
        const h = imgH * scale;
        return {
            x: (pageW - w) / 2,
            y: (pageH - h) / 2,
            w,
            h
        };
    }

    async function startCreate() {
        if (processing || files.length === 0) return;

        try {
            await waitForPdfLib();
            ensurePdfLib();
        } catch (error) {
            popupError(
                "PDF library not ready",
                (error && error.message) || "Please refresh and try again."
            );
            return;
        }

        processing = true;
        syncProcessingManager(true);
        window.__auraProcessing = true;
        if (el.startBtn) el.startBtn.disabled = true;
        if (el.dropZone) el.dropZone.hidden = true;
        if (el.queuePanel) el.queuePanel.hidden = true;
        if (el.settingsPanel) el.settingsPanel.hidden = true;
        if (el.resultsPanel) el.resultsPanel.hidden = true;
        if (el.processingPanel) el.processingPanel.hidden = false;
        setProgress(2, "Preparing PDF", "Starting…");

        if (resultUrl) {
            URL.revokeObjectURL(resultUrl);
            resultUrl = null;
        }
        resultBlob = null;

        const mode = getPageMode();
        const snapshot = files.slice();

        try {
            const pdfDoc = await window.PDFLib.PDFDocument.create();
            pdfDoc.setTitle("AuraStudio Images to PDF");
            pdfDoc.setProducer("AuraStudio");

            for (let i = 0; i < snapshot.length; i++) {
                const item = snapshot[i];
                setProgress(
                    ((i + 0.2) / snapshot.length) * 100,
                    `Adding image ${i + 1} of ${snapshot.length}`,
                    item.file.name
                );

                const prepared = await prepareImageForPdf(item.file, item.type);
                let embedded;
                if (prepared.mime === "image/png") {
                    embedded = await pdfDoc.embedPng(prepared.bytes);
                } else {
                    embedded = await pdfDoc.embedJpg(prepared.bytes);
                }

                let pageW;
                let pageH;
                let draw;

                if (mode === "fit") {
                    // Map pixels → PDF points at ~96 DPI (px * 72/96), then clamp
                    // longest side so pages stay viewable/printable (not 40"+ wide).
                    const PX_TO_PT = 72 / 96;
                    const MAX_FIT_SIDE = 842; // ~A4 long edge in points
                    pageW = prepared.width * PX_TO_PT;
                    pageH = prepared.height * PX_TO_PT;
                    const longSide = Math.max(pageW, pageH);
                    if (longSide > MAX_FIT_SIDE) {
                        const s = MAX_FIT_SIDE / longSide;
                        pageW *= s;
                        pageH *= s;
                    }
                    // Image still fills the whole page (aspect preserved)
                    draw = { x: 0, y: 0, w: pageW, h: pageH };
                } else {
                    const landscape = prepared.width >= prepared.height;
                    if (mode === "a4") {
                        pageW = landscape ? PAGE_A4.h : PAGE_A4.w;
                        pageH = landscape ? PAGE_A4.w : PAGE_A4.h;
                    } else {
                        pageW = landscape ? PAGE_LETTER.h : PAGE_LETTER.w;
                        pageH = landscape ? PAGE_LETTER.w : PAGE_LETTER.h;
                    }
                    draw = fitRect(prepared.width, prepared.height, pageW, pageH);
                }

                const page = pdfDoc.addPage([pageW, pageH]);
                page.drawImage(embedded, {
                    x: draw.x,
                    y: draw.y,
                    width: draw.w,
                    height: draw.h
                });

                setProgress(
                    ((i + 1) / snapshot.length) * 100,
                    `Added image ${i + 1} of ${snapshot.length}`,
                    item.file.name
                );
                await yieldToUI();
            }

            setProgress(98, "Saving PDF", "Almost done…");
            const pdfBytes = await pdfDoc.save();
            resultBlob = new Blob([pdfBytes], { type: "application/pdf" });
            resultUrl = URL.createObjectURL(resultBlob);
            setProgress(100, "PDF ready", "Your document is ready to download.");
            await yieldToUI();
            showResults(snapshot.length);
        } catch (error) {
            console.error(error);
            popupError(
                "Could not create PDF",
                (error && error.message) || "Something went wrong while building the PDF."
            );
            if (el.processingPanel) el.processingPanel.hidden = true;
            if (el.dropZone) el.dropZone.hidden = false;
            updateSummary();
        } finally {
            processing = false;
            syncProcessingManager(false);
            window.__auraProcessing = false;
        }
    }

    function showResults(pageCount) {
        if (el.processingPanel) el.processingPanel.hidden = true;
        if (el.queuePanel) el.queuePanel.hidden = true;
        if (el.settingsPanel) el.settingsPanel.hidden = true;
        if (el.dropZone) el.dropZone.hidden = true;
        if (el.resultsPanel) el.resultsPanel.hidden = false;

        if (el.resultPages) el.resultPages.textContent = String(pageCount);
        if (el.resultSize) {
            el.resultSize.textContent = resultBlob ? formatBytes(resultBlob.size) : "—";
        }
        if (el.resultSummary) {
            el.resultSummary.textContent = `${pageCount} page${pageCount !== 1 ? "s" : ""} · images-document.pdf is ready.`;
        }
    }

    function downloadPdf() {
        if (!resultUrl) return;
        const a = document.createElement("a");
        a.href = resultUrl;
        a.download = "images-document.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // Events
    if (el.dropZone) {
        el.dropZone.addEventListener("click", () => {
            if (!processing && el.fileInput) el.fileInput.click();
        });
        el.dropZone.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!processing && el.fileInput) el.fileInput.click();
            }
        });
        ["dragenter", "dragover"].forEach(type => {
            el.dropZone.addEventListener(type, event => {
                event.preventDefault();
                el.dropZone.classList.add("is-dragover");
            });
        });
        ["dragleave", "drop"].forEach(type => {
            el.dropZone.addEventListener(type, event => {
                event.preventDefault();
                el.dropZone.classList.remove("is-dragover");
            });
        });
        el.dropZone.addEventListener("drop", event => {
            if (processing) return;
            addFiles(Array.from((event.dataTransfer && event.dataTransfer.files) || []));
        });
    }

    if (el.fileInput) {
        el.fileInput.addEventListener("change", () => {
            const list = Array.from(el.fileInput.files || []);
            el.fileInput.value = "";
            addFiles(list);
        });
    }

    el.clearBtn?.addEventListener("click", async () => {
        if (processing || !files.length) return;
        const confirmed = await popupConfirm(
            "Clear all images?",
            "This removes the current list. Your original files stay unchanged."
        );
        if (confirmed) resetAll(true);
    });
    el.startBtn?.addEventListener("click", () => {
        startCreate();
    });
    el.downloadBtn?.addEventListener("click", () => {
        downloadPdf();
    });
    el.moreBtn?.addEventListener("click", async () => {
        if (processing) return;
        if (files.length > 0 || resultBlob) {
            const confirmed = await popupConfirm(
                "Create another PDF?",
                "This clears the current list and result. Original files stay unchanged."
            );
            if (!confirmed) return;
        }
        resetAll(true);
    });

    [el.pageFit, el.pageA4, el.pageLetter].forEach(node => {
        node?.addEventListener("change", () => updateSummary());
    });

    updateSummary();
})();
