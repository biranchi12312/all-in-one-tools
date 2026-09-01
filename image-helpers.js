function typeExt(type){return type==="image/png"?"png":type==="image/webp"?"webp":"jpg";}
function cleanName(name,ext){const base=(name||"file").replace(/\.[^.]+$/,"" ).replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"file";return `${base}.${ext}`;}
async function decode(file){if("createImageBitmap" in window)return createImageBitmap(file,{imageOrientation:"from-image"});const url=URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Image could not be decoded."));image.src=url;});}finally{setTimeout(()=>URL.revokeObjectURL(url),0);}}
function toBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Browser could not encode this image.")),type,quality));}
function closeImage(image){try{image.close?.();}catch{}}
export {typeExt,cleanName,decode,toBlob,closeImage};
