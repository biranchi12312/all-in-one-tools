(() => {
"use strict";

const view = document.getElementById("cropRotateView");
if (!view) return;

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_PIXELS = 40000000;
const MAX_SOURCE_DIMENSION = 9000;
const MAX_OUTPUT_DIMENSION = 4096;

const RATIOS = {
    free: null,
    original: "original",
    "1:1": 1,
    "4:5": 4 / 5,
    "3:4": 3 / 4,
    "16:9": 16 / 9,
    "9:16": 9 / 16
};

const el = {
    dropZone: document.getElementById("crDropZone"),
    input: document.getElementById("crFileInput"),
    editor: document.getElementById("crEditor"),
    stage: document.getElementById("crStage"),
    frame: document.getElementById("crFrame"),
    image: document.getElementById("crImage"),
    overlay: document.getElementById("crOverlay"),
    box: document.getElementById("crBox"),
    fileMeta: document.getElementById("crFileMeta"),
    status: document.getElementById("crStatus"),
    rotLeft: document.getElementById("crRotLeft"),
    rotRight: document.getElementById("crRotRight"),
    flipH: document.getElementById("crFlipH"),
    flipV: document.getElementById("crFlipV"),
    ratios: document.getElementById("crRatios"),
    reset: document.getElementById("crResetBtn"),
    exportBtn: document.getElementById("crExportBtn"),
    another: document.getElementById("crAnotherBtn"),
    results: document.getElementById("crResults"),
    resultImg: document.getElementById("crResultImg"),
    resultMeta: document.getElementById("crResultMeta"),
    download: document.getElementById("crDownloadBtn")
};

if (!el.dropZone || !el.input || !el.stage) return;

const state = {
    file: null,
    sourceURL: "",
    bitmap: null,
    srcW: 0,
    srcH: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
    ratio: "free",
    crop: { x: 0, y: 0, w: 1, h: 1 },
    processing: false,
    resultURL: "",
    resultName: "",
    drag: null
};

let lastWinWidth = window.innerWidth;

function dialog() {
    return window.AuraDialog || null;
}

function popupError(title, message) {
    const ui = dialog();
    if (ui) return ui.error(title, message);
    window.alert(`${title}\n\n${message}`);
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
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
    const v = n / Math.pow(1024, i);
    return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function guessType(file) {
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

function transformedSize() {
    const rot = ((state.rotation % 360) + 360) % 360;
    if (rot === 90 || rot === 270) return { w: state.srcH, h: state.srcW };
    return { w: state.srcW, h: state.srcH };
}

function revokeSource() {
    if (state.sourceURL) {
        URL.revokeObjectURL(state.sourceURL);
        state.sourceURL = "";
    }
    if (state.bitmap && typeof state.bitmap.close === "function") {
        try { state.bitmap.close(); } catch (_) { /* ignore */ }
    }
    state.bitmap = null;
}

function revokeResult() {
    if (state.resultURL) {
        URL.revokeObjectURL(state.resultURL);
        state.resultURL = "";
    }
    if (el.resultImg) el.resultImg.removeAttribute("src");
}

function setStatus(text) {
    if (el.status) el.status.textContent = text || "";
}

function setProcessing(on) {
    state.processing = on;
    window.__auraProcessing = !!on;
    [el.exportBtn, el.reset, el.another, el.rotLeft, el.rotRight, el.flipH, el.flipV].forEach(btn => {
        if (btn) btn.disabled = on;
    });
    if (el.dropZone) {
        el.dropZone.classList.toggle("is-disabled", on);
        el.dropZone.setAttribute("aria-disabled", String(!!on));
    }
}

function layoutFrame() {
    if (!el.stage || !el.frame || !state.srcW) return;

    // Measure available width without the frame skewing layout
    el.frame.style.visibility = "hidden";
    el.frame.style.display = "block";
    const style = window.getComputedStyle(el.stage);
    const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const maxW = Math.max(80, el.stage.clientWidth - padX);
    el.frame.style.visibility = "visible";

    // Fit entire transformed bounding box on screen
    const maxH = Math.min(window.innerHeight * 0.55, 600);
    const tSize = transformedSize();
    const scale = Math.min(
        maxW / Math.max(1, tSize.w),
        maxH / Math.max(1, tSize.h)
    );

    const finalW = Math.max(10, tSize.w * scale);
    const finalH = Math.max(10, tSize.h * scale);

    el.frame.style.width = `${finalW}px`;
    el.frame.style.height = `${finalH}px`;
    el.frame.style.aspectRatio = "auto";
    el.frame.style.position = "relative";
    // Clip any sub-pixel overflow after rotate so image never bleeds outside the crop frame
    el.frame.style.overflow = "hidden";

    if (el.image) {
        // Source proportions first; CSS rotate/flip maps into the swapped frame from center.
        el.image.style.width = `${state.srcW * scale}px`;
        el.image.style.height = `${state.srcH * scale}px`;
        el.image.style.position = "absolute";
        el.image.style.left = "50%";
        el.image.style.top = "50%";
        el.image.style.right = "auto";
        el.image.style.bottom = "auto";
        el.image.style.maxWidth = "none";
        el.image.style.maxHeight = "none";
        el.image.style.margin = "0";
        el.image.style.objectFit = "fill";
        el.image.style.transformOrigin = "center center";

        const rot = ((state.rotation % 360) + 360) % 360;
        const sx = state.flipH ? -1 : 1;
        const sy = state.flipV ? -1 : 1;
        el.image.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${sx}, ${sy})`;
    }

    applyCropBox();
}

function applyCropBox() {
    if (!el.box) return;
    const c = state.crop;
    el.box.style.left = `${c.x * 100}%`;
    el.box.style.top = `${c.y * 100}%`;
    el.box.style.width = `${c.w * 100}%`;
    el.box.style.height = `${c.h * 100}%`;
}

function clampCrop(c) {
    let { x, y, w, h } = c;
    w = Math.min(1, Math.max(0.04, w));
    h = Math.min(1, Math.max(0.04, h));
    x = Math.min(1 - w, Math.max(0, x));
    y = Math.min(1 - h, Math.max(0, y));
    return { x, y, w, h };
}

function currentRatioValue() {
    if (state.ratio === "free") return null;
    if (state.ratio === "original") {
        const t = transformedSize();
        return t.w / Math.max(1, t.h);
    }
    return RATIOS[state.ratio] || null;
}

function fitCropToRatio() {
    const r = currentRatioValue();
    if (!r) {
        state.crop = { x: 0, y: 0, w: 1, h: 1 };
        applyCropBox();
        return;
    }
    const t = transformedSize();
    const imgR = t.w / Math.max(1, t.h);
    let w = 1;
    let h = 1;
    if (imgR > r) {
        w = r / imgR;
        h = 1;
    } else {
        w = 1;
        h = imgR / r;
    }
    state.crop = clampCrop({
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        w,
        h
    });
    applyCropBox();
}

function afterTransform() {
    // After rotate/flip: rebuild frame for new bounds, then re-fit crop ratio
    if (state.ratio !== "free") fitCropToRatio();
    else {
        state.crop = { x: 0, y: 0, w: 1, h: 1 };
        applyCropBox();
    }
    layoutFrame();
}

function resetEdits(keepImage) {
    state.rotation = 0;
    state.flipH = false;
    state.flipV = false;
    state.ratio = "free";
    state.crop = { x: 0, y: 0, w: 1, h: 1 };
    syncRatioButtons();
    layoutFrame();
    if (keepImage) setStatus("Edits reset. Original framing restored.");
}

function syncRatioButtons() {
    if (!el.ratios) return;
    el.ratios.querySelectorAll("[data-cr-ratio]").forEach(btn => {
        btn.classList.toggle("is-active", btn.getAttribute("data-cr-ratio") === state.ratio);
    });
}

function fullReset() {
    revokeSource();
    revokeResult();
    state.file = null;
    state.srcW = 0;
    state.srcH = 0;
    state.processing = false;
    state.resultName = "";
    resetEdits(false);
    if (el.image) {
        el.image.removeAttribute("src");
        el.image.style.transform = "";
        el.image.style.width = "";
        el.image.style.height = "";
    }
    if (el.editor) el.editor.hidden = true;
    if (el.results) el.results.hidden = true;
    if (el.dropZone) el.dropZone.hidden = false;
    if (el.input) el.input.value = "";
    setStatus("");
    setProcessing(false);
}

function loadImageElement(url) {
    return new Promise((resolve, reject) => {
        if (!el.image) {
            reject(new Error("Image preview is missing."));
            return;
        }
        const onLoad = () => {
            el.image.removeEventListener("error", onError);
            resolve();
        };
        const onError = () => {
            el.image.removeEventListener("load", onLoad);
            reject(new Error("Could not decode this image."));
        };
        el.image.addEventListener("load", onLoad, { once: true });
        el.image.addEventListener("error", onError, { once: true });
        el.image.src = url;
    });
}

async function loadFile(file) {
    if (state.processing) return;
    const type = guessType(file);
    if (!type) {
        await popupError("Unsupported file", "Use JPG, PNG, or WebP.");
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        await popupError("File too large", `Maximum is ${formatBytes(MAX_FILE_SIZE)}.`);
        return;
    }
    if (file.size <= 0) {
        await popupError("Empty file", "This file has no content.");
        return;
    }

    setProcessing(true);
    setStatus("Reading image…");
    const nextURL = URL.createObjectURL(file);
    try {
        await loadImageElement(nextURL);
        const w = el.image.naturalWidth || 0;
        const h = el.image.naturalHeight || 0;
        if (!w || !h) {
            throw new Error("Could not read image size.");
        }
        if (w * h > MAX_PIXELS || Math.max(w, h) > MAX_SOURCE_DIMENSION) {
            throw new Error(
                `Image is too large (${w}×${h}). Max ${MAX_SOURCE_DIMENSION}px side.`
            );
        }
        revokeSource();
        revokeResult();
        state.file = file;
        state.bitmap = null;
        state.srcW = w;
        state.srcH = h;
        state.sourceURL = nextURL;
        state.rotation = 0;
        state.flipH = false;
        state.flipV = false;
        state.ratio = "free";
        state.crop = { x: 0, y: 0, w: 1, h: 1 };
        el.image.style.transform = "";
        if (el.fileMeta) {
            el.fileMeta.textContent = `${file.name} · ${w}×${h} · ${formatBytes(file.size)}`;
        }
        if (el.dropZone) el.dropZone.hidden = true;
        if (el.results) el.results.hidden = true;
        if (el.editor) el.editor.hidden = false;
        syncRatioButtons();
        lastWinWidth = window.innerWidth;

        requestAnimationFrame(() => {
            layoutFrame();
            setStatus("Drag the frame to crop. Rotate or flip, then export.");
        });
    } catch (error) {
        URL.revokeObjectURL(nextURL);
        fullReset();
        await popupError("Could not open image", error.message || "Try another file.");
    } finally {
        setProcessing(false);
        if (el.input) el.input.value = "";
    }
}

function startDrag(kind, event) {
    if (state.processing || !el.frame) return;
    event.preventDefault();
    const rect = el.frame.getBoundingClientRect();
    state.drag = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        rectW: rect.width,
        rectH: rect.height,
        crop: { ...state.crop }
    };
    el.box.classList.add("is-dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    document.addEventListener("pointerleave", endDrag);
}

function onPointerMove(event) {
    const d = state.drag;
    if (!d) return;
    const dx = (event.clientX - d.startX) / Math.max(1, d.rectW);
    const dy = (event.clientY - d.startY) / Math.max(1, d.rectH);
    let { x, y, w, h } = d.crop;
    const ratio = currentRatioValue();

    if (d.kind === "move") {
        x += dx;
        y += dy;
    } else {
        if (d.kind.includes("w")) {
            const nx = Math.min(x + w - 0.04, x + dx);
            w = x + w - nx;
            x = nx;
        }
        if (d.kind.includes("e")) {
            w = Math.max(0.04, w + dx);
        }
        if (d.kind.includes("n")) {
            const ny = Math.min(y + h - 0.04, y + dy);
            h = y + h - ny;
            y = ny;
        }
        if (d.kind.includes("s")) {
            h = Math.max(0.04, h + dy);
        }
        if (ratio) {
            const t = transformedSize();
            const imgR = t.w / Math.max(1, t.h);
            if (d.kind === "n" || d.kind === "s") {
                w = (h * ratio) / imgR;
                if (x + w > 1) {
                    w = 1 - x;
                    h = (w * imgR) / ratio;
                }
            } else {
                h = (w * imgR) / ratio;
                if (y + h > 1) {
                    h = 1 - y;
                    w = (h * ratio) / imgR;
                }
            }
        }
    }
    state.crop = clampCrop({ x, y, w, h });
    applyCropBox();
}

function endDrag() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("blur", endDrag);
    document.removeEventListener("pointerleave", endDrag);
    if (!state.drag) return;
    state.drag = null;
    el.box?.classList.remove("is-dragging");
}

async function exportImage() {
    if (state.processing || !state.file || !el.image || !state.srcW) return;
    setProcessing(true);
    setStatus("Exporting…");
    let temp = null;
    let out = null;
    try {
        const t = transformedSize();
        temp = document.createElement("canvas");
        temp.width = t.w;
        temp.height = t.h;
        const ctx = temp.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable on this device.");

        ctx.save();
        ctx.translate(t.w / 2, t.h / 2);
        ctx.rotate((state.rotation * Math.PI) / 180);
        ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
        ctx.drawImage(el.image, -state.srcW / 2, -state.srcH / 2, state.srcW, state.srcH);
        ctx.restore();

        const sx = Math.round(state.crop.x * t.w);
        const sy = Math.round(state.crop.y * t.h);
        const sw = Math.max(1, Math.round(state.crop.w * t.w));
        const sh = Math.max(1, Math.round(state.crop.h * t.h));
        if (sw < 2 || sh < 2) {
            throw new Error("Crop area is too small. Enlarge the frame and try again.");
        }

        let ow = sw;
        let oh = sh;
        const long = Math.max(ow, oh);
        if (long > MAX_OUTPUT_DIMENSION) {
            const s = MAX_OUTPUT_DIMENSION / long;
            ow = Math.max(1, Math.round(ow * s));
            oh = Math.max(1, Math.round(oh * s));
        }

        out = document.createElement("canvas");
        out.width = ow;
        out.height = oh;
        const octx = out.getContext("2d");
        if (!octx) throw new Error("Canvas is unavailable on this device.");
        const type = guessType(state.file) || "image/jpeg";
        if (type === "image/jpeg") {
            octx.fillStyle = "#ffffff";
            octx.fillRect(0, 0, ow, oh);
        }
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = "high";
        octx.drawImage(temp, sx, sy, sw, sh, 0, 0, ow, oh);

        const blob = await new Promise((resolve, reject) => {
            const q = type === "image/png" ? undefined : 0.92;
            out.toBlob(b => (b ? resolve(b) : reject(new Error("Export failed."))), type, q);
        });

        revokeResult();
        state.resultURL = URL.createObjectURL(blob);
        const base = (state.file.name || "image").replace(/\.[^.]+$/, "") || "image";
        const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
        state.resultName = `${base}-edited.${ext}`;

        if (el.resultImg) el.resultImg.src = state.resultURL;
        if (el.resultMeta) {
            el.resultMeta.textContent = `${ow}×${oh} · ${formatBytes(blob.size)}`;
        }
        if (el.download) {
            el.download.href = state.resultURL;
            el.download.download = state.resultName;
        }
        if (el.results) el.results.hidden = false;
        el.results?.scrollIntoView({ behavior: "smooth", block: "start" });
        setStatus("Export ready.");
    } catch (error) {
        await popupError("Export failed", error.message || "Please try again.");
        setStatus("Export failed. Adjust the crop and try again.");
    } finally {
        if (temp) { temp.width = 0; temp.height = 0; }
        if (out) { out.width = 0; out.height = 0; }
        setProcessing(false);
    }
}

el.dropZone.addEventListener("click", () => {
    if (!state.processing) el.input.click();
});
el.dropZone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!state.processing) el.input.click();
    }
});
["dragenter", "dragover"].forEach(type => {
    el.dropZone.addEventListener(type, e => {
        e.preventDefault();
        if (!state.processing) el.dropZone.classList.add("is-dragover");
    });
});
["dragleave", "drop"].forEach(type => {
    el.dropZone.addEventListener(type, e => {
        e.preventDefault();
        el.dropZone.classList.remove("is-dragover");
    });
});
el.dropZone.addEventListener("drop", e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
});
el.input.addEventListener("change", () => {
    const file = el.input.files?.[0];
    el.input.value = "";
    if (file) loadFile(file);
});

el.rotLeft?.addEventListener("click", () => {
    if (state.processing || !state.file) return;
    state.rotation = (state.rotation + 270) % 360;
    afterTransform();
});
el.rotRight?.addEventListener("click", () => {
    if (state.processing || !state.file) return;
    state.rotation = (state.rotation + 90) % 360;
    afterTransform();
});
el.flipH?.addEventListener("click", () => {
    if (state.processing || !state.file) return;
    state.flipH = !state.flipH;
    afterTransform();
});
el.flipV?.addEventListener("click", () => {
    if (state.processing || !state.file) return;
    state.flipV = !state.flipV;
    afterTransform();
});

el.ratios?.addEventListener("click", e => {
    const btn = e.target.closest("[data-cr-ratio]");
    if (!btn || state.processing) return;
    state.ratio = btn.getAttribute("data-cr-ratio") || "free";
    syncRatioButtons();
    fitCropToRatio();
});

el.reset?.addEventListener("click", async () => {
    if (!state.file || state.processing) return;
    const ok = await popupConfirm("Reset edits?", "Crop, rotation and flips go back to the original image.");
    if (ok) resetEdits(true);
});

el.another?.addEventListener("click", async () => {
    if (state.processing) return;
    if (state.file) {
        const ok = await popupConfirm(
            "Edit another image?",
            "This clears the current image and result. Original files on your device stay unchanged."
        );
        if (!ok) return;
    }
    fullReset();
    window.scrollTo(0, 0);
});

el.exportBtn?.addEventListener("click", () => exportImage());

el.box?.addEventListener("pointerdown", e => {
    if (e.target.closest("[data-cr-handle]")) return;
    startDrag("move", e);
    el.box.setPointerCapture?.(e.pointerId);
});
el.box?.querySelectorAll("[data-cr-handle]").forEach(handle => {
    handle.addEventListener("pointerdown", e => {
        e.stopPropagation();
        startDrag(handle.getAttribute("data-cr-handle"), e);
        handle.setPointerCapture?.(e.pointerId);
    });
});

el.image?.addEventListener("load", () => {
    requestAnimationFrame(layoutFrame);
});

window.addEventListener("resize", () => {
    if (!state.file) return;
    if (window.innerWidth === lastWinWidth) return;
    lastWinWidth = window.innerWidth;
    layoutFrame();
});

window.addEventListener("aurastudio:viewchange", e => {
    if (e.detail?.view !== "cropRotate") {
        endDrag();
        if (state.file || state.bitmap) fullReset();
    }
});

window.addEventListener("beforeunload", () => {
    revokeSource();
    revokeResult();
});
})();
