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
        converter: document.getElementById("converterView")
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
            hash === "converter"
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
                    currentView === "converter"
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


    comp.quality.addEventListener(
        "input",
        event => {

            comp.qualityValue.textContent =
                `${event.target.value}%`;

        }
    );


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
       CONVERTER
    ========================================================= */

    const conv = {

        input:
            document.getElementById(
                "convFileInput"
            ),

        dropZone:
            document.getElementById(
                "convDropZone"
            ),

        queuePanel:
            document.getElementById(
                "convQueuePanel"
            ),

        queue:
            document.getElementById(
                "convFileQueue"
            ),

        queueSummary:
            document.getElementById(
                "convQueueSummary"
            ),

        clearButton:
            document.getElementById(
                "convClearBtn"
            ),

        settings:
            document.getElementById(
                "convSettingsPanel"
            ),

        format:
            document.getElementById(
                "targetFormat"
            ),

        count:
            document.getElementById(
                "convFileCount"
            ),

        start:
            document.getElementById(
                "convStartBtn"
            ),

        results:
            document.getElementById(
                "convResultsPanel"
            ),

        resultsList:
            document.getElementById(
                "convResultsList"
            ),

        resultSummary:
            document.getElementById(
                "convResultSummary"
            ),

        processMore:
            document.getElementById(
                "convProcessMoreBtn"
            ),

        zip:
            document.getElementById(
                "convZipBtn"
            )
    };


    let convFiles = [];
    let processedConvFiles = [];


    function addConverterFiles(fileList) {

        const newFiles =
            validateFiles(
                fileList,
                convFiles
            );


        if (newFiles.length === 0) {

            if (convFiles.length === 0) {
                conv.input.value = "";
            }

            return;
        }


        convFiles = [
            ...convFiles,
            ...newFiles
        ];


        renderQueue(
            convFiles,
            conv.queue,
            conv.queuePanel,
            conv.queueSummary
        );


        conv.settings.hidden = false;


        conv.count.textContent =
            `${convFiles.length} file${
                convFiles.length !== 1
                    ? "s"
                    : ""
            } ready`;


        conv.input.value = "";
    }


    conv.input.addEventListener(
        "change",
        event => {

            addConverterFiles(
                event.target.files
            );

        }
    );


    setupDropZone(
        conv.dropZone,
        addConverterFiles
    );


    conv.clearButton.addEventListener(
        "click",
        () => {

            clearConverterSelection();

        }
    );


    function clearConverterSelection() {

        revokePreviewURLs(
            convFiles
        );


        convFiles = [];


        renderQueue(
            convFiles,
            conv.queue,
            conv.queuePanel,
            conv.queueSummary
        );


        conv.settings.hidden = true;


        conv.count.textContent =
            "0 files loaded";


        conv.input.value = "";
    }


    conv.start.addEventListener(
        "click",
        async () => {

            if (convFiles.length === 0) {
                return;
            }


            revokeProcessedURLs(
                processedConvFiles
            );


            processedConvFiles = [];


            conv.resultsList.innerHTML = "";


            conv.results.hidden = false;
            conv.zip.hidden = true;


            conv.start.disabled = true;
            conv.start.textContent =
                "Converting...";


            const targetFormat =
                conv.format.value;


            let successCount = 0;


            for (
                let index = 0;
                index < convFiles.length;
                index++
            ) {

                const item =
                    convFiles[index];

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
                            ${escapeHTML(
                                file.name
                            )}
                        </h4>

                        <span>
                            Converting ${
                                index + 1
                            } / ${
                                convFiles.length
                            }...
                        </span>

                    </div>

                `;


                conv.resultsList.appendChild(row);


                try {

                    const result =
                        await convertImage(
                            file,
                            targetFormat
                        );


                    const url =
                        URL.createObjectURL(
                            result.blob
                        );


                    processedConvFiles.push({
                        name: result.name,
                        blob: result.blob,
                        url: url
                    });


                    successCount++;


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
                                Output:
                                <strong>
                                    ${formatBytes(
                                        result.blob.size
                                    )}
                                </strong>
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
                                Failed conversion
                            </span>

                        </div>

                    `;
                }

            }


            conv.start.disabled = false;
            conv.start.textContent =
                "Convert Images";


            conv.resultSummary.textContent =
                `${successCount} of ${
                    convFiles.length
                } image${
                    convFiles.length !== 1
                        ? "s"
                        : ""
                } converted successfully.`;


            if (
                processedConvFiles.length > 0
            ) {

                conv.zip.hidden = false;

            }


            conv.results.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }
    );


    async function convertImage(
        file,
        targetFormat
    ) {

        const bitmap =
            await createImageBitmap(file);


        const canvas =
            document.createElement("canvas");


        canvas.width =
            bitmap.width;

        canvas.height =
            bitmap.height;


        const context =
            canvas.getContext(
                "2d",
                {
                    alpha:
                        targetFormat !==
                        "image/jpeg"
                }
            );


        if (
            targetFormat === "image/jpeg"
        ) {

            context.fillStyle = "#ffffff";

            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

        }


        context.drawImage(
            bitmap,
            0,
            0
        );


        const quality =
            targetFormat === "image/png"
                ? undefined
                : 0.92;


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
                                        "Conversion failed"
                                    )
                                );
                            }

                        },
                        targetFormat,
                        quality
                    );

                }
            );


        bitmap.close();


        let extension =
            targetFormat.split("/")[1];


        if (extension === "jpeg") {
            extension = "jpg";
        }


        return {
            blob,

            name:
                `${getBaseName(
                    file.name
                )}.${extension}`
        };
    }


    function resetConverter() {

        revokeProcessedURLs(
            processedConvFiles
        );

        revokePreviewURLs(
            convFiles
        );


        processedConvFiles = [];
        convFiles = [];


        conv.input.value = "";


        conv.resultsList.innerHTML = "";


        conv.results.hidden = true;
        conv.zip.hidden = true;
        conv.settings.hidden = true;


        renderQueue(
            convFiles,
            conv.queue,
            conv.queuePanel,
            conv.queueSummary
        );


        conv.count.textContent =
            "0 files loaded";


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    conv.processMore.addEventListener(
        "click",
        resetConverter
    );


    conv.zip.addEventListener(
        "click",
        async () => {

            if (
                processedConvFiles.length === 0
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
                conv.zip.textContent;


            conv.zip.disabled = true;
            conv.zip.textContent =
                "Creating ZIP...";


            try {

                const zip =
                    new JSZip();


                processedConvFiles.forEach(
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
                    "AuraStudio_Converted_Images.zip"
                );


            } catch (error) {

                console.error(error);

                showError(
                    "Could not create ZIP archive."
                );

            } finally {

                conv.zip.disabled = false;
                conv.zip.textContent =
                    originalText;

            }

        }
    );


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