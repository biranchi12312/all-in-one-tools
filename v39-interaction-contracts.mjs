import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const tools=[
 ['compress-images','image-tools','data-image-input'],
 ['convert-images','image-tools','data-image-input'],
 ['resize-images','image-tools','data-image-input'],
 ['crop-rotate','image-tools','data-image-input'],
 ['images-to-pdf','pdf-tools','data-pdf-input'],
 ['merge-pdf','pdf-tools','data-pdf-input'],
 ['split-pdf','pdf-tools','data-pdf-input'],
 ['pdf-to-images','pdf-tools','data-pdf-input']
];
let failed=false,passed=0;
const assert=(c,m)=>{if(!c)throw new Error(m)};
for(const [name,dir,input] of tools){
 try{
  const html=fs.readFileSync(path.join(root,dir,`${name}.html`),'utf8');
  const runtime=fs.readFileSync(path.join(root,'assets/js/tools/runtimes',`${name}.js`),'utf8');
  assert(html.includes(input),`${name}: missing own upload input`);
  assert(html.includes('data-start'),`${name}: missing primary action`);
  assert(html.includes('data-reset') || html.includes('data-result-reset') || html.includes('data-result-clear'),`${name}: missing reset path`);
  assert(html.includes('data-result-list'),`${name}: missing result surface`);
  assert(runtime.includes(`data-${dir==='image-tools'?'image':'pdf'}-tool="${name}"`),`${name}: runtime root mismatch`);
  assert(!runtime.includes('tool-runtime.js'),`${name}: dedicated runtime imports generic workflow runtime`);
  console.log(`PASS interaction contract ${name}`);passed++;
 }catch(e){failed=true;console.error(`FAIL interaction contract ${name}: ${e.message}`)}
}
console.log(`\n${passed}/${tools.length} interaction contracts passed.`);
process.exitCode=failed?1:0;
