// =====================================================
// SPA VIEW + BROWSER HISTORY SYSTEM
// =====================================================

const VIEW_NAMES = [
    'dashboard',
    'compressor',
    'converter'
];


let currentView = 'dashboard';


function getViewElement(viewName) {

    const viewMap = {
        dashboard: 'dashboardView',
        compressor: 'compressorView',
        converter: 'converteView'
    };

    return document.getElementById(
        viewMap[viewName]
    );
}


function renderView(viewName) {

    if (!VIEW_NAMES.includes(viewName)) {
        viewName = 'dashboard';
    }

    document
        .querySelectorAll('.view')
        .forEach(view => {

            view.classList.remove('active');
        });


    const targetView =
        getViewElement(viewName);


    if (targetView) {

        targetView.classList.add('active');
    }


    currentView = viewName;


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}


function switchView(viewName) {

    if (!VIEW_NAMES.includes(viewName)) {
        return;
    }


    if (currentView === viewName) {
        return;
    }


    if (viewName === 'compressor') {
        resetCompressor();
    }


    if (viewName === 'converter') {
        resetConverter();
    }


    window.history.pushState(
        {
            auraView: viewName
        },
        '',
        window.location.href
    );


    renderView(viewName);
}


function goBackToDashboard() {

    if (currentView === 'dashboard') {
        return;
    }


    window.history.back();
}


window.addEventListener(
    'popstate',
    event => {

        const viewName =
            event.state &&
            event.state.auraView
                ? event.state.auraView
                : 'dashboard';


        if (viewName === 'dashboard') {

            resetCompressor();
            resetConverter();
        }


        renderView(viewName);
    }
);


window.addEventListener(
    'DOMContentLoaded',
    () => {

        window.history.replaceState(
            {
                auraView: 'dashboard'
            },
            '',
            window.location.href
        );


        renderView('dashboard');
    }
);


// =====================================================
// COMMON UTILITIES
// =====================================================

function formatBytes(bytes) {

    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 Bytes';
    }

    const units = [
        'Bytes',
        'KB',
        'MB',
        'GB'
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


function sanitizeFileName(name) {

    return String(name)
        .replace(
            /[<>:"/\\|?*\u0000-\u001F]/g,
            '_'
        )
        .trim();
}


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
                        'Image could not be loaded'
                    )
                );


            image.src = url;
        }
    );
}


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
                                'Could not create image'
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
// COMPRESSOR
// =====================================================

const compFileInput =
    document.getElementById('compFileInput');

const compDropZone =
    document.getElementById('compDropZone');

const compSettingsPanel =
    document.getElementById('compSettingsPanel');

const compQualitySlider =
    document.getElementById('compQualitySlider');

const compQualityVal =
    document.getElementById('compQualityVal');

const compFileCount =
    document.getElementById('compFileCount');

const compStartBtn =
    document.getElementById('compStartBtn');

const compResultsPanel =
    document.getElementById('compResultsPanel');

const compResultsList =
    document.getElementById('compResultsList');

const compZipBtn =
    document.getElementById('compZipBtn');

const compStatus =
    document.getElementById('compStatus');

const compProgressWrap =
    document.getElementById('compProgressWrap');

const compProgressText =
    document.getElementById('compProgressText');

const compProgressBar =
    document.getElementById('compProgressBar');

const compResetBtn =
    document.getElementById('compResetBtn');


const MAX_COMP_FILES = 100;

const MAX_FILE_SIZE =
    100 * 1024 * 1024;

const MAX_TOTAL_SIZE =
    500 * 1024 * 1024;

const MAX_PIXELS =
    60_000_000;


const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];


let compFiles = [];

let processedCompFiles = [];

let isCompressing = false;


// Quality

compQualitySlider.addEventListener(
    'input',
    event => {

        compQualityVal.textContent =
            `${event.target.value}%`;
    }
);


// File input

compFileInput.addEventListener(
    'change',
    event => {

        handleCompSelection(
            event.target.files
        );
    }
);


// Drag and drop

[
    'dragenter',
    'dragover'
].forEach(eventName => {

    compDropZone.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            if (!isCompressing) {

                compDropZone.classList.add(
                    'drag-active'
                );
            }
        }
    );
});


[
    'dragleave',
    'drop'
].forEach(eventName => {

    compDropZone.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            compDropZone.classList.remove(
                'drag-active'
            );
        }
    );
});


compDropZone.addEventListener(
    'drop',
    event => {

        if (isCompressing) {
            return;
        }


        handleCompSelection(
            event.dataTransfer.files
        );
    }
);


// Selection

function handleCompSelection(files) {

    if (isCompressing) {
        return;
    }


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
            'Please select JPG, PNG or WebP images.'
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
            `"${oversizedFile.name}" exceeds 100 MB.`
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
            'Total batch size cannot exceed 500 MB.'
        );

        return;
    }


    compFiles = imageFiles;


    compFileCount.textContent =
        `${compFiles.length} file` +
        `${
            compFiles.length === 1
                ? ''
                : 's'
        } loaded • ${formatBytes(totalSize)}`;


    compDropZone.style.display =
        'none';


    compSettingsPanel.style.display =
        'block';


    compResultsPanel.style.display =
        'none';


    compResultsList.innerHTML =
        '';


    compZipBtn.style.display =
        'none';


    compFileInput.value =
        '';
}


// Compression start

compStartBtn.addEventListener(
    'click',
    async () => {

        if (
            compFiles.length === 0 ||
            isCompressing
        ) {
            return;
        }


        isCompressing = true;


        processedCompFiles.forEach(
            item => {

                URL.revokeObjectURL(
                    item.url
                );
            }
        );


        processedCompFiles = [];


        compSettingsPanel.style.display =
            'none';


        compResultsPanel.style.display =
            'block';


        compResultsList.innerHTML =
            '';


        compZipBtn.style.display =
            'none';


        compProgressWrap.style.display =
            'block';


        compProgressBar.style.width =
            '0%';


        compStartBtn.disabled =
            true;


        compResetBtn.disabled =
            true;


        const quality =
            Number(
                compQualitySlider.value
            ) / 100;


        for (
            let index = 0;
            index < compFiles.length;
            index++
        ) {

            const file =
                compFiles[index];


            compProgressText.textContent =
                `Processing ${index + 1} of ` +
                `${compFiles.length}`;


            compStatus.textContent =
                `Compressing ${file.name}`;


            const row =
                document.createElement('div');


            row.className =
                'result-row';


            row.innerHTML =
                `<div class="file-meta">
                    <h4></h4>
                    <span>Processing...</span>
                </div>`;


            row.querySelector('h4').textContent =
                file.name;


            compResultsList.appendChild(row);


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


                const originalSize =
                    formatBytes(file.size);


                const compressedSize =
                    formatBytes(
                        result.blob.size
                    );


                row.innerHTML =
                    '';


                const meta =
                    document.createElement('div');


                meta.className =
                    'file-meta';


                const title =
                    document.createElement('h4');


                title.textContent =
                    result.name;


                const details =
                    document.createElement('span');


                details.innerHTML =
                    `${originalSize} → ` +
                    `<strong>${compressedSize}</strong>`;


                meta.appendChild(title);
                meta.appendChild(details);


                const download =
                    document.createElement('a');


                download.href = url;

                download.download =
                    `Compressed_${sanitizeFileName(
                        result.name
                    )}`;

                download.className =
                    'download-link';

                download.textContent =
                    'Download';


                row.appendChild(meta);
                row.appendChild(download);

            } catch (error) {

                row.innerHTML =
                    '';


                const meta =
                    document.createElement('div');


                meta.className =
                    'file-meta';


                const title =
                    document.createElement('h4');


                title.textContent =
                    file.name;


                const details =
                    document.createElement('span');


                details.textContent =
                    'Failed to process';


                details.style.color =
                    '#EF4444';


                meta.appendChild(title);
                meta.appendChild(details);

                row.appendChild(meta);
            }


            const progress =
                Math.round(
                    (
                        (index + 1) /
                        compFiles.length
                    ) * 100
                );


            compProgressBar.style.width =
                `${progress}%`;


            await new Promise(
                resolve =>
                    setTimeout(resolve, 0)
            );
        }


        isCompressing = false;


        compStartBtn.disabled =
            false;


        compResetBtn.disabled =
            false;


        compProgressText.textContent =
            `Completed ${processedCompFiles.length} of ` +
            `${compFiles.length}`;


        compStatus.textContent =
            'Compression complete.';


        if (
            processedCompFiles.length > 0
        ) {

            compZipBtn.style.display =
                'block';
        }
    }
);


// Compression engine

async function runCompression(
    file,
    quality
) {

    const objectUrl =
        URL.createObjectURL(file);


    try {

        const image =
            await loadImage(objectUrl);


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
            document.createElement('canvas');


        canvas.width =
            targetWidth;

        canvas.height =
            targetHeight;


        const context =
            canvas.getContext('2d');


        if (!context) {
            throw new Error(
                'Canvas unavailable'
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


// FULL COMPRESSOR RESET

function resetCompressor() {

    if (isCompressing) {
        return;
    }


    processedCompFiles.forEach(
        item => {

            URL.revokeObjectURL(
                item.url
            );
        }
    );


    processedCompFiles = [];
    compFiles = [];


    compFileInput.value =
        '';


    compResultsList.innerHTML =
        '';


    compFileCount.textContent =
        '0 files loaded';


    compSettingsPanel.style.display =
        'none';


    compResultsPanel.style.display =
        'none';


    compDropZone.style.display =
        'block';


    compZipBtn.style.display =
        'none';


    compProgressWrap.style.display =
        'none';


    compProgressBar.style.width =
        '0%';


    compProgressText.textContent =
        'Preparing...';


    compStatus.textContent =
        'Keep this tab open while your images are being processed.';


    compQualitySlider.value =
        80;


    compQualityVal.textContent =
        '80%';
}


// Compressor ZIP

compZipBtn.addEventListener(
    'click',
    async () => {

        if (
            processedCompFiles.length === 0 ||
            typeof JSZip === 'undefined'
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
            'Creating ZIP...';


        try {

            const content =
                await zip.generateAsync({
                    type: 'blob'
                });


            const url =
                URL.createObjectURL(content);


            const link =
                document.createElement('a');


            link.href = url;

            link.download =
                'Compressed_Batch.zip';


            document.body.appendChild(link);

            link.click();

            link.remove();


            setTimeout(
                () => URL.revokeObjectURL(url),
                2000
            );

        } finally {

            compZipBtn.disabled =
                false;

            compZipBtn.textContent =
                'Download Archive (ZIP)';
        }
    }
);


// =====================================================
// CONVERTER
// =====================================================

const convFileInput =
    document.getElementById('convFileInput');

const convSettingsPanel =
    document.getElementById('convSettingsPanel');

const convResultsPanel =
    document.getElementById('convResultsPanel');

const convResultsList =
    document.getElementById('convResultsList');

const convDropZone =
    document.getElementById('convDropZone');

const convFileCount =
    document.getElementById('convFileCount');

const convZipBtn =
    document.getElementById('convZipBtn');

const convStartBtn =
    document.getElementById('convStartBtn');

const targetFormat =
    document.getElementById('targetFormat');


let convFiles = [];

let processedConvFiles = [];


convFileInput.addEventListener(
    'change',
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
            `${convFiles.length} files loaded`;


        convDropZone.style.display =
            'none';


        convSettingsPanel.style.display =
            'block';


        convFileInput.value =
            '';
    }
);


convStartBtn.addEventListener(
    'click',
    async () => {

        if (convFiles.length === 0) {
            return;
        }


        convResultsList.innerHTML =
            '';


        convSettingsPanel.style.display =
            'none';


        convResultsPanel.style.display =
            'block';


        processedConvFiles.forEach(
            item =>
                URL.revokeObjectURL(
                    item.url
                )
        );


        processedConvFiles = [];


        const format =
            targetFormat.value;


        const extension =
            format === 'image/jpeg'
                ? 'jpg'
                : format.split('/')[1];


        for (const file of convFiles) {

            try {

                const blob =
                    await runConversion(
                        file,
                        format
                    );


                const dot =
                    file.name.lastIndexOf('.');


                const baseName =
                    dot > 0
                        ? file.name.slice(0, dot)
                        : file.name;


                const newName =
                    `${baseName}.${extension}`;


                const url =
                    URL.createObjectURL(blob);


                processedConvFiles.push({
                    name: newName,
                    blob,
                    url
                });


                const row =
                    document.createElement('div');


                row.className =
                    'result-row';


                row.innerHTML =
                    `<div class="file-meta">
                        <h4></h4>
                        <span>${formatBytes(blob.size)}</span>
                    </div>`;


                row.querySelector('h4').textContent =
                    newName;


                const download =
                    document.createElement('a');


                download.href = url;

                download.download = newName;

                download.className =
                    'download-link';

                download.textContent =
                    'Download';


                row.appendChild(download);


                convResultsList.appendChild(row);

            } catch (error) {

                console.error(error);
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
                'block';
        }
    }
);


async function runConversion(
    file,
    format
) {

    const objectUrl =
        URL.createObjectURL(file);


    try {

        const image =
            await loadImage(objectUrl);


        const canvas =
            document.createElement('canvas');


        canvas.width =
            image.naturalWidth ||
            image.width;


        canvas.height =
            image.naturalHeight ||
            image.height;


        const context =
            canvas.getContext('2d');


        if (
            format === 'image/jpeg'
        ) {

            context.fillStyle =
                '#FFFFFF';


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


        return await canvasToBlob(
            canvas,
            format,
            0.92
        );

    } finally {

        URL.revokeObjectURL(
            objectUrl
        );
    }
}


function resetConverter() {

    processedConvFiles.forEach(
        item =>
            URL.revokeObjectURL(
                item.url
            )
    );


    processedConvFiles = [];
    convFiles = [];


    convFileInput.value =
        '';


    convResultsList.innerHTML =
        '';


    convFileCount.textContent =
        '0 files loaded';


    convSettingsPanel.style.display =
        'none';


    convResultsPanel.style.display =
        'none';


    convDropZone.style.display =
        'block';


    convZipBtn.style.display =
        'none';
}


// =====================================================
// FAQ
// =====================================================

document
    .querySelectorAll('.faq-question')
    .forEach(button => {

        button.addEventListener(
            'click',
            () => {

                const answer =
                    button.nextElementSibling;


                const isOpen =
                    Boolean(
                        answer.style.maxHeight
                    );


                answer.style.maxHeight =
                    isOpen
                        ? ''
                        : `${answer.scrollHeight}px`;
            }
        );
    });