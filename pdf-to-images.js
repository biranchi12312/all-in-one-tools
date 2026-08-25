(() => {
    "use strict";

    const view = document.getElementById("pdfToImagesView");
    if (!view) return;

    const MAX_FILES = 10;
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_PAGES = 200;
    const PDFJS_WORKER =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const el = {
        dropZone: document.getElementById("p2iDropZone"),
        fileInput: document.getElementById("p2iFileInput"),
        queuePanel: document.getElementById("p2iQueuePanel"),
        queueList: document.getElementById("p2iFileQueue"),
        queueSummary: document.getElementById("p2iQueueSummary"),
        clearBtn: document.getElementById("p2iClearBtn"),
        totalFiles: document.getElementById("p2iTotalFiles"),
        totalSize: document.getElementById("p2iTotalSize"),
        totalPages: document.getElementById("p2iTotalPages"),
        capacity: document.getElementById("p2iCapacity"),
        settingsPanel: document.getElementById("p2iSettingsPanel"),
        formatPng: document.getElementById("p2iFormatPng"),
        formatJpg: document.getElementById("p2iFormatJpg"),
        qualityWrap: document.getElementById("p2iQualityWrap"),
        quality: document.getElementById("p2iQuality"),
        qualityValue: document.getElementById("p2iQualityValue"),
        readyText: document.getElementById("p2iReadyText"),
        startBtn: document.getElementById("p2iStartBtn"),
        processingPanel: document.getElementById("p2iProcessingPanel"),
        progressTitle: document.getElementById("p2iProgressTitle"),
        progressText: document.getElementById("p2iProgressText"),
        progressFill: document.getElementById("p2iProgressFill"),
        progressPercent: document.getElementById("p2iProgressPercent"),
        resultsPanel: document.getElementById("p2iResultsPanel"),
        resultSummary: document.getElementById("p2iResultSummary"),
        resultCount: document.getElementById("p2iResultCount"),
        resultFormat: document.getElementById("p2iResultFormat"),
        resultGrid: document.getElementById("p2iResultGrid"),
        zipBtn: document.getElementById("p2iZipBtn"),
        moreBtn: document.getElementById("p2iMoreBtn")
    };

    let files = [];
    let results = [];
    let processing = false;
    let addChain = Promise.resolve();

    function dialog() {
        return window.AuraDialog || null;
    }

    function popupError(title, message, items) {
        const ui = dialog();
        if (ui) return ui.error(title, message, items);
        window.alert([title, message].filter(Boolean).join("\n"));
    }

    function popupWarning(title, message, items) {
        const ui = dialog();
        if (ui) return ui.warning(title, message, items);
        window.alert([title, message].filter(Boolean).join("\n"));
    }

    function formatBytes(bytes) {
        if (!bytes || bytes < 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );
        const value = bytes / Math.pow(1024, index);
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
        return files.reduce(
            (acc, item) => {
                acc.size += item.file.size;
                acc.pages += item.pages || 0;
                return acc;
            },
            { size: 0, pages: 0 }
        );
    }

    function ensurePdfJs() {
        if (!window.pdfjsLib) {
            throw new Error("PDF engine is still loading. Please try again in a moment.");
        }
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        }
    }

    function getFormat() {
        return el.formatJpg?.checked ? "jpeg" : "png";
    }

    function getQuality() {
        const q = Number(el.quality?.value || 92);
        return Math.min(1, Math.max(0.5, q / 100));
    }

    function updateQualityUI() {
        const isJpg = getFormat() === "jpeg";
        if (el.qualityWrap) el.qualityWrap.hidden = !isJpg;
        if (el.qualityValue) {
            el.qualityValue.textContent = `${el.quality?.value || 92}%`;
        }
        if (el.quality) {
            const max = Number(el.quality.max || 100);
            const min = Number(el.quality.min || 50);
            const value = Number(el.quality.value || 92);
            const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
            el.quality.style.setProperty(
                "--range-progress",
                `${Math.max(0, Math.min(100, percent))}%`
            );
        }
    }

    function updateSummary() {
        const { size, pages } = totals();
        const count = files.length;
        const remainingFiles = Math.max(0, MAX_FILES - count);
        const remainingPages = Math.max(0, MAX_TOTAL_PAGES - pages);

        if (el.totalFiles) el.totalFiles.textContent = String(count);
        if (el.totalSize) el.totalSize.textContent = formatBytes(size);
        if (el.totalPages) el.totalPages.textContent = String(pages);
        if (el.capacity) {
            el.capacity.textContent = `${remainingFiles} file slot${remainingFiles !== 1 ? "s" : ""} • ${remainingPages} page${remainingPages !== 1 ? "s" : ""} remaining`;
        }
        if (el.queueSummary) {
            el.queueSummary.textContent =
                count === 0
                    ? "No PDFs selected"
                    : `${count} PDF${count !== 1 ? "s" : ""} • ${pages} page${pages !== 1 ? "s" : ""} • ${formatBytes(size)}`;
        }

        const ready = count >= 1 && !processing;
        if (el.startBtn) el.startBtn.disabled = !ready;
        if (el.readyText) {
            el.readyText.textContent = ready
                ? `Ready to convert ${pages} page${pages !== 1 ? "s" : ""} to ${getFormat() === "jpeg" ? "JPG" : "PNG"}.`
                : "Add at least 1 PDF to convert.";
        }

        if (el.queuePanel) el.queuePanel.hidden = count === 0;
        if (el.settingsPanel) el.settingsPanel.hidden = count === 0;
    }

    function createRow(item) {
        const article = document.createElement("article");
        article.className = "pdf-file-row";
        article.dataset.id = item.id;
        article.innerHTML = `
            <div class="pdf-file-main">
                <div class="pdf-file-icon">📄</div>
                <div class="pdf-file-copy">
                    <strong>${escapeHTML(item.file.name)}</strong>
                    <span>${formatBytes(item.file.size)} • ${item.pages} page${item.pages !== 1 ? "s" : ""}</span>
                </div>
            </div>
            <div class="pdf-file-actions">
                <button type="button" class="pdf-row-btn" data-action="remove" aria-label="Remove ${escapeHTML(item.file.name)}">✕</button>
            </div>
        `;
        article.querySelector('[data-action="remove"]')?.addEventListener("click", () => {
            removeItem(item.id);
        });
        return article;
    }

    function renderQueue() {
        if (!el.queueList) return;
        el.queueList.innerHTML = "";
        files.forEach(item => {
            el.queueList.appendChild(createRow(item));
        });
        updateSummary();
    }

    function removeItem(id) {
        if (processing) return;
        files = files.filter(item => item.id !== id);
        renderQueue();
        if (files.length === 0) resetToUpload(false);
    }

    async function inspectPDF(file) {
        ensurePdfJs();
        const buffer = await file.arrayBuffer();
        const signature = new TextDecoder("latin1").decode(
            new Uint8Array(buffer.slice(0, 5))
        );
        if (!signature.startsWith("%PDF")) {
            throw new Error("Not a valid PDF file.");
        }

        let loadingTask;
        try {
            loadingTask = window.pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                password: ""
            });
            const pdf = await loadingTask.promise;
            const pageCount = pdf.numPages;
            if (pageCount < 1) {
                throw new Error("This PDF has no pages.");
            }
            await pdf.destroy?.();
            return { pages: pageCount };
        } catch (error) {
            const msg = String(error?.message || error || "");
            if (/password|encrypted/i.test(msg)) {
                throw new Error("Password-protected PDFs are not supported.");
            }
            throw new Error(msg || "Could not read this PDF.");
        }
    }

    async function addFilesInternal(fileList) {
        const incoming = Array.from(fileList || []);
        if (!incoming.length) return;

        const rejected = [];
        let current = totals();

        for (const file of incoming) {
            try {
                if (files.length >= MAX_FILES) {
                    rejected.push(`${file.name}: maximum ${MAX_FILES} PDFs at a time.`);
                    continue;
                }

                const isPdf =
                    file.type === "application/pdf" ||
                    /\.pdf$/i.test(file.name);
                if (!isPdf) {
                    rejected.push(`${file.name}: only PDF files are accepted.`);
                    continue;
                }

                if (file.size > MAX_FILE_SIZE) {
                    rejected.push(`${file.name}: larger than 100 MB.`);
                    continue;
                }

                if (files.some(item => item.file.name === file.name && item.file.size === file.size)) {
                    rejected.push(`${file.name}: already in the list.`);
                    continue;
                }

                const { pages } = await inspectPDF(file);

                if (current.pages + pages > MAX_TOTAL_PAGES) {
                    rejected.push(
                        `${file.name}: would exceed the ${MAX_TOTAL_PAGES}-page batch limit.`
                    );
                    continue;
                }

                files.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    file,
                    pages
                });
                current.pages += pages;
                current.size += file.size;
            } catch (error) {
                rejected.push(`${file.name}: ${error.message || "could not be added."}`);
            }
            await yieldToUI();
        }

        renderQueue();

        if (rejected.length) {
            popupError(
                "Some files were skipped",
                "Check the limits and try again with supported PDFs.",
                rejected.slice(0, 8)
            );
        }
    }

    function addFiles(fileList) {
        if (processing) return;
        addChain = addChain
            .then(() => addFilesInternal(fileList))
            .catch(() => {});
    }

    function setProcessingProgress(percent, title, text) {
        const value = Math.max(0, Math.min(100, Math.round(percent)));
        if (el.progressFill) el.progressFill.style.width = `${value}%`;
        if (el.progressPercent) el.progressPercent.textContent = `${value}%`;
        if (title && el.progressTitle) el.progressTitle.textContent = title;
        if (text && el.progressText) el.progressText.textContent = text;
    }

    function showPanel(name) {
        if (el.dropZone) el.dropZone.hidden = name !== "upload";
        if (el.queuePanel) el.queuePanel.hidden = name === "upload" || name === "processing" || files.length === 0 || name === "results";
        if (el.settingsPanel) el.settingsPanel.hidden = name !== "settings" && name !== "queue";
        if (name === "queue" || name === "settings") {
            if (el.queuePanel) el.queuePanel.hidden = files.length === 0;
            if (el.settingsPanel) el.settingsPanel.hidden = files.length === 0;
            if (el.dropZone) el.dropZone.hidden = false;
        }
        if (el.processingPanel) el.processingPanel.hidden = name !== "processing";
        if (el.resultsPanel) el.resultsPanel.hidden = name !== "results";
    }

    function resetToUpload(clearFiles) {
        if (clearFiles !== false) files = [];
        results.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        results = [];
        processing = false;
        if (el.fileInput) el.fileInput.value = "";
        if (el.resultGrid) el.resultGrid.innerHTML = "";
        renderQueue();
        showPanel("upload");
        updateSummary();
        updateQualityUI();
    }

    async function renderPageToBlob(pdf, pageNumber, format, quality) {
        const page = await pdf.getPage(pageNumber);
        const unscaled = page.getViewport({ scale: 1 });
        // Target ~150 DPI equivalent for readable text without huge files
        const scale = Math.min(2, 150 / 72);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;

        const mime = format === "jpeg" ? "image/jpeg" : "image/png";
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                b => (b ? resolve(b) : reject(new Error("Could not create image."))),
                mime,
                format === "jpeg" ? quality : undefined
            );
        });

        page.cleanup?.();
        canvas.width = 0;
        canvas.height = 0;
        return blob;
    }

    function sanitizeBaseName(name) {
        return String(name || "document")
            .replace(/\.pdf$/i, "")
            .replace(/[^\w\s.-]+/g, "")
            .replace(/\s+/g, "-")
            .slice(0, 60) || "document";
    }

    async function startConvert() {
        if (processing || files.length === 0) return;

        try {
            ensurePdfJs();
        } catch (error) {
            popupError("PDF engine not ready", error.message);
            return;
        }

        processing = true;
        if (el.startBtn) el.startBtn.disabled = true;
        showPanel("processing");
        setProcessingProgress(2, "Preparing conversion", "Reading your PDF files…");

        results.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        results = [];

        const format = getFormat();
        const quality = getQuality();
        const ext = format === "jpeg" ? "jpg" : "png";
        const totalPages = totals().pages;
        let donePages = 0;

        try {
            for (let fi = 0; fi < files.length; fi++) {
                const item = files[fi];
                ensurePdfJs();
                const buffer = await item.file.arrayBuffer();
                const loadingTask = window.pdfjsLib.getDocument({
                    data: new Uint8Array(buffer)
                });
                const pdf = await loadingTask.promise;
                const base = sanitizeBaseName(item.file.name);

                for (let p = 1; p <= pdf.numPages; p++) {
                    setProcessingProgress(
                        (donePages / Math.max(totalPages, 1)) * 100,
                        `Converting PDF ${fi + 1} of ${files.length}`,
                        `Page ${p} of ${pdf.numPages} · ${item.file.name}`
                    );

                    const blob = await renderPageToBlob(pdf, p, format, quality);
                    const fileName = `${base}-page-${String(p).padStart(2, "0")}.${ext}`;
                    const url = URL.createObjectURL(blob);
                    results.push({
                        blob,
                        url,
                        fileName,
                        page: p,
                        source: item.file.name,
                        size: blob.size
                    });
                    donePages += 1;
                    await yieldToUI();
                }

                await pdf.destroy?.();
            }

            setProcessingProgress(100, "Conversion complete", "Preparing your images…");
            await yieldToUI();
            showResults(format);
        } catch (error) {
            console.error(error);
            popupError(
                "Conversion failed",
                error?.message || "Something went wrong while converting pages."
            );
            showPanel("queue");
            updateSummary();
        } finally {
            processing = false;
        }
    }

    function showResults(format) {
        showPanel("results");
        if (el.queuePanel) el.queuePanel.hidden = true;
        if (el.settingsPanel) el.settingsPanel.hidden = true;
        if (el.dropZone) el.dropZone.hidden = true;

        if (el.resultCount) el.resultCount.textContent = String(results.length);
        if (el.resultFormat) {
            el.resultFormat.textContent = format === "jpeg" ? "JPG" : "PNG";
        }
        if (el.resultSummary) {
            el.resultSummary.textContent = `${results.length} image${results.length !== 1 ? "s" : ""} ready · download individually or as a ZIP.`;
        }

        if (el.resultGrid) {
            el.resultGrid.innerHTML = "";
            results.forEach((item, index) => {
                const card = document.createElement("article");
                card.className = "p2i-result-card";
                card.innerHTML = `
                    <div class="p2i-result-thumb-wrap">
                        <img class="p2i-result-thumb" src="${item.url}" alt="${escapeHTML(item.fileName)}" loading="lazy">
                    </div>
                    <div class="p2i-result-meta">
                        <strong>${escapeHTML(item.fileName)}</strong>
                        <span>${formatBytes(item.size)}</span>
                    </div>
                    <button type="button" class="action-btn outline p2i-dl-one" data-index="${index}">Download</button>
                `;
                card.querySelector(".p2i-dl-one")?.addEventListener("click", () => {
                    downloadOne(index);
                });
                el.resultGrid.appendChild(card);
            });
        }
    }

    function downloadOne(index) {
        const item = results[index];
        if (!item) return;
        const a = document.createElement("a");
        a.href = item.url;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async function downloadZip() {
        if (!results.length) return;
        if (!window.JSZip) {
            popupError(
                "ZIP not ready",
                "The ZIP library is still loading. Wait a moment and try again, or download images one by one."
            );
            return;
        }

        try {
            if (el.zipBtn) el.zipBtn.disabled = true;
            const zip = new window.JSZip();
            results.forEach(item => {
                zip.file(item.fileName, item.blob);
            });
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "pdf-images.zip";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (error) {
            popupError("ZIP failed", error?.message || "Could not create the ZIP file.");
        } finally {
            if (el.zipBtn) el.zipBtn.disabled = false;
        }
    }

    // Events
    el.dropZone?.addEventListener("click", () => {
        if (!processing) el.fileInput?.click();
    });
    el.dropZone?.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!processing) el.fileInput?.click();
        }
    });

    ["dragenter", "dragover"].forEach(type => {
        el.dropZone?.addEventListener(type, event => {
            event.preventDefault();
            el.dropZone.classList.add("drag-over");
        });
    });
    ["dragleave", "drop"].forEach(type => {
        el.dropZone?.addEventListener(type, event => {
            event.preventDefault();
            el.dropZone.classList.remove("drag-over");
        });
    });
    el.dropZone?.addEventListener("drop", event => {
        if (processing) return;
        addFiles(event.dataTransfer?.files);
    });

    el.fileInput?.addEventListener("change", () => {
        addFiles(el.fileInput.files);
        el.fileInput.value = "";
    });

    el.clearBtn?.addEventListener("click", () => {
        if (processing) return;
        resetToUpload(true);
    });

    el.startBtn?.addEventListener("click", () => {
        startConvert();
    });

    el.zipBtn?.addEventListener("click", () => {
        downloadZip();
    });

    el.moreBtn?.addEventListener("click", () => {
        resetToUpload(true);
    });

    el.formatPng?.addEventListener("change", () => {
        updateQualityUI();
        updateSummary();
    });
    el.formatJpg?.addEventListener("change", () => {
        updateQualityUI();
        updateSummary();
    });
    el.quality?.addEventListener("input", () => {
        updateQualityUI();
    });

    updateQualityUI();
    updateSummary();
    showPanel("upload");
})();
