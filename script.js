// =====================================================
// AURASTUDIO
// SPA VIEW + HISTORY SYSTEM
// =====================================================


const VIEW_NAMES = [
    "dashboard",
    "compressor",
    "converter"
];


let currentView = "dashboard";


// -----------------------------------------------------
// VIEW ELEMENT
// -----------------------------------------------------

function getViewElement(viewName) {

    const viewMap = {
        dashboard: "dashboardView",
        compressor: "compressorView",
        converter: "converteView"
    };


    return document.getElementById(
        viewMap[viewName]
    );
}


// -----------------------------------------------------
// RENDER VIEW
// -----------------------------------------------------

function renderView(viewName) {

    if (!VIEW_NAMES.includes(viewName)) {
        viewName = "dashboard";
    }


    document
        .querySelectorAll(".view")
        .forEach(view => {

            view.classList.remove("active");

        });


    const targetView =
        getViewElement(viewName);


    if (targetView) {

        targetView.classList.add("active");

    }


    currentView = viewName;


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// -----------------------------------------------------
// CHANGE VIEW
// -----------------------------------------------------

function switchView(viewName) {

    if (!VIEW_NAMES.includes(viewName)) {
        return;
    }


    if (currentView === viewName) {
        return;
    }


    // Har baar compressor fresh open hoga
    if (viewName === "compressor") {

        resetCompressor();

    }


    // Converter bhi fresh
    if (viewName === "converter") {

        resetConverter();

    }


    window.history.pushState(
        {
            auraView: viewName
        },
        "",
        window.location.href
    );


    renderView(viewName);

}


// -----------------------------------------------------
// INTERNAL BACK BUTTON
// -----------------------------------------------------

function goBackToDashboard() {

    if (currentView === "dashboard") {
        return;
    }


    window.history.back();

}


// -----------------------------------------------------
// PHONE / BROWSER BACK
// -----------------------------------------------------

window.addEventListener(
    "popstate",
    event => {

        const viewName =
            event.state &&
            event.state.auraView
                ? event.state.auraView
                : "dashboard";


        if (viewName === "dashboard") {

            resetCompressor();
            resetConverter();

        }


        renderView(viewName);

    }
);


// -----------------------------------------------------
// INITIAL STATE
// -----------------------------------------------------

window.addEventListener(
    "DOMContentLoaded",
    () => {

        window.history.replaceState(
            {
                auraView: "dashboard"
            },
            "",
            window.location.href
        );


        renderView("dashboard");

    }
);



// =====================================================
// COMMON UTILITIES
// =====================================================


// -----------------------------------------------------
// FORMAT BYTES
// -----------------------------------------------------

function formatBytes(bytes) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {
        return "0 Bytes";
    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index = Math.min(
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        ),
        units.length - 1
    );


    const value =
        bytes /
        Math.pow(1024, index);


    return `${parseFloat(
        value.toFixed(2)
    )} ${units[index]}`;

}


// -----------------------------------------------------
// SANITIZE FILE NAME
// -----------------------------------------------------

function sanitizeFileName(name) {

    return String(name)
        .replace(
            /[<>:"/\\|?*\u0000-\u001F]/g,
            "_"
        )
        .trim();

}


// -----------------------------------------------------
// LOAD IMAGE
// -----------------------------------------------------

function loadImage(url) {

    return new Promise(
        (resolve, reject) => {

            const image =
                new Image();


            image.onload =
                () => resolve(image);


            image.onerror =
                () => reject(
                    new Error(
                        "Image could not be loaded"
                    )
                );


            image.src = url;

        }
    );

}


// -----------------------------------------------------
// CANVAS TO BLOB
// -----------------------------------------------------

function canvasToBlob(
    canvas,
    type,
    quality
) {

    return new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                blob => {

                    if (blob) {

                        resolve(blob);

                    } else {

                        reject(
                            new Error(
                                "Could not create image"
                            )
                        );

                    }

                },
                type,
                quality
            );

        }
    );

}



// =====================================================
// IMAGE COMPRESSOR
// =====================================================


const compFileInput =
    document.getElementById(
        "compFileInput"
    );


const compDropZone =
    document.getElementById(
        "compDropZone"
    );


const compSettingsPanel =
    document.getElementById(
        "compSettingsPanel"
    );


const compPreviewList =
    document.getElementById(
        "compPreviewList"
    );


const compQueueBadge =
    document.getElementById(
        "compQueueBadge"
    );


const compUploadSummary =
    document.getElementById(
        "compUploadSummary"
    );


const compSummaryText =
    document.getElementById(
        "compSummaryText"
    );


const compQualitySlider =
    document.getElementById(
        "compQualitySlider"
    );


const compQualityVal =
    document.getElementById(
        "compQualityVal"
    );


const compFileCount =
    document.getElementById(
        "compFileCount"
    );


const compStartBtn =
    document.getElementById(
        "compStartBtn"
    );


const compResultsPanel =
    document.getElementById(
        "compResultsPanel"
    );


const compResultsList =
    document.getElementById(
        "compResultsList"
    );


const compZipBtn =
    document.getElementById(
        "compZipBtn"
    );


const compStatus =
    document.getElementById(
        "compStatus"
    );


const compProgressWrap =
    document.getElementById(
        "compProgressWrap"
    );


const compProgressText =
    document.getElementById(
        "compProgressText"
    );


const compProgressPercent =
    document.getElementById(
        "compProgressPercent"
    );


const compProgressBar =
    document.getElementById(
        "compProgressBar"
    );


const compResetBtn =
    document.getElementById(
        "compResetBtn"
    );



// -----------------------------------------------------
// LIMITS
// -----------------------------------------------------

const MAX_COMP_FILES = 100;


const MAX_FILE_SIZE =
    100 * 1024 * 1024;


const MAX_TOTAL_SIZE =
    500 * 1024 * 1024;


const MAX_PIXELS =
    60_000_000;


const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];



// -----------------------------------------------------
// STATE
// -----------------------------------------------------

let compFiles = [];


let processedCompFiles = [];


let compPreviewUrls = [];


let isCompressing = false;



// -----------------------------------------------------
// QUALITY SLIDER
// -----------------------------------------------------

compQualitySlider.addEventListener(
    "input",
    event => {

        compQualityVal.textContent =
            `${event.target.value}%`;

    }
);



// -----------------------------------------------------
// FILE INPUT
// -----------------------------------------------------

compFileInput.addEventListener(
    "change",
    event => {

        handleCompSelection(
            event.target.files
        );

    }
);



// -----------------------------------------------------
// DRAG EVENTS
// -----------------------------------------------------

[
    "dragenter",
    "dragover"
].forEach(eventName => {

    compDropZone.addEventListener(
        eventName,
        event => {

            event.preventDefault();


            if (!isCompressing) {

                compDropZone.classList.add(
                    "drag-active"
                );

            }

        }
    );

});


[
    "dragleave",
    "drop"
].forEach(eventName => {

    compDropZone.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            compDropZone.classList.remove(
                "drag-active"
            );

        }
    );

});



// -----------------------------------------------------
// DROP FILES
// -----------------------------------------------------

compDropZone.addEventListener(
    "drop",
    event => {

        if (isCompressing) {
            return;
        }


        handleCompSelection(
            event.dataTransfer.files
        );

    }
);



// -----------------------------------------------------
// HANDLE COMPRESSOR SELECTION
// -----------------------------------------------------

function handleCompSelection(files) {

    if (isCompressing) {
        return;
    }


    // Purani previews cleanup
    clearCompPreviewUrls();


    const selectedFiles =
        Array.from(files || []);


    const imageFiles =
        selectedFiles.filter(
            file =>
                ALLOWED_IMAGE_TYPES.includes(
                    file.type
                )
        );


    if (imageFiles.length === 0) {

        alert(
            "Please select JPG, PNG or WebP images."
        );

        return;
    }


    if (
        imageFiles.length >
        MAX_COMP_FILES
    ) {

        alert(
            `Maximum ${MAX_COMP_FILES} images allowed.`
        );

        return;
    }


    const oversizedFile =
        imageFiles.find(
            file =>
                file.size >
                MAX_FILE_SIZE
        );


    if (oversizedFile) {

        alert(
            `"${oversizedFile.name}" exceeds the 100 MB limit.`
        );

        return;
    }


    const totalSize =
        imageFiles.reduce(
            (total, file) =>
                total + file.size,
            0
        );


    if (
        totalSize >
        MAX_TOTAL_SIZE
    ) {

        alert(
            "Total batch size cannot exceed 500 MB."
        );

        return;
    }


    // Fresh selection
    compFiles = imageFiles;


    // UI update
    compQueueBadge.textContent =
        `${compFiles.length} ${
            compFiles.length === 1
                ? "file"
                : "files"
        }`;


    compSummaryText.textContent =
        `${compFiles.length} ${
            compFiles.length === 1
                ? "image is"
                : "images are"
        } uploaded and ready for compression.`;


    compFileCount.textContent =
        `${compFiles.length} ${
            compFiles.length === 1
                ? "file"
                : "files"
        } • ${formatBytes(totalSize)} total`;


    // Preview queue
    renderCompPreviewQueue();


    // Show workspace
    compDropZone.style.display =
        "none";


    compSettingsPanel.style.display =
        "block";


    compResultsPanel.style.display =
        "none";


    compResultsList.innerHTML =
        "";


    compZipBtn.style.display =
        "none";


    // Input reset
    // Same file dubara select karne par bhi change event chale
    compFileInput.value = "";

}



// -----------------------------------------------------
// RENDER IMAGE PREVIEWS
// -----------------------------------------------------

function renderCompPreviewQueue() {

    compPreviewList.innerHTML = "";


    compFiles.forEach(
        (file, index) => {

            const previewUrl =
                URL.createObjectURL(file);


            compPreviewUrls.push(
                previewUrl
            );


            const row =
                document.createElement("div");


            row.className =
                "preview-file-row";


            // THUMBNAIL
            const thumb =
                document.createElement("div");


            thumb.className =
                "preview-thumb";


            const image =
                document.createElement("img");


            image.src =
                previewUrl;


            image.alt =
                `Preview ${index + 1}`;


            thumb.appendChild(image);



            // FILE DETAILS
            const details =
                document.createElement("div");


            details.className =
                "preview-file-details";


            const name =
                document.createElement("span");


            name.className =
                "preview-file-name";


            name.textContent =
                file.name;


            name.title =
                file.name;


            const size =
                document.createElement("span");


            size.className =
                "preview-file-size";


            size.textContent =
                formatBytes(file.size);


            details.appendChild(name);
            details.appendChild(size);



            // RIGHT SIDE STATUS
            const status =
                document.createElement("div");


            status.className =
                "preview-status";


            const uploadedText =
                document.createElement("span");


            uploadedText.className =
                "uploaded-text";


            uploadedText.textContent =
                "Uploaded";


            const tick =
                document.createElement("div");


            tick.className =
                "green-status-tick";


            tick.textContent =
                "✓";


            status.appendChild(
                uploadedText
            );

            status.appendChild(
                tick
            );



            // FINAL ROW
            row.appendChild(thumb);

            row.appendChild(details);

            row.appendChild(status);


            compPreviewList.appendChild(
                row
            );

        }
    );

}



// -----------------------------------------------------
// CLEAR PREVIEW OBJECT URLS
// -----------------------------------------------------

function clearCompPreviewUrls() {

    compPreviewUrls.forEach(
        url => {

            URL.revokeObjectURL(url);

        }
    );


    compPreviewUrls = [];

}



// -----------------------------------------------------
// START COMPRESSION
// -----------------------------------------------------

compStartBtn.addEventListener(
    "click",
    async () => {

        if (
            compFiles.length === 0 ||
            isCompressing
        ) {
            return;
        }


        isCompressing = true;


        // Purane compressed result URLs cleanup
        processedCompFiles.forEach(
            item => {

                URL.revokeObjectURL(
                    item.url
                );

            }
        );


        processedCompFiles = [];


        // Queue workspace hide
        compSettingsPanel.style.display =
            "none";


        // Results show
        compResultsPanel.style.display =
            "block";


        compResultsList.innerHTML =
            "";


        compZipBtn.style.display =
            "none";


        compProgressWrap.style.display =
            "block";


        compProgressBar.style.width =
            "0%";


        compProgressPercent.textContent =
            "0%";


        compStartBtn.disabled =
            true;


        compResetBtn.disabled =
            true;


        const quality =
            Number(
                compQualitySlider.value
            ) / 100;



        // Sequential processing
        for (
            let index = 0;
            index < compFiles.length;
            index++
        ) {

            const file =
                compFiles[index];


            compProgressText.textContent =
                `Processing ${index + 1} of ${compFiles.length}`;


            compStatus.textContent =
                `Compressing ${file.name}`;



            // Temporary result row
            const row =
                document.createElement("div");


            row.className =
                "result-row";


            const processingMeta =
                document.createElement("div");


            processingMeta.className =
                "file-meta";


            const processingTitle =
                document.createElement("h4");


            processingTitle.textContent =
                file.name;


            const processingText =
                document.createElement("span");


            processingText.textContent =
                "Processing...";


            processingMeta.appendChild(
                processingTitle
            );

            processingMeta.appendChild(
                processingText
            );


            row.appendChild(
                processingMeta
            );


            compResultsList.appendChild(
                row
            );



            try {

                const result =
                    await runCompression(
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
                    url
                });


                // Clear temporary row
                row.innerHTML = "";


                const meta =
                    document.createElement("div");


                meta.className =
                    "file-meta";


                const title =
                    document.createElement("h4");


                title.textContent =
                    result.name;


                const details =
                    document.createElement("span");


                details.innerHTML =
                    `${formatBytes(file.size)} → ` +
                    `<strong>${formatBytes(
                        result.blob.size
                    )}</strong>`;


                meta.appendChild(title);
                meta.appendChild(details);


                const download =
                    document.createElement("a");


                download.href =
                    url;


                download.download =
                    `Compressed_${sanitizeFileName(
                        result.name
                    )}`;


                download.className =
                    "download-link";


                download.textContent =
                    "Download";


                row.appendChild(meta);
                row.appendChild(download);


            } catch (error) {

                row.innerHTML = "";


                const meta =
                    document.createElement("div");


                meta.className =
                    "file-meta";


                const title =
                    document.createElement("h4");


                title.textContent =
                    file.name;


                const details =
                    document.createElement("span");


                details.textContent =
                    "Failed to process";


                details.style.color =
                    "#EF4444";


                meta.appendChild(title);
                meta.appendChild(details);


                row.appendChild(meta);

            }



            // Progress
            const progress =
                Math.round(
                    (
                        (index + 1) /
                        compFiles.length
                    ) * 100
                );


            compProgressBar.style.width =
                `${progress}%`;


            compProgressPercent.textContent =
                `${progress}%`;


            // Browser UI ko responsive rakhne ke liye
            await new Promise(
                resolve =>
                    setTimeout(resolve, 0)
            );

        }



        // Finished
        isCompressing = false;


        compStartBtn.disabled =
            false;


        compResetBtn.disabled =
            false;


        compProgressText.textContent =
            `Completed ${processedCompFiles.length} of ${compFiles.length}`;


        compProgressPercent.textContent =
            "100%";


        compStatus.textContent =
            "Compression complete.";


        if (
            processedCompFiles.length > 0
        ) {

            compZipBtn.style.display =
                "block";

        }

    }
);



// -----------------------------------------------------
// COMPRESSION ENGINE
// -----------------------------------------------------

async function runCompression(
    file,
    quality
) {

    const objectUrl =
        URL.createObjectURL(file);


    try {

        const image =
            await loadImage(
                objectUrl
            );


        const sourceWidth =
            image.naturalWidth ||
            image.width;


        const sourceHeight =
            image.naturalHeight ||
            image.height;


        let targetWidth =
            sourceWidth;


        let targetHeight =
            sourceHeight;


        const totalPixels =
            sourceWidth *
            sourceHeight;



        // Large image safeguard
        if (
            totalPixels >
            MAX_PIXELS
        ) {

            const scale =
                Math.sqrt(
                    MAX_PIXELS /
                    totalPixels
                );


            targetWidth =
                Math.max(
                    1,
                    Math.round(
                        sourceWidth * scale
                    )
                );


            targetHeight =
                Math.max(
                    1,
                    Math.round(
                        sourceHeight * scale
                    )
                );

        }



        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            targetWidth;


        canvas.height =
            targetHeight;


        const context =
            canvas.getContext("2d");


        if (!context) {

            throw new Error(
                "Canvas unavailable"
            );

        }


        context.drawImage(
            image,
            0,
            0,
            targetWidth,
            targetHeight
        );


        const blob =
            await canvasToBlob(
                canvas,
                file.type,
                quality
            );


        // Canvas cleanup
        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        canvas.width = 1;
        canvas.height = 1;


        return {
            blob,
            name: file.name
        };


    } finally {

        URL.revokeObjectURL(
            objectUrl
        );

    }

}



// -----------------------------------------------------
// FULL COMPRESSOR RESET
// -----------------------------------------------------

function resetCompressor() {

    // Processing ke beech reset allow nahi
    if (isCompressing) {
        return;
    }


    // Preview URLs cleanup
    clearCompPreviewUrls();


    // Result URLs cleanup
    processedCompFiles.forEach(
        item => {

            URL.revokeObjectURL(
                item.url
            );

        }
    );


    // Clear state
    processedCompFiles = [];


    compFiles = [];


    // Clear input
    compFileInput.value = "";


    // Clear queue
    compPreviewList.innerHTML = "";


    // Clear results
    compResultsList.innerHTML = "";


    // Reset queue text
    compQueueBadge.textContent =
        "0 files";


    compSummaryText.textContent =
        "Your files are ready for compression.";


    compFileCount.textContent =
        "0 files loaded";


    // Hide panels
    compSettingsPanel.style.display =
        "none";


    compResultsPanel.style.display =
        "none";


    // Show upload
    compDropZone.style.display =
        "block";


    // Hide ZIP
    compZipBtn.style.display =
        "none";


    // Reset progress
    compProgressBar.style.width =
        "0%";


    compProgressPercent.textContent =
        "0%";


    compProgressText.textContent =
        "Preparing...";


    compStatus.textContent =
        "Keep this tab open while your images are being processed.";


    // Reset quality
    compQualitySlider.value =
        80;


    compQualityVal.textContent =
        "80%";


    compStartBtn.disabled =
        false;


    compResetBtn.disabled =
        false;

}



// -----------------------------------------------------
// COMPRESSOR ZIP
// -----------------------------------------------------

compZipBtn.addEventListener(
    "click",
    async () => {

        if (
            processedCompFiles.length === 0 ||
            typeof JSZip === "undefined"
        ) {
            return;
        }


        const zip =
            new JSZip();


        processedCompFiles.forEach(
            item => {

                zip.file(
                    `Compressed_${item.name}`,
                    item.blob
                );

            }
        );


        compZipBtn.disabled =
            true;


        compZipBtn.textContent =
            "Creating ZIP...";


        try {

            const content =
                await zip.generateAsync({
                    type: "blob"
                });


            const url =
                URL.createObjectURL(
                    content
                );


            const link =
                document.createElement("a");


            link.href =
                url;


            link.download =
                "Compressed_Batch.zip";


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            setTimeout(
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                },
                2000
            );


        } finally {

            compZipBtn.disabled =
                false;


            compZipBtn.textContent =
                "Download Archive (ZIP)";

        }

    }
);



// =====================================================
// CONVERTER
// =====================================================


const convFileInput =
    document.getElementById(
        "convFileInput"
    );


const convSettingsPanel =
    document.getElementById(
        "convSettingsPanel"
    );


const convResultsPanel =
    document.getElementById(
        "convResultsPanel"
    );


const convResultsList =
    document.getElementById(
        "convResultsList"
    );


const convDropZone =
    document.getElementById(
        "convDropZone"
    );


const convFileCount =
    document.getElementById(
        "convFileCount"
    );


const convZipBtn =
    document.getElementById(
        "convZipBtn"
    );


const convStartBtn =
    document.getElementById(
        "convStartBtn"
    );


const targetFormat =
    document.getElementById(
        "targetFormat"
    );


let convFiles = [];


let processedConvFiles = [];



// -----------------------------------------------------
// CONVERTER INPUT
// -----------------------------------------------------

convFileInput.addEventListener(
    "change",
    event => {

        convFiles =
            Array.from(
                event.target.files || []
            ).filter(
                file =>
                    ALLOWED_IMAGE_TYPES.includes(
                        file.type
                    )
            );


        if (convFiles.length === 0) {
            return;
        }


        convFileCount.textContent =
            `${convFiles.length} ${
                convFiles.length === 1
                    ? "file"
                    : "files"
            } loaded`;


        convDropZone.style.display =
            "none";


        convSettingsPanel.style.display =
            "block";


        convFileInput.value = "";

    }
);



// -----------------------------------------------------
// START CONVERSION
// -----------------------------------------------------

convStartBtn.addEventListener(
    "click",
    async () => {

        if (
            convFiles.length === 0
        ) {
            return;
        }


        convResultsList.innerHTML =
            "";


        convSettingsPanel.style.display =
            "none";


        convResultsPanel.style.display =
            "block";


        processedConvFiles.forEach(
            item => {

                URL.revokeObjectURL(
                    item.url
                );

            }
        );


        processedConvFiles = [];


        const format =
            targetFormat.value;


        const extension =
            format === "image/jpeg"
                ? "jpg"
                : format.split("/")[1];



        for (
            const file of convFiles
        ) {

            try {

                const blob =
                    await runConversion(
                        file,
                        format
                    );


                const dot =
                    file.name.lastIndexOf(".");


                const baseName =
                    dot > 0
                        ? file.name.slice(0, dot)
                        : file.name;


                const newName =
                    `${baseName}.${extension}`;


                const url =
                    URL.createObjectURL(
                        blob
                    );


                processedConvFiles.push({
                    name: newName,
                    blob,
                    url
                });


                const row =
                    document.createElement(
                        "div"
                    );


                row.className =
                    "result-row";


                const meta =
                    document.createElement(
                        "div"
                    );


                meta.className =
                    "file-meta";


                const title =
                    document.createElement(
                        "h4"
                    );


                title.textContent =
                    newName;


                const size =
                    document.createElement(
                        "span"
                    );


                size.textContent =
                    formatBytes(
                        blob.size
                    );


                meta.appendChild(title);
                meta.appendChild(size);


                const download =
                    document.createElement(
                        "a"
                    );


                download.href =
                    url;


                download.download =
                    newName;


                download.className =
                    "download-link";


                download.textContent =
                    "Download";


                row.appendChild(meta);
                row.appendChild(download);


                convResultsList.appendChild(
                    row
                );


            } catch (error) {

                console.error(
                    error
                );

            }


            await new Promise(
                resolve =>
                    setTimeout(resolve, 0)
            );

        }



        if (
            processedConvFiles.length > 0
        ) {

            convZipBtn.style.display =
                "block";

        }

    }
);



// -----------------------------------------------------
// CONVERSION ENGINE
// -----------------------------------------------------

async function runConversion(
    file,
    format
) {

    const objectUrl =
        URL.createObjectURL(file);


    try {

        const image =
            await loadImage(
                objectUrl
            );


        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            image.naturalWidth ||
            image.width;


        canvas.height =
            image.naturalHeight ||
            image.height;


        const context =
            canvas.getContext(
                "2d"
            );


        if (!context) {

            throw new Error(
                "Canvas unavailable"
            );

        }


        // PNG transparency JPEG mein white background banega
        if (
            format === "image/jpeg"
        ) {

            context.fillStyle =
                "#FFFFFF";


            context.fillRect(
                0,
                0,
                canvas.width,
                canvas.height
            );

        }


        context.drawImage(
            image,
            0,
            0
        );


        const blob =
            await canvasToBlob(
                canvas,
                format,
                0.92
            );


        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        canvas.width = 1;
        canvas.height = 1;


        return blob;


    } finally {

        URL.revokeObjectURL(
            objectUrl
        );

    }

}



// -----------------------------------------------------
// RESET CONVERTER
// -----------------------------------------------------

function resetConverter() {

    processedConvFiles.forEach(
        item => {

            URL.revokeObjectURL(
                item.url
            );

        }
    );


    processedConvFiles = [];


    convFiles = [];


    convFileInput.value =
        "";


    convResultsList.innerHTML =
        "";


    convFileCount.textContent =
        "0 files loaded";


    convSettingsPanel.style.display =
        "none";


    convResultsPanel.style.display =
        "none";


    convDropZone.style.display =
        "block";


    convZipBtn.style.display =
        "none";

}



// -----------------------------------------------------
// CONVERTER ZIP
// -----------------------------------------------------

convZipBtn.addEventListener(
    "click",
    async () => {

        if (
            processedConvFiles.length === 0 ||
            typeof JSZip === "undefined"
        ) {
            return;
        }


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


        convZipBtn.disabled =
            true;


        convZipBtn.textContent =
            "Creating ZIP...";


        try {

            const content =
                await zip.generateAsync({
                    type: "blob"
                );


            const url =
                URL.createObjectURL(
                    content
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href =
                url;


            link.download =
                "Converted_Batch.zip";


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            setTimeout(
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                },
                2000
            );


        } finally {

            convZipBtn.disabled =
                false;


            convZipBtn.textContent =
                "Download Archive (ZIP)";

        }

    }
);



// =====================================================
// FAQ ACCORDION
// =====================================================

document
    .querySelectorAll(
        ".faq-question"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const answer =
                    button.nextElementSibling;


                const isOpen =
                    Boolean(
                        answer.style.maxHeight
                    );


                answer.style.maxHeight =
                    isOpen
                        ? ""
                        : `${answer.scrollHeight}px`;

            }
        );

    });