// --- TAB SWITCHER (Floating Nav Pill) ---
const tabBtns = document.querySelectorAll('.tab-btn');
const workspaces = document.querySelectorAll('.workspace');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        workspaces.forEach(w => w.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target') + 'Workspace';
        document.getElementById(targetId).classList.add('active');
    });
});

// --- MODAL POPUPS (Privacy & Terms) ---
const privacyModal = document.getElementById('privacyModal');
const termsModal = document.getElementById('termsModal');

document.getElementById('openPrivacy').addEventListener('click', (e) => { e.preventDefault(); privacyModal.classList.add('active'); });
document.getElementById('closePrivacy').addEventListener('click', () => privacyModal.classList.remove('active'));

document.getElementById('openTerms').addEventListener('click', (e) => { e.preventDefault(); termsModal.classList.add('active'); });
document.getElementById('closeTerms').addEventListener('click', () => termsModal.classList.remove('active'));

// --- UTILITY FORMATTER ---
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// --- 1. COMPRESSOR ENGINE ---
const compDropZone = document.getElementById('compDropZone');
const compFileInput = document.getElementById('compFileInput');
const compSettingsBox = document.getElementById('compSettingsBox');
const compQualitySlider = document.getElementById('compQualitySlider');
const compQualityVal = document.getElementById('compQualityVal');
const compFileCount = document.getElementById('compFileCount');
const compStartBtn = document.getElementById('compStartBtn');
const compResultsSection = document.getElementById('compResultsSection');
const compResultsList = document.getElementById('compResultsList');
const compDownloadAllBox = document.getElementById('compDownloadAllBox');
const compDownloadAllBtn = document.getElementById('compDownloadAllBtn');
const compBackBtn = document.getElementById('compBackBtn');

let compFiles = [];
let processedCompFiles = [];
const MAX_FILES = 100;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

compQualitySlider.addEventListener('input', (e) => { compQualityVal.textContent = `${e.target.value}%`; });

compFileInput.addEventListener('change', (e) => handleCompFiles(e.target.files));
compDropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
compDropZone.addEventListener('drop', (e) => { e.preventDefault(); handleCompFiles(e.dataTransfer.files); });

function handleCompFiles(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    if (arr.some(f => f.size > MAX_FILE_SIZE)) { alert('One or more files exceed the 50MB limit.'); return; }
    if (arr.length > MAX_FILES) { alert(`Maximum ${MAX_FILES} files allowed.`); return; }
    
    compFiles = arr;
    compFileCount.textContent = `${compFiles.length} file(s) selected`;
    compSettingsBox.style.display = 'block';
}

compStartBtn.addEventListener('click', async () => {
    if (compFiles.length === 0) return;
    document.getElementById('compDropZone').style.display = 'none';
    compSettingsBox.style.display = 'none';
    compResultsSection.style.display = 'block';
    compResultsList.innerHTML = '';
    processedCompFiles = [];

    const quality = parseInt(compQualitySlider.value) / 100;

    for (let i = 0; i < compFiles.length; i++) {
        const file = compFiles[i];
        const li = document.createElement('div');
        li.className = 'result-item';
        li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats">Original: ${formatBytes(file.size)} ➔ Processing...</span></div><span class="status-badge">Working</span>`;
        compResultsList.appendChild(li);

        try {
            const blob = await processCompress(file, quality);
            const url = URL.createObjectURL(blob);
            processedCompFiles.push({ name: file.name, blob: blob, url: url });
            li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats">Original: ${formatBytes(file.size)} ➔ New: <strong style="color:var(--text-dark);">${formatBytes(blob.size)}</strong></span></div><a href="${url}" download="Compressed_${file.name}" class="download-btn">Download</a>`;
        } catch (err) {
            li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats" style="color:#EF4444;">Failed</span></div>`;
        }
    }
    if (processedCompFiles.length > 0) compDownloadAllBox.style.display = 'block';
});

function processCompress(file, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(blob => {
                    if (blob) resolve(blob); else reject(new Error('Canvas blob failed'));
                    ctx.clearRect(0,0,canvas.width,canvas.height);
                }, file.type, quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

compBackBtn.addEventListener('click', () => {
    processedCompFiles.forEach(item => URL.revokeObjectURL(item.url));
    processedCompFiles = []; compFiles = []; compFileInput.value = '';
    document.getElementById('compDropZone').style.display = 'block';
    compSettingsBox.style.display = 'none';
    compResultsSection.style.display = 'none';
    compDownloadAllBox.style.display = 'none';
});

compDownloadAllBtn.addEventListener('click', () => {
    const zip = new JSZip();
    compDownloadAllBtn.textContent = "Packaging ZIP...";
    compDownloadAllBtn.disabled = true;
    processedCompFiles.forEach(item => zip.file("Compressed_" + item.name, item.blob));
    zip.generateAsync({ type: "blob" }).then(content => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a'); a.href = url; a.download = "Compressed_Images.zip"; a.click();
        URL.revokeObjectURL(url);
        compDownloadAllBtn.textContent = "Download All (ZIP)";
        compDownloadAllBtn.disabled = false;
    });
});


// --- 2. CONVERTER ENGINE ---
const convDropZone = document.getElementById('convDropZone');
const convFileInput = document.getElementById('convFileInput');
const convSettingsBox = document.getElementById('convSettingsBox');
const targetFormat = document.getElementById('targetFormat');
const convFileCount = document.getElementById('convFileCount');
const convStartBtn = document.getElementById('convStartBtn');
const convResultsSection = document.getElementById('convResultsSection');
const convResultsList = document.getElementById('convResultsList');
const convDownloadAllBox = document.getElementById('convDownloadAllBox');
const convDownloadAllBtn = document.getElementById('convDownloadAllBtn');
const convBackBtn = document.getElementById('convBackBtn');

let convFiles = [];
let processedConvFiles = [];

convFileInput.addEventListener('change', (e) => handleConvFiles(e.target.files));
convDropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
convDropZone.addEventListener('drop', (e) => { e.preventDefault(); handleConvFiles(e.dataTransfer.files); });

function handleConvFiles(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    if (arr.some(f => f.size > MAX_FILE_SIZE)) { alert('One or more files exceed the 50MB limit.'); return; }
    if (arr.length > MAX_FILES) { alert(`Maximum ${MAX_FILES} files allowed.`); return; }
    
    convFiles = arr;
    convFileCount.textContent = `${convFiles.length} file(s) selected`;
    convSettingsBox.style.display = 'block';
}

convStartBtn.addEventListener('click', async () => {
    if (convFiles.length === 0) return;
    document.getElementById('convDropZone').style.display = 'none';
    convSettingsBox.style.display = 'none';
    convResultsSection.style.display = 'block';
    convResultsList.innerHTML = '';
    processedConvFiles = [];

    const format = targetFormat.value;
    const ext = format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1];

    for (let i = 0; i < convFiles.length; i++) {
        const file = convFiles[i];
        const li = document.createElement('div');
        li.className = 'result-item';
        li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats">Converting to .${ext.toUpperCase()}...</span></div><span class="status-badge">Working</span>`;
        convResultsList.appendChild(li);

        try {
            const blob = await processConvert(file, format);
            const url = URL.createObjectURL(blob);
            const newName = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + ext;
            processedConvFiles.push({ name: newName, blob: blob, url: url });
            li.innerHTML = `<div class="file-info"><span class="file-name">${newName}</span><span class="file-stats">Size: <strong style="color:var(--text-dark);">${formatBytes(blob.size)}</strong></span></div><a href="${url}" download="${newName}" class="download-btn">Download</a>`;
        } catch (err) {
            li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats" style="color:#EF4444;">Failed</span></div>`;
        }
    }
    if (processedConvFiles.length > 0) convDownloadAllBox.style.display = 'block';
});

function processConvert(file, format) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (format === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(blob => {
                    if (blob) resolve(blob); else reject(new Error('Conversion failed'));
                    ctx.clearRect(0,0,canvas.width,canvas.height);
                }, format, 0.92);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

convBackBtn.addEventListener('click', () => {
    processedConvFiles.forEach(item => URL.revokeObjectURL(item.url));
    processedConvFiles = []; convFiles = []; convFileInput.value = '';
    document.getElementById('convDropZone').style.display = 'block';
    convSettingsBox.style.display = 'none';
    convResultsSection.style.display = 'none';
    convDownloadAllBox.style.display = 'none';
});

convDownloadAllBtn.addEventListener('click', () => {
    const zip = new JSZip();
    convDownloadAllBtn.textContent = "Packaging ZIP...";
    convDownloadAllBtn.disabled = true;
    processedConvFiles.forEach(item => zip.file(item.name, item.blob));
    zip.generateAsync({ type: "blob" }).then(content => {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a'); a.href = url; a.download = "Converted_Images.zip"; a.click();
        URL.revokeObjectURL(url);
        convDownloadAllBtn.textContent = "Download All Converted (ZIP)";
        convDownloadAllBtn.disabled = false;
    });
});

// --- FAQ ACCORDIONS ---
document.querySelectorAll('.faq-question').forEach(faq => {
    faq.addEventListener('click', () => {
        faq.classList.toggle('active');
        const answer = faq.nextElementSibling;
        if (faq.classList.contains('active')) {
            answer.style.maxHeight = answer.scrollHeight + "px";
        } else {
            answer.style.maxHeight = null;
        }
    });
});
