document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       GLOBAL LIMITS
    ========================================================= */

    const MAX_FILES = 100;
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    const MAX_TOTAL_SIZE = 500 * 1024 * 1024;


    /* =========================================================
       HELPERS
    ========================================================= */

    function formatBytes(bytes) {

        if (!bytes) {
            return "0 Bytes";
        }

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB"
        ];

        const index = Math.floor(
            Math.log(bytes) / Math.log(1024)
        );

        return `${(
            bytes / Math.pow(1024, index)
        ).toFixed(
            index === 0 ? 0 : 2
        )} ${units[index]}`;
    }


    function isSupportedImage(file) {

        const supportedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        return supportedTypes.includes(file.type);
    }


    function getBaseName(fileName) {

        const lastDot = fileName.lastIndexOf(".");

        if (lastDot === -1) {
            return fileName;
        }

        return fileName.substring(0, lastDot);
    }


    function showError(message) {
        alert(message);
    }


    function escapeHTML(value) {

        const div = document.createElement("div");

        div.textContent = value;

        return div.innerHTML;
    }


    function createPreviewURL(file) {
        return URL.createObjectURL(file);
    }


    function revokePreviewURLs(files) {

        files.forEach(item => {

            if (item.previewURL) {
                URL.revokeObjectURL(item.previewURL);
            }

        });
    }


    function revokeProcessedURLs(files) {

        files.forEach(item => {

            if (item.url) {
                URL.revokeObjectURL(item.url);
            }

        });
    }


    /* =========================================================
       VIEW ROUTING
    ========================================================= */

    const views = {
        dashboard: document.getElementById("dashboardView"),
        compressor: document.getElementById("compressorView"),
        converter: document.getElementById("converterView"),
        pdfMerge: document.getElementById("pdfMergeView")
    };


    function renderView(viewName) {

        Object.values(views).forEach(view => {
            view.classList.remove("active");
        });


        if (views[viewName]) {
            views[viewName].classList.add("active");
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        if (viewName === "dashboard") {
            setTimeout(initScrollAnimations, 100);
        }

        window.dispatchEvent(
            new CustomEvent("aurastudio:viewchange", {
                detail: { view: viewName }
            })
        );
    }


    function switchView(
        viewName,
        pushHistory = true
    ) {

        renderView(viewName);


        if (!pushHistory) {
            return;
        }


        const currentState = history.state;


        if (
            !currentState ||
            currentState.view !== viewName
        ) {

            history.pushState(
                {
                    view: viewName
                },
                "",
                `#${viewName}`
            );

        }
    }


    function getViewFromHash() {

        const hash = window.location.hash.replace(
            "#",
            ""
        );


        if (
            hash === "dashboard" ||
            hash === "compressor" ||
            hash === "converter" ||
            hash === "pdfMerge"
        ) {
            return hash;
        }


        return "dashboard";
    }


    const initialView = getViewFromHash();


    history.replaceState(
        {
            view: initialView
        },
        "",
        initialView === "dashboard"
            ? location.pathname
            : `#${initialView}`
    );


    renderView(initialView);


    window.addEventListener(
        "popstate",
        event => {

            const viewName =
                event.state?.view ||
                getViewFromHash();

            renderView(viewName);

        }
    );


    /* =========================================================
       TOOL BUTTONS + HERO BUTTONS
    ========================================================= */

    document.querySelectorAll(
        "[data-open-view]"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const viewName =
                    button.dataset.openView;

                switchView(viewName);

            }
        );

    });


    /* =========================================================
       BACK BUTTONS
    ========================================================= */

    document.querySelectorAll(
        "[data-back-dashboard]"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const currentView =
                    getViewFromHash();


                if (
                    currentView === "compressor" ||
                    currentView === "converter" ||
                    currentView === "pdfMerge"
                ) {

                    history.back();

                } else {

                    switchView("dashboard");

                }

            }
        );

    });


    /* =========================================================
       LOGO BUTTON
    ========================================================= */

    const logoButton =
        document.getElementById("logoBtn");


    logoButton.addEventListener(
        "click",
        () => {

            const currentView =
                getViewFromHash();


            if (currentView !== "dashboard") {

                history.back();

            } else {

                renderView("dashboard");

            }

        }
    );


    /* =========================================================
       SCROLL ANIMATIONS
    ========================================================= */

    let revealObserver;


    function initScrollAnimations() {

        if (revealObserver) {
            revealObserver.disconnect();
        }


        const revealElements =
            document.querySelectorAll(".reveal");


        if (!("IntersectionObserver" in window)) {

            revealElements.forEach(element => {
                element.classList.add("visible");
            });

            return;
        }


        revealObserver =
            new IntersectionObserver(
                entries => {

                    entries.forEach(entry => {

                        if (entry.isIntersecting) {

                            entry.target.classList.add(
                                "visible"
                            );

                            revealObserver.unobserve(
                                entry.target
                            );

                        }

                    });

                },
                {
                    threshold: 0.12,
                    rootMargin: "0px 0px -60px 0px"
                }
            );


        revealElements.forEach(element => {

            if (
                element.getBoundingClientRect().top <
                window.innerHeight
            ) {

                setTimeout(
                    () => {
                        element.classList.add("visible");
                    },
                    100
                );

            } else {

                revealObserver.observe(element);

            }

        });

    }


    initScrollAnimations();


    /* =========================================================
       FAQ
    ========================================================= */

    document.querySelectorAll(
        ".faq-question"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const item =
                    button.closest(".faq-item");

                const answer =
                    button.nextElementSibling;


                const isOpen =
                    item.classList.contains("open");


                document.querySelectorAll(
                    ".faq-item"
                ).forEach(otherItem => {

                    if (otherItem !== item) {

                        otherItem.classList.remove("open");

                        const otherAnswer =
                            otherItem.querySelector(
                                ".faq-answer"
                            );

                        if (otherAnswer) {
                            otherAnswer.style.maxHeight =
                                null;
                        }

                    }

                });


                if (isOpen) {

                    item.classList.remove("open");

                    answer.style.maxHeight = null;

                } else {

                    item.classList.add("open");

                    answer.style.maxHeight =
                        `${answer.scrollHeight}px`;

                }

            }
        );

    });


    /* =========================================================
       FILE VALIDATION
    ========================================================= */

    function validateFiles(
        fileList,
        existingFiles = []
    ) {

        const incomingFiles =
            Array.from(fileList);

        const validFiles = [];


        const existingTotal =
            existingFiles.reduce(
                (total, item) =>
                    total + item.file.size,
                0
            );


        let runningTotal =
            existingTotal;


        for (const file of incomingFiles) {

            if (!isSupportedImage(file)) {
                continue;
            }


            if (file.size > MAX_FILE_SIZE) {

                showError(
                    `"${file.name}" is larger than 100 MB and was skipped.`
                );

                continue;
            }


            if (
                existingFiles.length +
                validFiles.length >=
                MAX_FILES
            ) {
                break;
            }


            if (
                runningTotal + file.size >
                MAX_TOTAL_SIZE
            ) {

                showError(
                    "Total batch size reached the 500 MB safety limit."
                );

                break;
            }


            validFiles.push({
                file: file,
                previewURL:
                    createPreviewURL(file)
            });


            runningTotal += file.size;
        }


        return validFiles;
    }


    /* =========================================================
       QUEUE UI
    ========================================================= */

    function renderQueue(
        files,
        queueElement,
        queuePanel,
        summaryElement
    ) {

        queueElement.innerHTML = "";


        if (files.length === 0) {

            queuePanel.hidden = true;

            return;
        }


        queuePanel.hidden = false;


        const totalSize =
            files.reduce(
                (total, item) =>
                    total + item.file.size,
                0
            );


        summaryElement.textContent =
            `${files.length} image${
                files.length !== 1
                    ? "s"
                    : ""
            } uploaded • ${
                formatBytes(totalSize)
            }`;


        files.forEach((item, index) => {

            const file = item.file;


            const row =
                document.createElement("div");


            row.className = "queue-item";


            row.style.animationDelay =
                `${Math.min(index * 0.03, 0.5)}s`;


            row.innerHTML = `

                <div class="file-preview">

                    <img
                        src="${item.previewURL}"
                        alt=""
                    >

                </div>


                <div class="file-details">

                    <div
                        class="file-name"
                        title="${escapeHTML(file.name)}"
                    >
                        ${escapeHTML(file.name)}
                    </div>


                    <div class="file-size">
                        ${formatBytes(file.size)}
                    </div>

                </div>


                <div class="upload-status">

                    <div class="green-check">
                        ✓
                    </div>

                    <span>
                        Uploaded
                    </span>

                </div>

            `;


            queueElement.appendChild(row);

        });

    }


    /* =========================================================
       DRAG AND DROP
    ========================================================= */

    function setupDropZone(
        dropZone,
        callback
    ) {

        [
            "dragenter",
            "dragover"
        ].forEach(eventName => {

            dropZone.addEventListener(
                eventName,
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    dropZone.classList.add(
                        "drag-over"
                    );

                }
            );

        });


        [
            "dragleave",
            "drop"
        ].forEach(eventName => {

            dropZone.addEventListener(
                eventName,
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    dropZone.classList.remove(
                        "drag-over"
                    );

                }
            );

        });


        dropZone.addEventListener(
            "drop",
            event => {

                if (
                    event.dataTransfer &&
                    event.dataTransfer.files
                ) {

                    callback(
                        event.dataTransfer.files
                    );

                }

            }
        );

    }


    /* =========================================================
       COMPRESSOR
    ========================================================= */

    const comp = {

        input:
            document.getElementById(
                "compFileInput"
            ),

        dropZone:
            document.getElementById(
                "compDropZone"
            ),

        queuePanel:
            document.getElementById(
                "compQueuePanel"
            ),

        queue:
            document.getElementById(
                "compFileQueue"
            ),

        queueSummary:
            document.getElementById(
                "compQueueSummary"
            ),

        clearButton:
            document.getElementById(
                "compClearBtn"
            ),

        settings:
            document.getElementById(
                "compSettingsPanel"
            ),

        quality:
            document.getElementById(
                "compQualitySlider"
            ),

        qualityValue:
            document.getElementById(
                "compQualityVal"
            ),

        count:
            document.getElementById(
                "compFileCount"
            ),

        start:
            document.getElementById(
                "compStartBtn"
            ),

        results:
            document.getElementById(
                "compResultsPanel"
            ),

        resultsList:
            document.getElementById(
                "compResultsList"
            ),

        resultSummary:
            document.getElementById(
                "compResultSummary"
            ),

        processMore:
            document.getElementById(
                "compProcessMoreBtn"
            ),

        zip:
            document.getElementById(
                "compZipBtn"
            )
    };


    let compFiles = [];
    let processedCompFiles = [];


    function addCompressorFiles(fileList) {

        const newFiles =
            validateFiles(
                fileList,
                compFiles
            );


        if (newFiles.length === 0) {

            if (compFiles.length === 0) {
                comp.input.value = "";
            }

            return;
        }


        compFiles = [
            ...compFiles,
            ...newFiles
        ];


        renderQueue(
            compFiles,
            comp.queue,
            comp.queuePanel,
            comp.queueSummary
        );


        comp.settings.hidden = false;


        comp.count.textContent =
            `${compFiles.length} file${
                compFiles.length !== 1
                    ? "s"
                    : ""
            } ready`;


        comp.input.value = "";
    }


    comp.input.addEventListener(
        "change",
        event => {

            addCompressorFiles(
                event.target.files
            );

        }
    );


    setupDropZone(
        comp.dropZone,
        addCompressorFiles
    );


    comp.clearButton.addEventListener(
        "click",
        () => {

            clearCompressorSelection();

        }
    );


    function clearCompressorSelection() {

        revokePreviewURLs(compFiles);

        compFiles = [];


        renderQueue(
            compFiles,
            comp.queue,
            comp.queuePanel,
            comp.queueSummary
        );


        comp.settings.hidden = true;


        comp.count.textContent =
            "0 files loaded";


        comp.input.value = "";
    }


    function paintRangeProgress(input) {
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        const value = Number(input.value);
        const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

        input.style.setProperty(
            "--range-progress",
            `${Math.max(0, Math.min(100, percent))}%`
        );
    }

    comp.quality.addEventListener(
        "input",
        event => {
            comp.qualityValue.textContent =
                `${event.target.value}%`;
            paintRangeProgress(event.target);
        }
    );

    paintRangeProgress(comp.quality);

    comp.start.addEventListener(
        "click",
        async () => {

            if (compFiles.length === 0) {
                return;
            }


            revokeProcessedURLs(
                processedCompFiles
            );


            processedCompFiles = [];


            comp.resultsList.innerHTML = "";


            comp.start.disabled = true;
            comp.start.textContent =
                "Compressing...";


            comp.results.hidden = false;
            comp.zip.hidden = true;


            const quality =
                Number(comp.quality.value) / 100;


            let successCount = 0;


            for (
                let index = 0;
                index < compFiles.length;
                index++
            ) {

                const item =
                    compFiles[index];

                const file =
                    item.file;


                const row =
                    document.createElement("div");


                row.className =
                    "result-row";


                row.innerHTML = `

                    <div class="result-preview">

                        <img
                            src="${item.previewURL}"
                            alt=""
                        >

                    </div>


                    <div class="file-meta">

                        <h4>
                            ${escapeHTML(file.name)}
                        </h4>

                        <span>
                            Compressing ${
                                index + 1
                            } / ${
                                compFiles.length
                            }...
                        </span>

                    </div>

                `;


                comp.resultsList.appendChild(row);


                try {

                    const result =
                        await compressImage(
                            file,
                            quality
                        );


                    const url =
                        URL.createObjectURL(
                            result.blob
                        );


                    processedCompFiles.push({
                        name: result.name,
                        blob: result.blob,
                        url: url
                    });


                    successCount++;


                    const originalSize =
                        formatBytes(file.size);


                    const newSize =
                        formatBytes(
                            result.blob.size
                        );


                    const saved =
                        file.size > 0
                            ? Math.max(
                                0,
                                Math.round(
                                    (
                                        1 -
                                        result.blob.size /
                                        file.size
                                    ) * 100
                                )
                            )
                            : 0;


                    row.innerHTML = `

                        <div class="result-preview">

                            <img
                                src="${item.previewURL}"
                                alt=""
                            >

                        </div>


                        <div class="file-meta">

                            <h4>
                                ${escapeHTML(
                                    result.name
                                )}
                            </h4>

                            <span>
                                ${originalSize}
                                →
                                <strong>
                                    ${newSize}
                                </strong>
                                • ${saved}% smaller
                            </span>

                        </div>


                        <a
                            href="${url}"
                            download="${escapeHTML(
                                result.name
                            )}"
                            class="download-link"
                        >
                            Download
                        </a>

                    `;


                } catch (error) {

                    console.error(error);


                    row.innerHTML = `

                        <div class="result-preview">

                            <img
                                src="${item.previewURL}"
                                alt=""
                            >

                        </div>


                        <div class="file-meta">

                            <h4>
                                ${escapeHTML(
                                    file.name
                                )}
                            </h4>

                            <span
                                style="color:#ef4444;"
                            >
                                Failed to process
                            </span>

                        </div>

                    `;
                }

            }


            comp.start.disabled = false;
            comp.start.textContent =
                "Compress Images";


            comp.resultSummary.textContent =
                `${successCount} of ${
                    compFiles.length
                } image${
                    compFiles.length !== 1
                        ? "s"
                        : ""
                } processed successfully.`;


            if (
                processedCompFiles.length > 0
            ) {

                comp.zip.hidden = false;

            }


            comp.results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }
    );


    async function compressImage(
        file,
        quality
    ) {

        const bitmap =
            await createImageBitmap(file);


        const MAX_DIMENSION = 4096;


        let width = bitmap.width;
        let height = bitmap.height;


        const longestSide =
            Math.max(width, height);


        if (
            longestSide > MAX_DIMENSION
        ) {

            const ratio =
                MAX_DIMENSION /
                longestSide;


            width =
                Math.round(
                    width * ratio
                );


            height =
                Math.round(
                    height * ratio
                );

        }


        const canvas =
            document.createElement("canvas");


        canvas.width = width;
        canvas.height = height;


        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: true
                }
            );


        context.drawImage(
            bitmap,
            0,
            0,
            width,
            height
        );


        let outputType = file.type;


        if (file.type === "image/png") {
            outputType = "image/webp";
        }


        const blob =
            await new Promise(
                (resolve, reject) => {

                    canvas.toBlob(
                        result => {

                            if (result) {
                                resolve(result);
                            } else {
                                reject(
                                    new Error(
                                        "Compression failed"
                                    )
                                );
                            }

                        },
                        outputType,
                        quality
                    );

                }
            );


        bitmap.close();


        let extension =
            outputType.split("/")[1];


        if (extension === "jpeg") {
            extension = "jpg";
        }


        return {
            blob,
            name:
                `${getBaseName(
                    file.name
                )}_compressed.${extension}`
        };
    }


    function resetCompressor() {

        revokeProcessedURLs(
            processedCompFiles
        );

        revokePreviewURLs(
            compFiles
        );


        processedCompFiles = [];
        compFiles = [];


        comp.input.value = "";


        comp.resultsList.innerHTML = "";


        comp.results.hidden = true;
        comp.zip.hidden = true;
        comp.settings.hidden = true;


        renderQueue(
            compFiles,
            comp.queue,
            comp.queuePanel,
            comp.queueSummary
        );


        comp.count.textContent =
            "0 files loaded";


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    comp.processMore.addEventListener(
        "click",
        resetCompressor
    );


    comp.zip.addEventListener(
        "click",
        async () => {

            if (
                processedCompFiles.length === 0
            ) {
                return;
            }


            if (
                typeof JSZip === "undefined"
            ) {

                showError(
                    "ZIP library could not be loaded. Please check your internet connection."
                );

                return;
            }


            const originalText =
                comp.zip.textContent;


            comp.zip.disabled = true;
            comp.zip.textContent =
                "Creating ZIP...";


            try {

                const zip =
                    new JSZip();


                processedCompFiles.forEach(
                    item => {

                        zip.file(
                            item.name,
                            item.blob
                        );

                    }
                );


                const zipBlob =
                    await zip.generateAsync({
                        type: "blob"
                    });


                downloadBlob(
                    zipBlob,
                    "AuraStudio_Compressed_Images.zip"
                );


            } catch (error) {

                console.error(error);

                showError(
                    "Could not create ZIP archive."
                );

            } finally {

                comp.zip.disabled = false;
                comp.zip.textContent =
                    originalText;

            }

        }
    );


    /* =========================================================
       CONVERTER V2
    ========================================================= */

    const conv = {
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

    const FORMAT_NAMES = {
        auto: "AUTO DETECT",
        "image/jpeg": "JPEG / JPG",
        "image/png": "PNG",
        "image/webp": "WEBP"
    };

    const FORMAT_ACCEPT = {
        auto: "image/jpeg,image/jpg,image/png,image/webp",
        "image/jpeg": "image/jpeg,image/jpg",
        "image/png": "image/png",
        "image/webp": "image/webp"
    };

    let convFiles = [];
    let processedConvFiles = [];
    let convSourceFormat = "auto";
    let convTargetFormat = "image/webp";
    let convJpgBackground = "#ffffff";

    function normalizeImageType(file) {
        if (file.type === "image/jpg") return "image/jpeg";
        return file.type;
    }

    function sourceMatches(file) {
        return convSourceFormat === "auto" || normalizeImageType(file) === convSourceFormat;
    }

    function updateConverterFormatUI() {
        conv.sourceList.querySelectorAll("[data-source-format]").forEach(button => {
            button.classList.toggle("selected", button.dataset.sourceFormat === convSourceFormat);
        });
        conv.targetList.querySelectorAll("[data-target-format]").forEach(button => {
            button.classList.toggle("selected", button.dataset.targetFormat === convTargetFormat);
        });

        conv.input.accept = FORMAT_ACCEPT[convSourceFormat];
        conv.formatSummary.innerHTML = `${FORMAT_NAMES[convSourceFormat]} <span>→</span> ${FORMAT_NAMES[convTargetFormat]}`;

        if (convSourceFormat === "auto") {
            conv.formatNote.textContent = "Auto Detect accepts a mixed batch of currently supported JPG, PNG and WebP images.";
        } else {
            conv.formatNote.textContent = `Upload filter is set to ${FORMAT_NAMES[convSourceFormat]}. The browser will still verify the actual image type.`;
        }

        const usesQuality = convTargetFormat === "image/jpeg" || convTargetFormat === "image/webp";
        conv.qualityGroup.hidden = !usesQuality;
        conv.jpgBackgroundGroup.hidden = convTargetFormat !== "image/jpeg";

        const sameManualFormat = convSourceFormat !== "auto" && convSourceFormat === convTargetFormat;
        conv.start.disabled = sameManualFormat || convFiles.length === 0;
        conv.start.textContent = sameManualFormat ? "Choose a Different Output Format" : "Convert Images";

        if (sameManualFormat) {
            conv.count.textContent = "Source and output formats are the same.";
        } else if (convFiles.length === 0) {
            conv.count.textContent = "0 files loaded";
        } else {
            updateConverterReadyState();
        }
    }

    function updateConverterReadyState() {
        const alreadyTarget = convFiles.filter(item => normalizeImageType(item.file) === convTargetFormat).length;
        const willConvert = convFiles.length - alreadyTarget;
        conv.readySummary.textContent = `${willConvert} to convert${alreadyTarget ? ` • ${alreadyTarget} already target` : ""}`;
        conv.count.textContent = `${convFiles.length} file${convFiles.length !== 1 ? "s" : ""} loaded • ${willConvert} ready to convert`;
        conv.start.disabled = convFiles.length === 0 || (convSourceFormat !== "auto" && convSourceFormat === convTargetFormat);
    }

    conv.sourceList.querySelectorAll("[data-source-format]").forEach(button => {
        button.addEventListener("click", () => {
            convSourceFormat = button.dataset.sourceFormat;
            updateConverterFormatUI();
        });
    });

    conv.targetList.querySelectorAll("[data-target-format]").forEach(button => {
        button.addEventListener("click", () => {
            convTargetFormat = button.dataset.targetFormat;
            updateConverterFormatUI();
        });
    });

    conv.quality.addEventListener("input", event => {
        conv.qualityValue.textContent = `${event.target.value}%`;
        paintRangeProgress(event.target);
    });

    paintRangeProgress(conv.quality);

    document.querySelectorAll(".background-option[data-bg]").forEach(button => {
        button.addEventListener("click", () => {
            convJpgBackground = button.dataset.bg;
            document.querySelectorAll(".background-option[data-bg]").forEach(item => item.classList.remove("selected"));
            document.querySelector(".custom-background-option").classList.remove("selected");
            button.classList.add("selected");
        });
    });

    conv.customBackground.addEventListener("input", event => {
        convJpgBackground = event.target.value;
        document.querySelectorAll(".background-option[data-bg]").forEach(item => item.classList.remove("selected"));
        document.querySelector(".custom-background-option").classList.add("selected");
    });

    function renderConverterQueue() {
        conv.queue.innerHTML = "";
        if (convFiles.length === 0) {
            conv.queuePanel.hidden = true;
            return;
        }
        conv.queuePanel.hidden = false;
        const totalSize = convFiles.reduce((total, item) => total + item.file.size, 0);
        conv.queueSummary.textContent = `${convFiles.length} image${convFiles.length !== 1 ? "s" : ""} uploaded • ${formatBytes(totalSize)}`;

        convFiles.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "queue-item";
            row.innerHTML = `
                <div class="file-preview"><img src="${item.previewURL}" alt=""></div>
                <div class="file-details">
                    <div class="file-name" title="${escapeHTML(item.file.name)}">${escapeHTML(item.file.name)}</div>
                    <div class="file-size">${formatBytes(item.file.size)} • ${FORMAT_NAMES[normalizeImageType(item.file)] || "IMAGE"}</div>
                </div>
                <div class="upload-status"><div class="green-check">✓</div><span>Uploaded</span></div>
                <button type="button" class="queue-remove-btn" data-conv-remove="${index}" aria-label="Remove file">×</button>
            `;
            conv.queue.appendChild(row);
        });

        conv.queue.querySelectorAll("[data-conv-remove]").forEach(button => {
            button.addEventListener("click", () => removeConverterFile(Number(button.dataset.convRemove)));
        });
        updateConverterReadyState();
    }

    function removeConverterFile(index) {
        const item = convFiles[index];
        if (!item) return;
        if (item.previewURL) URL.revokeObjectURL(item.previewURL);
        convFiles.splice(index, 1);
        renderConverterQueue();
        if (convFiles.length === 0) conv.settings.hidden = true;
        updateConverterFormatUI();
    }

    function addConverterFiles(fileList) {
        const incoming = Array.from(fileList);
        const filtered = incoming.filter(file => {
            if (!isSupportedImage(file)) return false;
            if (!sourceMatches(file)) {
                showError(`"${file.name}" does not match the selected source format (${FORMAT_NAMES[convSourceFormat]}).`);
                return false;
            }
            return true;
        });

        const newFiles = validateFiles(filtered, convFiles);
        if (newFiles.length === 0) {
            if (convFiles.length === 0) conv.input.value = "";
            return;
        }

        convFiles = [...convFiles, ...newFiles];
        conv.settings.hidden = false;
        conv.results.hidden = true;
        conv.zip.hidden = true;
        renderConverterQueue();
        updateConverterFormatUI();
        conv.input.value = "";
    }

    conv.input.addEventListener("change", event => addConverterFiles(event.target.files));
    setupDropZone(conv.dropZone, addConverterFiles);

    conv.clearButton.addEventListener("click", clearConverterSelection);

    function clearConverterSelection() {
        revokePreviewURLs(convFiles);
        revokeProcessedURLs(processedConvFiles);
        convFiles = [];
        processedConvFiles = [];
        conv.input.value = "";
        conv.resultsList.innerHTML = "";
        conv.results.hidden = true;
        conv.zip.hidden = true;
        conv.settings.hidden = true;
        conv.progress.hidden = true;
        renderConverterQueue();
        updateConverterFormatUI();
    }

    function setConverterProgress(completed, total, statusText, currentName = "") {
        const percent = total ? Math.round((completed / total) * 100) : 0;
        conv.progress.hidden = false;
        conv.progressFill.style.width = `${percent}%`;
        conv.progressPercent.textContent = `${percent}%`;
        conv.progressTitle.textContent = statusText;
        conv.progressText.textContent = currentName ? `${completed} of ${total} complete • ${currentName}` : `${completed} of ${total} complete`;
    }

    function getPixelSafety(bitmap) {
        const pixels = bitmap.width * bitmap.height;
        const MAX_PIXELS = 40000000;
        const MAX_DIMENSION = 9000;
        if (pixels > MAX_PIXELS || Math.max(bitmap.width, bitmap.height) > MAX_DIMENSION) {
            throw new Error("Image resolution is too large for safe browser-side conversion on this device.");
        }
    }

    function buildResultRow(item) {
        const row = document.createElement("div");
        row.className = "result-row converter-result-row";
        row.innerHTML = `
            <div class="result-preview"><img src="${item.previewURL}" alt=""></div>
            <div class="file-meta"><h4>${escapeHTML(item.file.name)}</h4><span>Waiting to convert...</span></div>
        `;
        return row;
    }

    function formatDelta(original, output) {
        if (!original) return { text: "", className: "" };
        const percent = Math.round(Math.abs((output - original) / original) * 100);
        if (output < original) return { text: `${percent}% smaller`, className: "positive" };
        if (output > original) return { text: `${percent}% larger`, className: "negative" };
        return { text: "Same size", className: "" };
    }

    conv.start.addEventListener("click", async () => {
        if (convFiles.length === 0) return;
        if (convSourceFormat !== "auto" && convSourceFormat === convTargetFormat) {
            showError("Please choose a different output format.");
            return;
        }

        revokeProcessedURLs(processedConvFiles);
        processedConvFiles = [];
        conv.resultsList.innerHTML = "";
        conv.results.hidden = false;
        conv.zip.hidden = true;
        conv.start.disabled = true;
        conv.clearButton.disabled = true;
        conv.start.textContent = "Converting...";

        const rows = convFiles.map(item => {
            const row = buildResultRow(item);
            conv.resultsList.appendChild(row);
            return row;
        });

        let successCount = 0;
        let skippedCount = 0;
        let completed = 0;
        setConverterProgress(0, convFiles.length, "Starting conversion");

        for (let index = 0; index < convFiles.length; index++) {
            const item = convFiles[index];
            const file = item.file;
            const row = rows[index];
            const actualType = normalizeImageType(file);
            setConverterProgress(completed, convFiles.length, "Converting images", file.name);

            if (actualType === convTargetFormat) {
                skippedCount++;
                completed++;
                row.classList.add("is-skipped");
                row.querySelector(".file-meta").innerHTML = `
                    <h4>${escapeHTML(file.name)}</h4>
                    <div class="result-status skipped">↷ Already ${FORMAT_NAMES[convTargetFormat]} — skipped</div>
                    <div class="result-comparison"><span>No format change required</span></div>
                `;
                setConverterProgress(completed, convFiles.length, "Checking images", file.name);
                continue;
            }

            row.querySelector(".file-meta").innerHTML = `<h4>${escapeHTML(file.name)}</h4><span>Converting ${index + 1} / ${convFiles.length}...</span>`;

            try {
                const result = await convertImage(file, convTargetFormat, Number(conv.quality.value) / 100, convJpgBackground);
                const url = URL.createObjectURL(result.blob);
                processedConvFiles.push({ name: result.name, blob: result.blob, url });
                successCount++;
                completed++;
                const delta = formatDelta(file.size, result.blob.size);
                const smartGuardNote =
                    result.smartGuardAdjusted
                        ? `<span class="result-smart-guard">Smart Size Guard adjusted output</span>`
                        : "";

                row.querySelector(".file-meta").innerHTML = `
                    <h4>${escapeHTML(result.name)}</h4>
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
                download.download = result.name;
                download.className = "download-link";
                download.textContent = "Download";
                row.appendChild(download);
            } catch (error) {
                console.error(error);
                completed++;
                row.classList.add("is-failed");
                row.querySelector(".file-meta").innerHTML = `
                    <h4>${escapeHTML(file.name)}</h4>
                    <div class="result-status failed">Failed conversion</div>
                    <div class="result-comparison"><span>${escapeHTML(error.message || "This image could not be converted safely.")}</span></div>
                `;
            }
            setConverterProgress(completed, convFiles.length, completed === convFiles.length ? "Finalizing results" : "Converting images", file.name);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        conv.start.disabled = false;
        conv.clearButton.disabled = false;
        conv.start.textContent = "Convert Images";
        conv.progressTitle.textContent = "Conversion complete";
        conv.progressText.textContent = `${completed} of ${convFiles.length} files processed.`;

        const summaryParts = [`${successCount} converted successfully`];
        if (skippedCount) summaryParts.push(`${skippedCount} already in target format`);
        const failedCount = convFiles.length - successCount - skippedCount;
        if (failedCount) summaryParts.push(`${failedCount} failed`);
        conv.resultSummary.textContent = summaryParts.join(" • ");

        if (processedConvFiles.length > 0) conv.zip.hidden = false;
        conv.results.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    function clampQuality(value) {
        return Math.max(0.02, Math.min(1, Number(value)));
    }

    function canvasToBlob(canvas, targetFormat, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                result => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(new Error("The browser could not create the selected output format."));
                    }
                },
                targetFormat,
                targetFormat === "image/png" ? undefined : clampQuality(quality)
            );
        });
    }

    async function encodeWithSmartSizeGuard(
        canvas,
        sourceType,
        targetFormat,
        requestedQuality,
        originalSize
    ) {
        // PNG output is intentionally untouched by quality and size guarding.
        if (targetFormat === "image/png") {
            return {
                blob: await canvasToBlob(canvas, targetFormat, undefined),
                smartGuardAdjusted: false,
                usedQuality: null
            };
        }

        const normalizedSource =
            sourceType === "image/jpg" ? "image/jpeg" : sourceType;

        const requested = clampQuality(requestedQuality);

        const firstBlob =
            await canvasToBlob(canvas, targetFormat, requested);

        const needsGuard =
            ["image/jpeg", "image/webp"].includes(normalizedSource) &&
            ["image/jpeg", "image/webp"].includes(targetFormat) &&
            normalizedSource !== targetFormat;

        if (!needsGuard || !originalSize || firstBlob.size <= originalSize) {
            return {
                blob: firstBlob,
                smartGuardAdjusted: false,
                usedQuality: requested
            };
        }

        // Binary-search for the highest quality that fits within original size.
        let bestBlob = firstBlob;
        let bestQuality = requested;
        let highQuality = requested;
        let lowQuality = 0.02;

        const lowBlob =
            await canvasToBlob(canvas, targetFormat, lowQuality);

        if (lowBlob.size <= originalSize) {
            let fittingBlob = lowBlob;
            let fittingQuality = lowQuality;

            for (let attempt = 0; attempt < 7; attempt++) {
                const midQuality =
                    (lowQuality + highQuality) / 2;

                const midBlob =
                    await canvasToBlob(
                        canvas,
                        targetFormat,
                        midQuality
                    );

                if (midBlob.size <= originalSize) {
                    lowQuality = midQuality;
                    fittingBlob = midBlob;
                    fittingQuality = midQuality;
                } else {
                    highQuality = midQuality;
                }
            }

            bestBlob = fittingBlob;
            bestQuality = fittingQuality;
        } else if (lowBlob.size < bestBlob.size) {
            // Rare edge case: preserve the requested output format and use the smallest candidate.
            bestBlob = lowBlob;
            bestQuality = 0.02;
        }

        return {
            blob: bestBlob,
            smartGuardAdjusted: true,
            usedQuality: bestQuality
        };
    }

    async function convertImage(
        file,
        targetFormat,
        quality,
        jpgBackground
    ) {
        const bitmap = await createImageBitmap(file);

        try {
            getPixelSafety(bitmap);

            const canvas =
                document.createElement("canvas");

            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const context =
                canvas.getContext(
                    "2d",
                    {
                        alpha:
                            targetFormat !== "image/jpeg"
                    }
                );

            if (!context) {
                throw new Error(
                    "Canvas processing is unavailable in this browser."
                );
            }

            if (targetFormat === "image/jpeg") {
                context.fillStyle =
                    jpgBackground || "#ffffff";

                context.fillRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
            }

            context.drawImage(bitmap, 0, 0);

            const encoded =
                await encodeWithSmartSizeGuard(
                    canvas,
                    normalizeImageType(file),
                    targetFormat,
                    quality,
                    file.size
                );

            let extension =
                targetFormat.split("/")[1];

            if (extension === "jpeg") {
                extension = "jpg";
            }

            return {
                blob: encoded.blob,
                name: `${getBaseName(file.name)}_converted.${extension}`,
                smartGuardAdjusted: encoded.smartGuardAdjusted,
                usedQuality: encoded.usedQuality
            };

        } finally {
            bitmap.close();
        }
    }

    conv.processMore.addEventListener("click", () => {
        clearConverterSelection();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    conv.zip.addEventListener("click", async () => {
        if (processedConvFiles.length === 0) return;
        if (typeof JSZip === "undefined") {
            showError("ZIP library could not be loaded. Please check your internet connection.");
            return;
        }
        const originalText = conv.zip.textContent;
        conv.zip.disabled = true;
        conv.zip.textContent = "Creating ZIP...";
        try {
            const zip = new JSZip();
            processedConvFiles.forEach(item => zip.file(item.name, item.blob));
            const zipBlob = await zip.generateAsync({ type: "blob" });
            downloadBlob(zipBlob, "AuraStudio_Converted_Images.zip");
        } catch (error) {
            console.error(error);
            showError("Could not create ZIP archive.");
        } finally {
            conv.zip.disabled = false;
            conv.zip.textContent = originalText;
        }
    });

    updateConverterFormatUI();

    /* =========================================================
       DOWNLOAD HELPER
    ========================================================= */

    function downloadBlob(
        blob,
        fileName
    ) {

        const url =
            URL.createObjectURL(blob);


        const anchor =
            document.createElement("a");


        anchor.href = url;
        anchor.download = fileName;


        document.body.appendChild(anchor);

        anchor.click();

        anchor.remove();


        setTimeout(
            () => {
                URL.revokeObjectURL(url);
            },
            1000
        );
    }

});