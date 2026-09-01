import { loadPdfJs, createPdfDocumentOptions } from "./pdf-library-loader.js";

const zipCache = new Map();
const ZIP_ACTION_LABEL = "Download All as ZIP";

function parseAccept(input) {
  return (input.getAttribute("accept") || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
}
function matchesAccept(file, rules) {
  if (!rules.length) return true;
  const type=(file.type||"").toLowerCase(), name=(file.name||"").toLowerCase();
  return rules.some(rule => rule === "*/*" || (rule.endsWith("/*") && type.startsWith(rule.slice(0,-1))) || (rule.startsWith(".") && name.endsWith(rule)) || type===rule);
}
function formatBytes(bytes) {
  const units=["B","KB","MB","GB"]; let value=Number(bytes)||0, unit=0;
  while(value>=1024 && unit<units.length-1){value/=1024;unit++;}
  return `${value>=10||unit===0?value.toFixed(0):value.toFixed(1)} ${units[unit]}`;
}
async function loadScript(url,key,globalName){
  if(window[globalName]) return window[globalName];
  if(zipCache.has(key)) return zipCache.get(key);
  const promise=new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-oriva-lib="${key}"]`);
    if(existing){ existing.addEventListener("load",()=>resolve(window[globalName]),{once:true}); existing.addEventListener("error",()=>reject(new Error("Required download component could not be loaded.")),{once:true}); return; }
    const s=document.createElement("script"); s.src=url; s.async=true; s.dataset.orivaLib=key;
    s.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error("Required download component did not initialize."));
    s.onerror=()=>reject(new Error("Required download component could not be loaded.")); document.head.append(s);
  });
  zipCache.set(key,promise); return promise;
}

export function initRuntime({root,input,drop,browse,start,reset,status,list,results,maxFiles,maxBytes,maxTotal,minFiles=1,orderable=false}){
  const state={files:[],busy:false,engine:null,urls:new Set(),phase:"upload",outputs:[]};
  const acceptRules=parseAccept(input);
  const progressWrap=root.querySelector("[data-progress-wrap]"), progressFill=root.querySelector("[data-progress-fill]"), progressText=root.querySelector("[data-progress-text]");
  const downloadAll=root.querySelector("[data-download-all]");

  function setPhase(phase){state.phase=phase;root.dataset.phase=phase;}
  function setStatus(message="",kind="",visible=false){
    status.textContent=message;
    status.dataset.kind=kind;
    status.hidden=!visible;
    root.dataset.statusVisible=visible?"true":"false";
  }
  async function showError(title,message){
    if(root.dataset.errorPopup!=="true") return;
    const ui=window.OrivaDialog;
    if(ui?.error){await ui.error({title,message});return;}
    window.alert(`${title}\n\n${message}`);
  }
  async function confirmReset(){
    if(root.dataset.confirmReset!=="true") return true;
    const title="Clear this image?",message="This clears the current image and result. Your original file stays unchanged.";
    const ui=window.OrivaDialog;
    if(ui?.confirm) return !!(await ui.confirm({title,message,confirmLabel:"Clear All",cancelLabel:"Cancel"}));
    return window.confirm(message);
  }
  function setProgress(percent=null,text=""){
    if(!progressWrap) return;
    const show=Number.isFinite(percent);
    progressWrap.hidden=!show;
    if(show){const safe=Math.max(0,Math.min(100,percent)); if(progressFill) progressFill.style.width=`${safe}%`; if(progressText) progressText.textContent=text||`${Math.round(safe)}%`;}
  }
  function syncOutputs(){root.querySelectorAll('input[type="range"]').forEach(control=>{const row=control.closest(".range-row");const output=row?.querySelector("output");if(!output)return;const update=()=>output.textContent=`${control.value}%`;update();control.addEventListener("input",update);});}
  function revokeResultUrls(){state.urls.forEach(URL.revokeObjectURL);state.urls.clear();}
  async function ensureEngine(){if(state.engine)return state.engine;const engineName=root.dataset.engine;if(!engineName)throw new Error("This tool is missing its processing engine.");state.engine=await import(`./engines/${engineName}.js`);await state.engine.setup?.({root,getFiles:()=>[...state.files],setStatus,setProgress,formatBytes});return state.engine;}
  async function createPdfThumbnail(file){if(list.dataset.pdfPreview!=="true")return null;let task=null,pdf=null;try{const pdfjs=await loadPdfJs();task=pdfjs.getDocument(createPdfDocumentOptions(await file.arrayBuffer()));pdf=await task.promise;const page=await pdf.getPage(1);const viewport=page.getViewport({scale:.28});const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;return canvas.toDataURL("image/jpeg",.82);}catch{return null;}finally{try{await pdf?.destroy?.();}catch{}try{await task?.destroy?.();}catch{}}}
  function addImagePreview(file,meta){const preview=document.createElement("div");preview.className="image-file-preview";const img=document.createElement("img");img.alt="";img.loading="lazy";const url=URL.createObjectURL(file);img.src=url;img.onload=img.onerror=()=>setTimeout(()=>URL.revokeObjectURL(url),1000);preview.append(img);meta.prepend(preview);}
  function renderFiles(){list.innerHTML="";if(!state.files.length){list.innerHTML='<div class="empty-state">No files added yet.</div>';start.disabled=true;return;}
    state.files.forEach((file,index)=>{const row=document.createElement("div");row.className="file-row";row.dataset.index=String(index);if(orderable)row.draggable=!state.busy;
      const meta=document.createElement("div");meta.className="file-meta";const text=document.createElement("div");text.className="file-text-meta";const name=document.createElement("div");name.className="file-name";name.textContent=file.name;const size=document.createElement("div");size.className="file-size";size.textContent=formatBytes(file.size);text.append(name,size);meta.append(text);
      if(list.dataset.pdfPreview==="true" && (file.type==="application/pdf"||/\.pdf$/i.test(file.name))){const preview=document.createElement("div");preview.className="pdf-file-preview";preview.textContent="PDF";meta.prepend(preview);createPdfThumbnail(file).then(url=>{if(!url||!preview.isConnected)return;const image=document.createElement("img");image.alt="";image.loading="lazy";image.src=url;preview.replaceChildren(image);});}
      else if(file.type.startsWith("image/")) addImagePreview(file,meta);
      const controls=document.createElement("div");controls.className="file-controls";
      if(orderable){for(const [label,delta] of [["↑",-1],["↓",1]]){const b=document.createElement("button");b.type="button";b.className="icon-btn";b.textContent=label;b.disabled=state.busy||index+delta<0||index+delta>=state.files.length;b.addEventListener("click",()=>{const target=index+delta;[state.files[index],state.files[target]]=[state.files[target],state.files[index]];renderFiles();state.engine?.onOrderChange?.({root,files:[...state.files]});});controls.append(b);}}
      const remove=document.createElement("button");remove.type="button";remove.className="remove-file";remove.textContent="Remove";remove.disabled=state.busy;remove.addEventListener("click",async()=>{state.files.splice(index,1);await afterFileChange();});controls.append(remove);row.append(meta,controls);
      if(orderable){row.addEventListener("dragstart",e=>{if(state.busy)return;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(index));});row.addEventListener("dragover",e=>{e.preventDefault();row.dataset.dragOver="true";});row.addEventListener("dragleave",()=>delete row.dataset.dragOver);row.addEventListener("drop",e=>{e.preventDefault();delete row.dataset.dragOver;const from=Number(e.dataTransfer.getData("text/plain")),to=index;if(!Number.isInteger(from)||from===to)return;const [item]=state.files.splice(from,1);state.files.splice(to,0,item);renderFiles();state.engine?.onOrderChange?.({root,files:[...state.files]});});}
      list.append(row);
    });start.disabled=state.busy||state.files.length<minFiles;
  }
  function validateIncoming(incoming){if(!incoming.length)throw new Error("Please choose at least one file.");const invalid=incoming.find(file=>!matchesAccept(file,acceptRules));if(invalid)throw new Error(`${invalid.name} is not supported by this tool.`);const combined=[...state.files,...incoming];if(combined.length>maxFiles)throw new Error(`You can add up to ${maxFiles} files at a time.`);let total=0;for(const file of combined){if(!file.size)throw new Error(`${file.name} is empty and cannot be processed.`);if(file.size>maxBytes)throw new Error(`${file.name} is larger than the allowed limit.`);total+=file.size;}if(total>maxTotal)throw new Error("The selected batch exceeds the total safety limit.");return combined;}
  async function afterFileChange(){revokeResultUrls();state.outputs=[];results.innerHTML="";setProgress(null);renderFiles();if(!state.files.length){setPhase("upload");setStatus("","",false);return;}await ensureEngine();await state.engine.onFiles?.({root,files:[...state.files],setStatus,setProgress,formatBytes});setPhase("settings");setStatus(`${state.files.length} file${state.files.length===1?"":"s"} ready. Review the settings, then continue.`,"success",true);}
  async function addFiles(files){if(state.busy)return;try{state.files=validateIncoming([...files]);await afterFileChange();}catch(error){const message=error.message||"Files could not be added.";setPhase(state.files.length?"settings":"upload");setStatus(message,"error",true);await showError("Could not open image",message);}finally{input.value="";}}
  function resetControls(){root.querySelectorAll("input,select,textarea").forEach(c=>{if(c===input)return;if(c.type==="checkbox"||c.type==="radio")c.checked=c.defaultChecked;else if(c.type!=="file")c.value=c.defaultValue;});root.querySelectorAll('input[type="range"]').forEach(c=>c.dispatchEvent(new Event("input",{bubbles:true})));}
  async function resetTool(){if(state.busy)return;if(state.files.length&&!(await confirmReset()))return;try{await state.engine?.reset?.({root});}catch(error){console.warn("Tool reset hook failed",error);}state.files=[];state.outputs=[];revokeResultUrls();results.innerHTML="";resetControls();setProgress(null);setPhase("upload");setStatus("","",false);renderFiles();}
  function renderResults(output){
    revokeResultUrls();state.outputs=output;results.innerHTML="";
    output.forEach(({blob,name,meta})=>{const row=document.createElement("div");row.className="result-row";const left=document.createElement("div");const n=document.createElement("div");n.className="result-name";n.textContent=name;const m=document.createElement("div");m.className="result-meta";m.textContent=meta||formatBytes(blob.size);left.append(n,m);const link=document.createElement("a");link.className="btn secondary";link.textContent="Download";link.href=URL.createObjectURL(blob);link.download=name;state.urls.add(link.href);row.append(left,link);results.append(row);});
    if(root.dataset.resultClear==="true"){
      const actions=document.createElement("div");actions.className="crop-result-clear";
      const clear=document.createElement("button");clear.type="button";clear.className="btn secondary";clear.textContent="Clear All";clear.addEventListener("click",resetTool);actions.append(clear);results.append(actions);
    }
    if(downloadAll){downloadAll.hidden=output.length<2;}
  }
  async function downloadAllResults(){if(state.outputs.length<2)return;try{setStatus("Preparing ZIP download…","working",true);const JSZip=await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js","JSZip","JSZip");const zip=new JSZip();state.outputs.forEach(({blob,name})=>zip.file(name,blob));const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"},meta=>setProgress(meta.percent,"Preparing ZIP…"));const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download=`orivastudio-results-${Date.now()}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);setProgress(null);setStatus(`${state.outputs.length} results are ready to download.`,"success",true);}catch(error){setProgress(null);setStatus(error.message||"ZIP could not be created.","error",true);}}
  browse.addEventListener("click",e=>{e.stopPropagation();input.click();});drop.addEventListener("click",()=>{if(!state.busy)input.click();});drop.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!state.busy){e.preventDefault();input.click();}});input.addEventListener("change",e=>addFiles(e.target.files));["dragenter","dragover"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();if(!state.busy)drop.dataset.active="true";}));["dragleave","drop"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.dataset.active="false";}));drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));reset.addEventListener("click",resetTool);downloadAll?.addEventListener("click",downloadAllResults);
  start.addEventListener("click",async()=>{if(state.files.length<minFiles||state.busy)return;state.busy=true;start.disabled=true;root.dataset.processing="true";setPhase("processing");setProgress(0,"Starting…");setStatus("Preparing the selected files…","working",true);try{const engine=await ensureEngine();const output=await engine.process({root,files:[...state.files],say:(message,kind="working",percent)=>{setStatus(message,kind,true);if(Number.isFinite(percent))setProgress(percent,message);},fmt:formatBytes});if(!Array.isArray(output)||!output.length)throw new Error("No result was produced.");renderResults(output);setProgress(null);setPhase("results");setStatus(`${output.length} result${output.length===1?" is":"s are"} ready to download.`,"success",true);}catch(error){console.error(error);const message=error.message||"Processing could not be completed.";setProgress(null);setPhase("settings");setStatus(message,"error",true);await showError("Export failed",message);}finally{state.busy=false;root.dataset.processing="false";start.disabled=state.files.length<minFiles;renderFiles();}});
  setPhase("upload");root.dataset.statusVisible="false";root.dataset.processing="false";syncOutputs();renderFiles();ensureEngine().catch(()=>{});return state;
}
