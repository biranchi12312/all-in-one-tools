import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const pages=[
 ['image-tools/compress-images.html','compress-images'],['image-tools/convert-images.html','convert-images'],['image-tools/resize-images.html','resize-images'],['image-tools/crop-rotate.html','crop-rotate'],
 ['pdf-tools/images-to-pdf.html','images-to-pdf'],['pdf-tools/merge-pdf.html','merge-pdf'],['pdf-tools/split-pdf.html','split-pdf'],['pdf-tools/pdf-to-images.html','pdf-to-images']
];
let failed=false;
for(const [file,name] of pages){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 const own=`tools/runtimes/${name}.js`;
 const hasOwn=html.includes(own);
 const hasLegacy=/tools\/(?:image-tools|pdf-tools)\.js/.test(html);
 const css=html.includes(`tools/pages/${name}.css`);
 const moduleScripts=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].every(m=>m[0].includes('type="module"'));
 const ok=hasOwn&&!hasLegacy&&css&&moduleScripts;
 console.log(`${ok?'PASS':'FAIL'} ${file}`);
 if(!ok) failed=true;
}
process.exitCode=failed?1:0;
