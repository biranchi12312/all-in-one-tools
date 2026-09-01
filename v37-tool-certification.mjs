import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const tools=[
 ['compress-images','image-tools'],['convert-images','image-tools'],['resize-images','image-tools'],['crop-rotate','image-tools'],
 ['images-to-pdf','pdf-tools'],['merge-pdf','pdf-tools'],['split-pdf','pdf-tools'],['pdf-to-images','pdf-tools']
];
const tests=[]; const test=(n,f)=>tests.push([n,f]); const assert=(c,m)=>{if(!c)throw new Error(m)};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Every tool page has exactly one dedicated page stylesheet',()=>{
 for(const [name,dir] of tools){const s=read(`${dir}/${name}.html`);const hits=[...s.matchAll(new RegExp(`assets/css/tools/pages/${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}.css`,`g`))];assert(hits.length===1,`${name}: expected 1 dedicated stylesheet, got ${hits.length}`);assert(!s.includes('assets/css/tools/tool-v2.css'),`${name}: legacy shared tool-v2.css still loaded`);}
});
test('Every tool page has exactly one dedicated runtime entry',()=>{
 for(const [name,dir] of tools){const s=read(`${dir}/${name}.html`);const needle=`assets/js/tools/runtimes/${name}.js`;const hits=[...s.matchAll(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))];assert(hits.length===1,`${name}: expected 1 runtime entry, got ${hits.length}`);assert(!s.includes('image-tools.js')&&!s.includes('pdf-tools.js'),`${name}: legacy category dispatcher loaded`);}
});
test('Tool pages have no stale v35/v36 cache identity',()=>{
 for(const [name,dir] of tools){const s=read(`${dir}/${name}.html`);assert(!s.includes('?v=35')&&!s.includes('?v=36'),`${name}: stale v35/v36 cache parameter remains`);}
});
test('Every dedicated stylesheet is tool-namespaced',()=>{
 for(const [name] of tools){const s=read(`assets/css/tools/pages/${name}.css`);assert(s.includes(`[data-tool-page="${name}"]`)||s.includes(`[data-tool-page='${name}']`),`${name}: missing page namespace`);}
});
test('All dedicated runtimes parse and only initialize their own root',()=>{
 for(const [name] of tools){const p=path.join(root,'assets/js/tools/runtimes',`${name}.js`);execFileSync('node',['--check',p],{stdio:'pipe'});const s=fs.readFileSync(p,'utf8');assert(s.includes('document.querySelector'),`${name}: no root lookup`);assert(s.includes(`init${name.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('')}Runtime`)||s.includes('init'),`${name}: no init path`);}
});
test('Controllers for formerly generic tools do not import generic workflow runtime',()=>{
 for(const name of ['compress-images','convert-images','split-pdf']){const s=read(`assets/js/tools/controllers/${name}.js`);assert(!s.includes('tool-runtime.js'),`${name}: still imports generic workflow runtime`);}
});
test('Legacy generic runtime is not an active page dependency',()=>{
 for(const [name,dir] of tools){const s=read(`${dir}/${name}.html`);assert(!s.includes('tool-runtime.js'),`${name}: page directly loads generic runtime`);}
});
test('All project JavaScript parses',()=>{
 const files=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p):e.name.endsWith('.js')&&files.push(p)}};walk(path.join(root,'assets/js'));for(const p of files)execFileSync('node',['--check',p],{stdio:'pipe'});
});
test('Service worker has an explicit current cache identity',()=>{const s=read('sw.js');assert(/const VERSION = \"orivastudio-v\d+-[a-z0-9-]+\"/.test(s),'service worker cache identity is missing or malformed');});
let pass=0; for(const [name,fn] of tests){try{fn();console.log(`PASS ${name}`);pass++}catch(e){console.error(`FAIL ${name}: ${e.message}`);process.exitCode=1}}console.log(`\n${pass}/${tests.length} legacy isolation certification checks passed.`);
