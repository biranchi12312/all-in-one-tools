function normalizeExternalLinks(){
  document.querySelectorAll('a[target="_blank"]').forEach(a=>{
    const rel=new Set((a.getAttribute("rel")||"").split(/\s+/).filter(Boolean));
    rel.add("noopener"); rel.add("noreferrer");
    a.setAttribute("rel",[...rel].join(" "));
  });
}
function improveButtons(){
  document.querySelectorAll("button").forEach(button=>{
    if(!button.hasAttribute("type")) button.type="button";
  });
}
function preserveScrollFocus(){
  const main=document.getElementById("main-content");
  if(!main) return;
  window.addEventListener("pageshow",event=>{
    if(event.persisted) document.documentElement.classList.add("bfcache-restored");
  });
}
function preventDropNavigation(){
  addEventListener("dragover",e=>e.preventDefault());
  addEventListener("drop",e=>{
    if(!e.target.closest?.("[data-drop-zone]")) e.preventDefault();
  });
}
function init(){
  normalizeExternalLinks();
  improveButtons();
  preserveScrollFocus();
  preventDropNavigation();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
