import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const tools=[
 ['image-tools/compress-images.html','compress-images','image','data-image-input'],
 ['image-tools/convert-images.html','convert-images','image','data-image-input'],
 ['image-tools/resize-images.html','resize-images','image','data-image-input'],
 ['image-tools/crop-rotate.html','crop-rotate','image','data-image-input'],
 ['pdf-tools/images-to-pdf.html','images-to-pdf','pdf','data-pdf-input'],
 ['pdf-tools/merge-pdf.html','merge-pdf','pdf','data-pdf-input'],
 ['pdf-tools/split-pdf.html','split-pdf','pdf','data-pdf-input'],
 ['pdf-tools/pdf-to-images.html','pdf-to-images','pdf','data-pdf-input'],
];
const required=['data-drop-zone','data-browse','data-start','data-reset','data-tool-status','data-file-list','data-result-list'];
let failed=0;
for(const [rel,name,kind,inputAttr] of tools){
 const html=fs.readFileSync(path.join(root,rel),'utf8');
 const checks=[];
 checks.push([`root identity ${name}`, new RegExp(`data-${kind}-tool=["']${name}["']`).test(html)]);
 checks.push([`tool page identity ${name}`, new RegExp(`data-tool-page=["']${name}["']`).test(html)]);
 checks.push([`input ${inputAttr}`, html.includes(inputAttr)]);
 for(const attr of required) checks.push([attr,html.includes(attr)]);
 checks.push(['dedicated CSS v38', html.includes(`/pages/${name}.css?v=38`)]);
 checks.push(['dedicated runtime v38', html.includes(`/runtimes/${name}.js?v=38`)]);
 checks.push(['no legacy dispatcher', !/image-tools\.js|pdf-tools\.js/.test(html)]);
 checks.push(['no direct generic runtime', !/tool-runtime\.js/.test(html)]);
 checks.push(['no duplicate type attribute', !/<script\b[^>]*\btype="module"[^>]*\btype="module"/i.test(html)]);
 for(const [label,ok] of checks){
  if(!ok){console.error(`FAIL ${name}: ${label}`);failed++;}
 }
 if(checks.every(([,ok])=>ok)) console.log(`PASS lifecycle contract ${name}`);
}
if(failed){console.error(`\n${failed} lifecycle contract failure(s).`);process.exit(1)}
console.log('\n8/8 lifecycle contracts passed.');
