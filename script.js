// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const settingsBox = document.getElementById('settingsBox');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');
const fileCountText = document.getElementById('fileCountText');
const compressBtn = document.getElementById('compressBtn');
const resultsSection = document.getElementById('resultsSection');
const noteBanner = document.getElementById('noteBanner');
const resultsList = document.getElementById('resultsList');
const downloadAllBox = document.getElementById('downloadAllBox');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const compressMoreBtn = document.getElementById('compressMoreBtn');

let selectedFiles = [];
let processedFiles = [];
const MAX_BATCH_SIZE = 50;
const DAILY_LIMIT = 1000;
let isProcessing = false;

// History API for Back Button (SPA Feel)
if(window.history.replaceState) { window.history.replaceState({ page: 'upload' }, ''); }
window.addEventListener('popstate', (e) => { if (e.state && e.state.page === 'upload') resetToUploadScreen(); });

function resetToUploadScreen() {
    if (isProcessing) return;
    processedFiles.forEach(item => URL.revokeObjectURL(item.url));
    processedFiles = []; selectedFiles = []; fileInput.value = '';
    uploadSection.style.display = 'block'; settingsBox.style.display = 'none';
    resultsSection.style.display = 'none'; noteBanner.style.display = 'none'; resultsList.innerHTML = '';
}
compressMoreBtn.addEventListener('click', () => window.history.back());

// Daily Limit Checker
function checkDailyLimit(newFilesCount) {
    const today = new Date().toISOString().split('T')[0];
    let usageData = JSON.parse(localStorage.getItem('compressUsage')) || { date: today, count: 0 };
    if (usageData.date !== today) usageData = { date: today, count: 0 };
    return (usageData.count + newFilesCount <= DAILY_LIMIT);
}

function updateDailyLimit(processedCount) {
    const today = new Date().toISOString().split('T')[0];
    let usageData = JSON.parse(localStorage.getItem('compressUsage')) || { date: today, count: 0 };
    usageData.count += processedCount; localStorage.setItem('compressUsage', JSON.stringify(usageData));
}

// Drag & Drop Handling
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
qualitySlider.addEventListener('input', (e) => { qualityValue.textContent = `${e.target.value}%`; });

function handleFiles(files) {
    if (isProcessing) return;
    const filesArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (filesArray.length === 0) return;
    if (filesArray.length > MAX_BATCH_SIZE) { alert(`Maximum ${MAX_BATCH_SIZE} images allowed.`); return; }
    if (!checkDailyLimit(filesArray.length)) { alert("Today's limit reached. Please come back tomorrow."); return; }
    
    selectedFiles = filesArray; 
    fileCountText.textContent = `${selectedFiles.length} file(s) selected`; 
    settingsBox.style.display = 'block';
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Compression Core Engine
compressBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    window.history.pushState({ page: 'results' }, '');
    
    isProcessing = true; 
    uploadSection.style.display = 'none'; 
    resultsSection.style.display = 'block';
    noteBanner.style.display = 'block'; 
    downloadAllBox.style.display = 'none'; 
    compressMoreBtn.style.display = 'none';
    resultsList.innerHTML = '';
    
    const quality = parseInt(qualitySlider.value) / 100;

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const li = document.createElement('div'); li.className = 'result-item';
        li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats">Original: ${formatBytes(file.size)} ➔ Processing...</span></div><span class="status-badge">Processing</span>`;
        resultsList.appendChild(li);
        
        try {
            const compressedBlob = await compressImageProcess(file, quality);
            const compressedSize = formatBytes(compressedBlob.size);
            const url = URL.createObjectURL(compressedBlob);
            processedFiles.push({ name: file.name, blob: compressedBlob, url: url });
            
            li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats">Original: ${formatBytes(file.size)} ➔ New: <strong style="color:var(--text-dark);">${compressedSize}</strong></span></div><a href="${url}" download="Compressed_${file.name}" class="download-btn">Download</a>`;
            updateDailyLimit(1);
        } catch (error) { 
            li.innerHTML = `<div class="file-info"><span class="file-name">${file.name}</span><span class="file-stats" style="color: #EF4444;">Failed</span></div>`; 
        }
    }
    isProcessing = false; 
    compressMoreBtn.style.display = 'block';
    if (processedFiles.length > 0) downloadAllBox.style.display = 'block';
});

function compressImageProcess(file, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (blob) resolve(blob); else reject(new Error('Canvas failed'));
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }, file.type, quality);
            }; img.onerror = reject;
        }; reader.onerror = reject;
    });
}

// Download All ZIP
downloadAllBtn.addEventListener('click', () => {
    const zip = new JSZip(); downloadAllBtn.textContent = "Packaging ZIP..."; downloadAllBtn.disabled = true;
    processedFiles.forEach(item => { zip.file("Compressed_" + item.name, item.blob); });
    zip.generateAsync({ type: "blob" }).then(function (content) {
        const zipUrl = URL.createObjectURL(content); const a = document.createElement('a');
        a.href = zipUrl; a.download = "Compressed_Images.zip"; a.click();
        URL.revokeObjectURL(zipUrl); downloadAllBtn.textContent = "Download All (ZIP)"; downloadAllBtn.disabled = false;
    });
});

// SEO FAQ Accordion Logic (NEW)
const faqs = document.querySelectorAll('.faq-question');
faqs.forEach(faq => {
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


