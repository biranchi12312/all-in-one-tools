import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const runtimes=fs.readdirSync(path.join(root,'assets/js/tools/runtimes')).filter(f=>f.endsWith('.js'));
let failed=0;
for(const file of runtimes){
 const src=fs.readFileSync(path.join(root,'assets/js/tools/runtimes',file),'utf8');
 const name=file.replace(/\.js$/,'');
 const ownRoot=new RegExp(`data-(?:image|pdf)-tool=["']${name}["']`).test(src);
 const legacy=!src.includes('image-tools.js')&&!src.includes('pdf-tools.js')&&!src.includes('tool-runtime.js');
 const init=/init[A-Za-z0-9_]+\(/.test(src);
 if(ownRoot&&legacy&&init) console.log(`PASS runtime boundary ${name}`);
 else {console.error(`FAIL runtime boundary ${name} ownRoot=${ownRoot} legacy=${legacy} init=${init}`);failed++;}
}
for(const file of fs.readdirSync(path.join(root,'assets/css/tools/pages')).filter(f=>f.endsWith('.css'))){
 const name=file.replace(/\.css$/,'');
 const src=fs.readFileSync(path.join(root,'assets/css/tools/pages',file),'utf8');
 const namespaced=src.includes(`[data-tool-page="${name}"]`)||src.includes(`[data-tool-page='${name}']`);
 if(namespaced) console.log(`PASS CSS boundary ${name}`);
 else {console.error(`FAIL CSS boundary ${name}`);failed++;}
}
if(failed){console.error(`\n${failed} boundary failure(s).`);process.exit(1)}
console.log('\nRuntime and CSS boundaries passed.');
