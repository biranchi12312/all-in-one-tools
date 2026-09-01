import fs from "node:fs";
const root=new URL("..",import.meta.url).pathname;
const runtime=fs.readFileSync(root+"/assets/js/tools/resize-images-runtime.js","utf8");
const html=fs.readFileSync(root+"/image-tools/resize-images.html","utf8");
const css=fs.readFileSync(root+"/assets/css/tools/tool-v2.css","utf8");
const checks=[
 ["dedicated runtime",html.includes("resize-images-runtime.js")],
 ["generic image runtime removed",!html.includes("assets/js/tools/image-tools.js")],
 ["50 file v76 limit",runtime.includes("MAX_FILES = 50")],
 ["source pixel safety",runtime.includes("MAX_PIXELS = 40_000_000")],
 ["source dimension safety",runtime.includes("MAX_SOURCE_DIMENSION = 9000")],
 ["output cap",runtime.includes("MAX_OUTPUT_DIMENSION = 4096")],
 ["action remains connected",!runtime.includes("el.action.remove()") && !runtime.includes("actionAnchor")],
 ["progress separate step",html.includes("data-step=\"progress\"")],
 ["clear confirmation",runtime.includes("Clear images?")],
 ["partial failure popup",runtime.includes("Some images failed")],
 ["rejected upload popup",runtime.includes("Some files were skipped")],
 ["resize more",html.includes("data-resize-more")],
 ["results shell",html.includes("data-resize-results")],
 ["resize scoped lifecycle css",css.includes(".resize-workspace[data-phase=\"processing\"]")],
 ["service worker v28",fs.readFileSync(root+"/sw.js","utf8").includes("orivastudio-v28-resize-deep-parity-rebuild")]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"}: ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
