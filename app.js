import { ORIVA_CONFIG } from "./config.js";
import { initNavigation } from "./navigation.js";
import { initNetwork } from "./network.js";
import { initGlobalErrors } from "./errors.js";

document.documentElement.classList.add("js-ready");
document.documentElement.dataset.orivaVersion=ORIVA_CONFIG.version;

let booted=false;
function boot(){
  if(booted) return;
  booted=true;
  initGlobalErrors();
  if(ORIVA_CONFIG.navigationProgress) initNavigation();
  initNetwork();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
else boot();

window.addEventListener("pageshow",()=>{ document.documentElement.dataset.pageReady="true"; });
