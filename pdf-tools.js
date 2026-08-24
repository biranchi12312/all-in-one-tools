/* =========================================================
   AURASTUDIO — PDF TOOLS
   Current tool: PDF Merge
========================================================= */

(() => {
    "use strict";

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_FILES = 20;
    const MAX_TOTAL_SIZE = 250 * 1024 * 1024;
    const MAX_TOTAL_PAGES = 500;

    // Soft-warning thresholds. These do not block merging; the hard limits above do.
    const LARGE_FILE_WARNING = 75 * 1024 * 1024;
    const LARGE_SIZE_WARNING = 150 * 1024 * 1024;
    const LARGE_PAGE_WARNING = 300;

    const el = {
        view: document.getElementById("pdfMergeView"),
        dropZone: document.getElementById("pdfMergeDropZone"),
        input: document.getElementById("pdfMergeFileInput"),
        warning: document.getElementById("pdfLargeWarning"),
        warningTitle: document.getElementById("pdfLargeWarningTitle"),
        warningText: document.getElementById("pdfLargeWarningText"),
        warningClose: document.getElementById("pdfLargeWarningClose"),
        warningBackdrop: document.getElementById("pdfLargeWarningBackdrop"),
        warningDismiss: document.getElementById("pdfLargeWarningDismiss"),
        queuePanel: document.getElementById("pdfMergeQueuePanel"),
        queue: document.getElementById("pdfMergeFileQueue"),
        queueSummary: document.getElementById("pdfMergeQueueSummary"),
        clear: document.getElementById("pdfMergeClearBtn"),
        totalFiles: document.getElementById("pdfMergeTotalFiles"),
        totalSize: document.getElementById("pdfMergeTotalSize"),
        totalPages: document.getElementById("pdfMergeTotalPages"),
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
        mergeMore: document.getElementById("pdfMergeMoreBtn")
    };

    let files = [];
    let outputBlobUrl = null;
    let processing = false;
    let warningDismissed = false;
    let draggedId = null;
    let touchDrag = null;

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
        return String(value).replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function totals() {
        return files.reduce((result, item) => {
            result.size += item.file.size;
            result.pages += item.pages;
            return result;
        }, { size: 0, pages: 0 });
    }

    function dismissWarning() {
        warningDismissed = true;
        el.warning.hidden = true;
    }

    function updateWarning() {
        const { size, pages } = totals();
        const largeFiles = files.filter(item => item.file.size >= LARGE_FILE_WARNING);
        const reasons = [];

        if (largeFiles.length) {
            const largest = Math.max(...largeFiles.map(item => item.file.size));
            reasons.push(
                `${largeFiles.length} large file${largeFiles.length === 1 ? "" : "s"} selected (largest ${formatBytes(largest)}).`
            );
        }

        if (size >= LARGE_SIZE_WARNING) {
            reasons.push(`The batch is ${formatBytes(size)}.`);
        }

        if (pages >= LARGE_PAGE_WARNING) {
            reasons.push(`${pages} pages are queued.`);
        }

        const shouldShow = !warningDismissed && reasons.length > 0;
        el.warning.hidden = !shouldShow;

        if (!shouldShow) return;

        if (el.warningTitle) {
            el.warningTitle.textContent =
                largeFiles.length > 0
                    ? "Large PDF Files Detected"
                    : "Large PDF Batch Detected";
        }

        if (el.warningText) {
            el.warningText.textContent =
                "For smoother processing, please upload smaller PDF files.";
        }
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

        const ready = count >= 2 && !processing;
        el.start.disabled = !ready;

        el.readyText.textContent = count < 2
            ? "Add at least 2 PDFs to merge."
            : `${count} PDFs ready to merge.`;

        updateWarning();
    }

    function renderQueue() {
        el.queue.innerHTML = files.map((item, index) => `
            <article class="pdf-queue-item" data-id="${item.id}">
                <div class="pdf-order-badge">${String(index + 1).padStart(2, "0")}</div>

                <div class="pdf-file-main">
                    <div class="pdf-file-icon">📄</div>
                    <div class="pdf-file-copy">
                        <h4 title="${escapeHTML(item.file.name)}">${escapeHTML(item.file.name)}</h4>
                        <p>${formatBytes(item.file.size)} • ${item.pages} Page${item.pages === 1 ? "" : "s"}</p>
                    </div>
                </div>

                <div class="pdf-file-actions">
                    <span class="pdf-uploaded-tick" title="Uploaded">✓</span>
                    <button type="button" class="pdf-action-btn" data-action="up" data-id="${item.id}" ${index === 0 || processing ? "disabled" : ""} aria-label="Move up">↑</button>
                    <button type="button" class="pdf-action-btn" data-action="down" data-id="${item.id}" ${index === files.length - 1 || processing ? "disabled" : ""} aria-label="Move down">↓</button>
                    <button type="button" class="pdf-action-btn remove" data-action="remove" data-id="${item.id}" ${processing ? "disabled" : ""} aria-label="Remove PDF">✕</button>
                    <span class="pdf-drag-handle" data-drag-handle="${item.id}" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span>
                </div>
            </article>
        `).join("");

        updateSummary();
    }

    function moveItem(id, direction) {
        const index = files.findIndex(item => item.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= files.length) return;
        [files[index], files[target]] = [files[target], files[index]];
        renderQueue();
    }

    function moveItemTo(id, targetId) {
        if (!id || !targetId || id === targetId) return;
        const from = files.findIndex(item => item.id === id);
        const to = files.findIndex(item => item.id === targetId);
        if (from < 0 || to < 0) return;
        const [item] = files.splice(from, 1);
        files.splice(to, 0, item);
        renderQueue();
    }

    function removeItem(id) {
        files = files.filter(item => item.id !== id);
        warningDismissed = false;
        renderQueue();
    }

    async function getPDFPageCount(file) {
        if (!window.pdfjsLib) {
            throw new Error("PDF reader library could not be loaded. Please check your internet connection and reload the page.");
        }

        const buffer = await file.arrayBuffer();
        const signature = new TextDecoder("latin1").decode(
            buffer.slice(0, Math.min(buffer.byteLength, 8))
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
            await pdf.destroy();
            return pageCount;
        } catch (error) {
            if (error?.name === "PasswordException") {
                throw new Error("Password-protected PDFs are not supported.");
            }
            if (error?.name === "InvalidPDFException") {
                throw new Error("This file is not a valid or readable PDF.");
            }
            throw new Error("Unable to read this PDF.");
        } finally {
            if (loadingTask) {
                try { await loadingTask.destroy(); } catch (_) {}
            }
        }
    }

    function showRejected(file, reason) {
        const message = document.createElement("div");
        message.className = "pdf-upload-rejection";
        message.textContent = `${file.name}: ${reason}`;
        message.style.cssText = "margin-top:10px;padding:10px 12px;border:1px solid rgba(239,68,68,.28);border-radius:12px;color:#f87171;font-size:12px;";
        el.dropZone.after(message);
        setTimeout(() => message.remove(), 6500);
    }

    async function addFiles(fileList) {
        if (processing) return;

        const candidates = Array.from(fileList || []);
        if (!candidates.length) return;

        for (const file of candidates) {
            if (files.length >= MAX_FILES) {
                showRejected(file, `Maximum ${MAX_FILES} PDFs allowed.`);
                continue;
            }

            if (file.size > MAX_FILE_SIZE) {
                showRejected(file, "File is larger than 100 MB.");
                continue;
            }

            if (file.size === 0) {
                showRejected(file, "This file is empty.");
                continue;
            }

            if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
                showRejected(file, "Only PDF files are supported.");
                continue;
            }

            const current = totals();
            if (current.size + file.size > MAX_TOTAL_SIZE) {
                showRejected(file, "Total batch limit of 250 MB would be exceeded.");
                continue;
            }

            try {
                el.dropZone.classList.add("is-reading");
                const pages = await getPDFPageCount(file);

                if (current.pages + pages > MAX_TOTAL_PAGES) {
                    showRejected(file, "Total page limit of 500 pages would be exceeded.");
                    continue;
                }

                files.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
                    file,
                    pages
                });
            } catch (error) {
                showRejected(file, error.message || "Unable to validate this PDF.");
            } finally {
                el.dropZone.classList.remove("is-reading");
            }
        }

        warningDismissed = false;
        renderQueue();
        el.input.value = "";
    }

    function sanitizeFileName(value) {
        let name = String(value || "")
            .trim()
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\.+$/g, "");

        if (!name) name = "merged-document";
        if (!/\.pdf$/i.test(name)) name += ".pdf";
        return name;
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
        el.dropZone.style.pointerEvents = active ? "none" : "";
        el.dropZone.classList.toggle("is-disabled", active);
        el.clear.disabled = active;
        el.outputName.disabled = active;
        el.warningClose.disabled = active;
        el.start.disabled = active || files.length < 2;
        updateSummary();
        renderQueue();
    }

    async function mergePDFs() {
        if (processing || files.length < 2) return;

        if (!window.PDFLib?.PDFDocument) {
            alert("PDF merge library could not be loaded. Please check your internet connection and reload the page.");
            return;
        }

        const snapshot = [...files];
        const outputName = sanitizeFileName(el.outputName.value);

        setProcessingState(true);
        el.results.hidden = true;
        el.processing.hidden = false;
        setProcessingProgress(4, "Preparing PDF files", "Preparing your documents.");

        try {
            const merged = await window.PDFLib.PDFDocument.create();

            for (let index = 0; index < snapshot.length; index++) {
                const item = snapshot[index];
                const start = 8 + (index / snapshot.length) * 82;
                setProcessingProgress(
                    start,
                    `Reading document ${index + 1} of ${snapshot.length}`,
                    item.file.name
                );

                const bytes = await item.file.arrayBuffer();
                const source = await window.PDFLib.PDFDocument.load(bytes, {
                    ignoreEncryption: false
                });

                const pageIndexes = source.getPageIndices();
                const copiedPages = await merged.copyPages(source, pageIndexes);
                copiedPages.forEach(page => merged.addPage(page));

                setProcessingProgress(
                    8 + ((index + 1) / snapshot.length) * 82,
                    `Merging document ${index + 1} of ${snapshot.length}`,
                    item.file.name
                );
            }

            setProcessingProgress(93, "Finalizing merged PDF", "Creating your download file.");
            const mergedBytes = await merged.save();
            const blob = new Blob([mergedBytes], { type: "application/pdf" });

            if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
            outputBlobUrl = URL.createObjectURL(blob);

            el.outputName.value = outputName;
            const total = snapshot.reduce((result, item) => {
                result.size += item.file.size;
                result.pages += item.pages;
                return result;
            }, { size: 0, pages: 0 });

            setProcessingProgress(100, "PDF merge complete", "Your merged PDF is ready.");
            await new Promise(resolve => setTimeout(resolve, 250));

            el.processing.hidden = true;
            el.resultName.textContent = outputName;
            el.resultFiles.textContent = snapshot.length;
            el.resultPages.textContent = total.pages;
            el.resultSize.textContent = formatBytes(blob.size);
            el.results.hidden = false;
            el.results.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            el.processing.hidden = true;
            alert("Unable to merge one or more selected PDFs. Please remove the problematic file and try again.");
            console.error(error);
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

        files = [];
        processing = false;
        warningDismissed = false;
        draggedId = null;
        touchDrag = null;

        el.input.value = "";
        el.outputName.value = "merged-document.pdf";
        el.warning.hidden = true;
        el.queue.innerHTML = "";
        el.queuePanel.hidden = true;
        el.settings.hidden = true;
        el.processing.hidden = true;
        el.results.hidden = true;
        setProcessingProgress(0, "Preparing PDF files", "Preparing your documents.");
        updateSummary();
    }

    el.input.addEventListener("change", event => addFiles(event.target.files));

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
        if (!processing) addFiles(event.dataTransfer.files);
    });

    el.warningClose.addEventListener("click", dismissWarning);
    el.warningDismiss.addEventListener("click", dismissWarning);
    el.warningBackdrop.addEventListener("click", dismissWarning);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !el.warning.hidden) {
            dismissWarning();
        }
    });

    el.clear.addEventListener("click", () => {
        resetTool();
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
        const handle = event.target.closest("[data-drag-handle]");
        if (!handle || processing) return;
        draggedId = handle.dataset.dragHandle;
        const item = handle.closest(".pdf-queue-item");
        item?.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
    });

    el.queue.addEventListener("dragover", event => {
        if (!draggedId || processing) return;
        const target = event.target.closest(".pdf-queue-item");
        if (!target) return;
        event.preventDefault();
        document.querySelectorAll(".pdf-queue-item.is-drop-target")
            .forEach(node => node.classList.remove("is-drop-target"));
        target.classList.add("is-drop-target");
    });

    el.queue.addEventListener("drop", event => {
        if (!draggedId || processing) return;
        event.preventDefault();
        const target = event.target.closest(".pdf-queue-item");
        if (target) moveItemTo(draggedId, target.dataset.id);
        draggedId = null;
    });

    el.queue.addEventListener("dragend", () => {
        draggedId = null;
        document.querySelectorAll(".pdf-queue-item")
            .forEach(node => node.classList.remove("is-dragging", "is-drop-target"));
    });

    el.queue.addEventListener("pointerdown", event => {
        const handle = event.target.closest("[data-drag-handle]");
        if (!handle || processing || event.pointerType === "mouse") return;

        touchDrag = {
            id: handle.dataset.dragHandle,
            handle,
            item: handle.closest(".pdf-queue-item")
        };
        handle.setPointerCapture?.(event.pointerId);
        touchDrag.item?.classList.add("is-dragging");
    });

    el.queue.addEventListener("pointermove", event => {
        if (!touchDrag) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)
            ?.closest(".pdf-queue-item");
        if (!target || target.dataset.id === touchDrag.id) return;
        moveItemTo(touchDrag.id, target.dataset.id);
    });

    function endTouchDrag() {
        if (touchDrag?.item) touchDrag.item.classList.remove("is-dragging");
        touchDrag = null;
    }

    el.queue.addEventListener("pointerup", endTouchDrag);
    el.queue.addEventListener("pointercancel", endTouchDrag);

    el.outputName.addEventListener("blur", () => {
        el.outputName.value = sanitizeFileName(el.outputName.value);
    });

    el.start.addEventListener("click", mergePDFs);

    el.download.addEventListener("click", () => {
        if (!outputBlobUrl) return;
        const anchor = document.createElement("a");
        anchor.href = outputBlobUrl;
        anchor.download = sanitizeFileName(el.outputName.value);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    });

    el.mergeMore.addEventListener("click", () => {
        resetTool();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("beforeunload", () => {
        if (outputBlobUrl) URL.revokeObjectURL(outputBlobUrl);
    });

    updateSummary();
})();
