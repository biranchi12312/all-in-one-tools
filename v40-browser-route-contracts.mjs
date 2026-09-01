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
let failed=false, passed=0;
const assert=(c,m)=>{if(!c)throw new Error(m)};
for(const [name,dir,input] of tools){
 try{
  const rel=`/${dir}/${name}.html`;
  const file=path.join(root,dir,`${name}.html`);
  const html=fs.readFileSync(file,'utf8');
  assert(fs.existsSync(file),`${name}: route target missing`);
  assert(html.includes(input),`${name}: expected upload selector missing from route target`);
  assert(html.includes(`data-tool-page="${name}"`) || html.includes(`data-tool-page='${name}'`),`${name}: page identity missing`);
  assert(!rel.includes('//'),`${name}: malformed route`);
  console.log(`PASS route contract ${name} ${rel}`); passed++;
 }catch(e){failed=true;console.error(`FAIL route contract ${name}: ${e.message}`)}
}
console.log(`\n${passed}/${tools.length} route contracts passed.`);
process.exitCode=failed?1:0;
