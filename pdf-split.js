(() => {
    "use strict";

    const view = document.getElementById("pdfSplitView");
    if (!view) return;

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_PAGES = 500;
    const MAX_OUTPUT_FILES = 100;
    const PDFJS_WORKER =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const el = {
        dropZone: document.getElementById("splitDropZone"),
        input: document.getElementById("splitFileInput"),
        queuePanel: document.getElementById("splitQueuePanel"),
        fileName: document.getElementById("splitFileName"),
        fileMeta: document.getElementById("splitFileMeta"),
        clearBtn: document.getElementById("splitClearBtn"),
        settings: document.getElementById("splitSettingsPanel"),
        modeRanges: document.getElementById("splitModeRanges"),
        modeEvery: document.getElementById("splitModeEvery"),
        modeChunk: document.getElementById("splitModeChunk"),
        rangesWrap: document.getElementById("splitRangesWrap"),
        rangesInput: document.getElementById("splitRangesInput"),
        chunkWrap: document.getElementById("splitChunkWrap"),
        chunkInput: document.getElementById("splitChunkInput"),
        singleToggle: document.getElementById("splitSingleToggle"),
        singleWrap: document.getElementById("splitSingleWrap"),
        readyText: document.getElementById("splitReadyText"),
        startBtn: document.getElementById("splitStartBtn"),
        processing: document.getElementById("splitProcessingPanel"),
        progressTitle: document.getElementById("splitProgressTitle"),
        progressText: document.getElementById("splitProgressText"),
        progressFill: document.getElementById("splitProgressFill"),
        progressPercent: document.getElementById("splitProgressPercent"),
        results: document.getElementById("splitResultsPanel"),
        resultSummary: document.getElementById("splitResultSummary"),
        resultFiles: document.getElementById("splitResultFiles"),
        resultPages: document.getElementById("splitResultPages"),
        resultSize: document.getElementById("splitResultSize"),
        resultList: document.getElementById("splitResultList"),
        zipBtn: document.getElementById("splitZipBtn"),
        moreBtn: document.getElementById("splitMoreBtn")
    };

    if (!el.dropZone || !el.input || !el.startBtn) return;

    let source = null; // { file, pages, size, name }
    let outputs = []; // { name, blob, url, pages }
    let zipUrl = null;
    let processing = false;

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

    async function popupWarning(title, message) {
        const ui = dialog();
        if (ui) return ui.warning(title, message);
        return Promise.resolve();
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
            throw new Error("PDF toolkit could not be loaded. Check your connection and reload the page.");
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
                            "PDF toolkit is still loading. Check your connection, wait a moment, and try again."
                        )
                    );
                }
            }, 100);
        });
    }

    function sanitizeBaseName(value) {
        let name = String(value || "")
            .trim()
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\.+$/g, "");
        if (!name) name = "document";
        const base = name.replace(/\.pdf$/i, "").slice(0, 100) || "document";
        return base;
    }

    function revokeOutputs() {
        outputs.forEach(item => {
            if (item.url) URL.revokeObjectURL(item.url);
        });
        outputs = [];
        if (zipUrl) {
            URL.revokeObjectURL(zipUrl);
            zipUrl = null;
        }
    }

    function getMode() {
        if (el.modeEvery?.checked) return "every";
        if (el.modeChunk?.checked) return "chunk";
        return "ranges";
    }

    function updateModeUI() {
        const mode = getMode();
        if (el.rangesWrap) el.rangesWrap.hidden = mode !== "ranges";
        if (el.chunkWrap) el.chunkWrap.hidden = mode !== "chunk";
        // Single-PDF toggle only makes sense for ranges mode
        if (el.singleWrap) el.singleWrap.hidden = mode !== "ranges";
        updateReady();
    }

    /**
     * Parse "1-3, 5, 8-10" into list of inclusive 1-based ranges.
     * Returns { ranges: [{start,end}], error?: string }
     */
    function parseRanges(text, maxPage) {
        const raw = String(text || "").trim();
        if (!raw) {
            return { ranges: [], error: "Enter at least one page or range (example: 1-3, 5, 8-10)." };
        }
        const parts = raw.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);
        const ranges = [];
        for (const part of parts) {
            const m = part.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
            if (!m) {
                return { ranges: [], error: `Invalid page token: "${part}". Use numbers like 1-3 or 5.` };
            }
            let start = parseInt(m[1], 10);
            let end = m[2] ? parseInt(m[2], 10) : start;
            if (start < 1 || end < 1) {
                return { ranges: [], error: "Page numbers must be 1 or higher." };
            }
            if (start > end) {
                const t = start;
                start = end;
                end = t;
            }
            if (start > maxPage || end > maxPage) {
                return {
                    ranges: [],
                    error: `Page ${end > maxPage ? end : start} is outside this PDF (1–${maxPage}).`
                };
            }
            ranges.push({ start, end });
        }
        if (!ranges.length) {
            return { ranges: [], error: "Enter at least one valid page range." };
        }
        return { ranges };
    }

    function buildGroups() {
        if (!source) return { groups: [], error: "Upload a PDF first." };
        const mode = getMode();
        const maxPage = source.pages;

        if (mode === "every") {
            const groups = [];
            for (let p = 1; p <= maxPage; p++) {
                groups.push({ label: `page-${p}`, pages: [p] });
            }
            return { groups };
        }

        if (mode === "chunk") {
            const n = parseInt(el.chunkInput?.value || "5", 10);
            if (!Number.isFinite(n) || n < 1) {
                return { groups: [], error: "Chunk size must be at least 1." };
            }
            if (n > maxPage) {
                return {
                    groups: [],
                    error: `Chunk size (${n}) is larger than the PDF (${maxPage} pages).`
                };
            }
            const groups = [];
            for (let start = 1; start <= maxPage; start += n) {
                const end = Math.min(start + n - 1, maxPage);
                const pages = [];
                for (let p = start; p <= end; p++) pages.push(p);
                groups.push({ label: `pages-${start}-${end}`, pages });
            }
            return { groups };
        }

        // ranges
        const parsed = parseRanges(el.rangesInput?.value, maxPage);
        if (parsed.error) return { groups: [], error: parsed.error };

        const single = !!(el.singleToggle && el.singleToggle.checked);
        if (single) {
            const pages = [];
            const seen = new Set();
            for (const r of parsed.ranges) {
                for (let p = r.start; p <= r.end; p++) {
                    if (!seen.has(p)) {
                        seen.add(p);
                        pages.push(p);
                    }
                }
            }
            pages.sort((a, b) => a - b);
            return {
                groups: [{ label: "selected-pages", pages }]
            };
        }

        return {
            groups: parsed.ranges.map(r => ({
                label: r.start === r.end ? `page-${r.start}` : `pages-${r.start}-${r.end}`,
                pages: Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start + i)
            }))
        };
    }

    function updateReady() {
        if (!el.readyText || !el.startBtn) return;
        if (!source) {
            el.readyText.textContent = "Upload a PDF to start splitting.";
            el.startBtn.disabled = true;
            return;
        }
        if (processing) {
            el.startBtn.disabled = true;
            return;
        }
        const { groups, error } = buildGroups();
        if (error) {
            el.readyText.textContent = error;
            el.startBtn.disabled = true;
            return;
        }
        const totalPages = groups.reduce((s, g) => s + g.pages.length, 0);
        el.readyText.textContent =
            groups.length === 1
                ? `Ready: 1 output PDF · ${totalPages} page${totalPages === 1 ? "" : "s"}.`
                : `Ready: ${groups.length} output PDFs · ${totalPages} page references.`;
        el.startBtn.disabled = groups.length === 0;
    }

    function setProcessingProgress(pct, title, text) {
        if (el.progressFill) el.progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        if (el.progressPercent) el.progressPercent.textContent = `${Math.round(pct)}%`;
        if (title && el.progressTitle) el.progressTitle.textContent = title;
        if (text && el.progressText) el.progressText.textContent = text;
    }

    function setProcessingState(on) {
        processing = on;
        if (el.dropZone) {
            el.dropZone.classList.toggle("is-disabled", on);
            el.dropZone.setAttribute("aria-disabled", String(!!on));
        }
        if (el.startBtn) el.startBtn.disabled = on || !source;
        if (el.clearBtn) el.clearBtn.disabled = on;
        updateReady();
    }

    async function inspectPDF(file) {
        await waitForPdfJs();
        const buffer = await file.arrayBuffer();
        const head = new TextDecoder("latin1").decode(
            buffer.slice(0, Math.min(buffer.byteLength, 1024))
        );
        if (!head.includes("%PDF-")) {
            throw new Error("This file is not a valid PDF.");
        }

        let pdf;
        try {
            const loadingTask = window.pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                disableAutoFetch: true,
                disableStream: true
            });
            pdf = await loadingTask.promise;
            const pageCount = pdf.numPages;
            if (pageCount < 1) {
                throw new Error("This PDF has no pages.");
            }
            if (pageCount > MAX_TOTAL_PAGES) {
                throw new Error(
                    `This PDF has ${pageCount} pages. Maximum allowed is ${MAX_TOTAL_PAGES}.`
                );
            }
            return { pages: pageCount };
        } catch (error) {
            if (error?.name === "PasswordException") {
                throw new Error("This PDF is password-protected. Remove the password and try again.");
            }
            throw error;
        } finally {
            if (pdf && pdf.destroy) {
                try {
                    await pdf.destroy();
                } catch (_) {
                    /* ignore */
                }
            }
        }
    }

    function showSourceUI() {
        if (!source) return;
        if (el.fileName) el.fileName.textContent = source.name;
        if (el.fileMeta) {
            el.fileMeta.textContent = `${source.pages} page${source.pages === 1 ? "" : "s"} · ${formatBytes(source.size)}`;
        }
        if (el.queuePanel) el.queuePanel.hidden = false;
        if (el.settings) el.settings.hidden = false;
        if (el.dropZone) el.dropZone.hidden = true;
        if (el.results) el.results.hidden = true;
        if (el.processing) el.processing.hidden = true;
        if (el.rangesInput && !el.rangesInput.value.trim()) {
            el.rangesInput.placeholder = `e.g. 1-3, 5, ${Math.min(8, source.pages)}-${source.pages}`;
        }
        updateModeUI();
        updateReady();
    }

    function resetAll(clearFile) {
        revokeOutputs();
        if (clearFile) source = null;
        if (el.input) el.input.value = "";
        if (el.results) el.results.hidden = true;
        if (el.processing) el.processing.hidden = true;
        if (el.resultList) el.resultList.innerHTML = "";
        if (el.zipBtn) el.zipBtn.hidden = true;

        if (!source) {
            if (el.queuePanel) el.queuePanel.hidden = true;
            if (el.settings) el.settings.hidden = true;
            if (el.dropZone) el.dropZone.hidden = false;
            if (el.rangesInput) el.rangesInput.value = "";
            if (el.chunkInput) el.chunkInput.value = "5";
            if (el.singleToggle) el.singleToggle.checked = false;
            if (el.modeRanges) el.modeRanges.checked = true;
            updateModeUI();
            updateReady();
            return;
        }
        showSourceUI();
    }

    async function addFile(file) {
        if (processing) return;
        if (!file) return;

        const typeOk =
            file.type === "application/pdf" ||
            /\.pdf$/i.test(file.name || "");
        if (!typeOk) {
            await popupError("Not a PDF", `"${file.name}" is not a PDF file.`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            await popupError(
                "File too large",
                `"${file.name}" is ${formatBytes(file.size)}. Maximum is ${formatBytes(MAX_FILE_SIZE)}.`
            );
            return;
        }
        if (file.size === 0) {
            await popupError("Empty file", `"${file.name}" has no content.`);
            return;
        }

        if (source) {
            const ok = await popupConfirm(
                "Replace current PDF?",
                "Uploading a new file will clear the current PDF and any split results."
            );
            if (!ok) return;
        }

        revokeOutputs();
        el.dropZone?.classList.add("is-reading");
        try {
            const info = await inspectPDF(file);
            source = {
                file,
                pages: info.pages,
                size: file.size,
                name: file.name || "document.pdf"
            };
            showSourceUI();
        } catch (error) {
            source = null;
            resetAll(true);
            await popupError(
                "Could not read PDF",
                error.message || "Please try another file."
            );
        } finally {
            el.dropZone?.classList.remove("is-reading");
            if (el.input) el.input.value = "";
        }
    }

    async function startSplit() {
        if (processing || !source) return;
        const plan = buildGroups();
        if (plan.error) {
            await popupError("Cannot split", plan.error);
            updateReady();
            return;
        }
        let groups = plan.groups;
        if (!groups.length) {
            await popupError("Cannot split", "No pages selected.");
            return;
        }

        if (groups.length > 200) {
            await popupError(
                "Too many outputs",
                `Refusing ${groups.length} files. Use ranges or a larger chunk size (max 200 output files).`
            );
            return;
        }

        if (groups.length >= 50) {
            const ok = await popupConfirm(
                groups.length > MAX_OUTPUT_FILES ? "Many output files" : "Large split job",
                groups.length > MAX_OUTPUT_FILES
                    ? `This will create ${groups.length} PDFs (soft limit ${MAX_OUTPUT_FILES}). Large batches may be slow or use more memory on this device. Continue?`
                    : `Creating ${groups.length} PDF files may take a while and use memory on this device. Continue?`
            );
            if (!ok) return;
        }

        setProcessingState(true);
        revokeOutputs();
        if (el.results) el.results.hidden = true;
        if (el.settings) el.settings.hidden = true;
        if (el.queuePanel) el.queuePanel.hidden = true;
        if (el.processing) {
            el.processing.hidden = false;
            el.processing.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setProcessingProgress(2, "Loading PDF", "Reading your document…");

        let srcDoc = null;
        try {
            await waitForPdfLib();
            ensurePdfLib();
            const bytes = new Uint8Array(await source.file.arrayBuffer());
            setProcessingProgress(8, "Loading PDF", "Preparing pages…");
            await yieldToUI();

            srcDoc = await window.PDFLib.PDFDocument.load(bytes, {
                ignoreEncryption: true
            });

            if (srcDoc.isEncrypted) {
                await popupWarning(
                    "Encrypted PDF",
                    "This file is encrypted. Some pages or content may be missing in the output. You can continue, or unlock the PDF and try again."
                );
            }

            const baseName = sanitizeBaseName(source.name);
            const total = groups.length;
            const created = [];

            for (let i = 0; i < total; i++) {
                const g = groups[i];
                const pct = 10 + Math.round(((i + 1) / total) * 80);
                setProcessingProgress(
                    pct,
                    "Splitting PDF",
                    `Building file ${i + 1} of ${total}…`
                );
                await yieldToUI();

                const outDoc = await window.PDFLib.PDFDocument.create();
                const zeroBased = g.pages.map(p => p - 1);
                const copied = await outDoc.copyPages(srcDoc, zeroBased);
                copied.forEach(page => outDoc.addPage(page));
                const outBytes = await outDoc.save();
                const blob = new Blob([outBytes], { type: "application/pdf" });
                const name = `${baseName}-${g.label}.pdf`;
                const url = URL.createObjectURL(blob);
                created.push({
                    name,
                    blob,
                    url,
                    pages: g.pages.length
                });
            }

            outputs = created;
            setProcessingProgress(95, "Finishing", "Preparing downloads…");
            await yieldToUI();

            // ZIP when 2+
            if (outputs.length > 1 && window.JSZip) {
                const zip = new window.JSZip();
                outputs.forEach(item => {
                    zip.file(item.name, item.blob);
                });
                const zipBlob = await zip.generateAsync({ type: "blob" });
                zipUrl = URL.createObjectURL(zipBlob);
            }

            setProcessingProgress(100, "Split complete", "Your files are ready.");
            await new Promise(r => setTimeout(r, 160));

            if (el.processing) el.processing.hidden = true;
            renderResults();
        } catch (error) {
            console.error(error);
            if (el.processing) el.processing.hidden = true;
            if (el.queuePanel) el.queuePanel.hidden = false;
            if (el.settings) el.settings.hidden = false;
            await popupError(
                "Unable to split PDF",
                error.message || "Please try another file or smaller page ranges."
            );
        } finally {
            srcDoc = null;
            setProcessingState(false);
        }
    }

    function renderResults() {
        if (!outputs.length) return;
        const totalPages = outputs.reduce((s, o) => s + o.pages, 0);
        const totalSize = outputs.reduce((s, o) => s + o.blob.size, 0);

        if (el.resultSummary) {
            el.resultSummary.textContent =
                outputs.length === 1
                    ? `${outputs[0].name} is ready.`
                    : `${outputs.length} PDF files are ready.`;
        }
        if (el.resultFiles) el.resultFiles.textContent = String(outputs.length);
        if (el.resultPages) el.resultPages.textContent = String(totalPages);
        if (el.resultSize) el.resultSize.textContent = formatBytes(totalSize);

        if (el.resultList) {
            el.resultList.innerHTML = outputs
                .map(
                    (item, index) => `
                <div class="pdf-file-row">
                    <div class="pdf-file-main">
                        <div class="pdf-file-icon" aria-hidden="true">📄</div>
                        <div class="pdf-file-copy">
                            <strong title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</strong>
                            <span>${item.pages} page${item.pages === 1 ? "" : "s"} · ${formatBytes(item.blob.size)}</span>
                        </div>
                    </div>
                    <div class="pdf-file-actions">
                        <button type="button" class="pdf-row-btn pdf-row-btn-text" data-split-dl="${index}">Download</button>
                    </div>
                </div>`
                )
                .join("");
        }

        if (el.zipBtn) {
            el.zipBtn.hidden = !(outputs.length > 1 && zipUrl);
        }

        if (el.results) {
            el.results.hidden = false;
            el.results.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function downloadBlob(url, filename) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // —— Events ——
    el.dropZone.addEventListener("click", () => {
        if (!processing) el.input?.click();
    });
    el.dropZone.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!processing) el.input?.click();
        }
    });

    ["dragenter", "dragover"].forEach(type => {
        el.dropZone.addEventListener(type, event => {
            event.preventDefault();
            if (!processing) el.dropZone.classList.add("is-dragover");
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
        const file = event.dataTransfer?.files?.[0];
        if (file) addFile(file);
    });

    el.input.addEventListener("change", () => {
        const file = el.input.files?.[0];
        el.input.value = "";
        if (file) addFile(file);
    });

    el.clearBtn?.addEventListener("click", async () => {
        if (processing) return;
        if (!source) return;
        const ok = await popupConfirm(
            "Clear PDF?",
            "This removes the current file and any split results. Original files on your device stay unchanged."
        );
        if (ok) resetAll(true);
    });

    el.moreBtn?.addEventListener("click", async () => {
        if (processing) return;
        if (source || outputs.length) {
            const ok = await popupConfirm(
                "Split another PDF?",
                "This clears the current file and results. Original files on your device stay unchanged."
            );
            if (!ok) return;
        }
        resetAll(true);
        window.scrollTo(0, 0);
    });

    [el.modeRanges, el.modeEvery, el.modeChunk].forEach(node => {
        node?.addEventListener("change", updateModeUI);
    });
    el.rangesInput?.addEventListener("input", updateReady);
    el.chunkInput?.addEventListener("input", updateReady);
    el.singleToggle?.addEventListener("change", updateReady);

    el.startBtn.addEventListener("click", () => {
        startSplit();
    });

    el.resultList?.addEventListener("click", event => {
        const btn = event.target.closest("[data-split-dl]");
        if (!btn || processing) return;
        const index = parseInt(btn.getAttribute("data-split-dl"), 10);
        const item = outputs[index];
        if (item) downloadBlob(item.url, item.name);
    });

    el.zipBtn?.addEventListener("click", () => {
        if (!zipUrl || outputs.length < 2) return;
        const base = sanitizeBaseName(source?.name || "document");
        downloadBlob(zipUrl, `${base}-split.zip`);
    });

    window.addEventListener("beforeunload", event => {
        if (processing) {
            event.preventDefault();
            event.returnValue = "";
        }
        revokeOutputs();
    });

    updateModeUI();
    updateReady();
})();
