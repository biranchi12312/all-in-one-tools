import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const pages=[
 ['image-tools/compress-images.html','compress-images','image'],['image-tools/convert-images.html','convert-images','image'],['image-tools/resize-images.html','resize-images','image'],['image-tools/crop-rotate.html','crop-rotate','image'],
 ['pdf-tools/images-to-pdf.html','images-to-pdf','pdf'],['pdf-tools/merge-pdf.html','merge-pdf','pdf'],['pdf-tools/split-pdf.html','split-pdf','pdf'],['pdf-tools/pdf-to-images.html','pdf-to-images','pdf']
];
let failed=false;
for(const [file,name,kind] of pages){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 const ownRuntime=`tools/runtimes/${name}.js`;
 const ownCss=`tools/pages/${name}.css`;
 const bodyNs=`data-tool-page="${name}"`;
 const noLegacy=!html.includes('tools/tool-v2.css')&&!/tools\/(?:image-tools|pdf-tools)\.js/.test(html);
 const moduleScripts=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].every(m=>/type="module"/.test(m[0]));
 const cssPath=path.join(root,'assets/css/tools/pages',`${name}.css`);
 const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
 const scoped=css.includes(`.tool-v2[data-tool-page="${name}"]`);
 const ok=html.includes(ownRuntime)&&html.includes(ownCss)&&html.includes(bodyNs)&&noLegacy&&moduleScripts&&scoped;
 console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed=true;
}
for(const name of ['compress-images','convert-images','split-pdf']){
 const runtime=fs.readFileSync(path.join(root,'assets/js/tools/runtimes',`${name}.js`),'utf8');
 const controller=path.join(root,'assets/js/tools/controllers',`${name}.js`);
 const ok=runtime.includes(`controllers/${name}.js`) && fs.existsSync(controller) && !fs.readFileSync(controller,'utf8').includes('from "./tool-runtime.js"');
 console.log(`${ok?'PASS':'FAIL'} dedicated-controller ${name}`); if(!ok) failed=true;
}
const crop=fs.readFileSync(path.join(root,'image-tools/crop-rotate.html'),'utf8');
const cropOk=!crop.includes('initCropRotateRuntime(root);</script>'); console.log(`${cropOk?'PASS':'FAIL'} crop-single-init`); if(!cropOk) failed=true;
process.exitCode=failed?1:0;
