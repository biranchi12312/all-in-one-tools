import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const tools = [
  {
    name:'Merge PDF', html:'pdf-tools/merge-pdf.html', js:'assets/js/tools/merge-pdf-runtime.js', css:'assets/css/tools/pages/merge-pdf.css',
    htmlTokens:['data-pdf-tool="merge-pdf"','data-pdf-input','data-reset-inline','data-start','data-progress-wrap'],
    jsTokens:['COLLECTING: "collecting"','REVIEW: "review"','password-protected','already in the merge list','setProgress(100','downloadOutput','previewOutput'],
    cssTokens:['merge-workspace']
  },
  {
    name:'Images to PDF', html:'pdf-tools/images-to-pdf.html', js:'assets/js/tools/images-to-pdf-runtime.js', css:'assets/css/tools/pages/images-to-pdf.css',
    htmlTokens:['data-pdf-tool="images-to-pdf"','data-pdf-input','data-page-size','data-output-name','data-progress-wrap'],
    jsTokens:['revokePreviews','Create Another','Download PDF','progressWrap.hidden = true','setProgress'],
    cssTokens:['i2p-workspace']
  },
  {
    name:'PDF to Images', html:'pdf-tools/pdf-to-images.html', js:'assets/js/tools/pdf-to-images-runtime.js', css:'assets/css/tools/pages/pdf-to-images.css',
    htmlTokens:['data-pdf-tool="pdf-to-images"','data-pdf-input','data-pdf-image-format','data-download-all','data-progress-wrap'],
    jsTokens:['function loadZip','thumbnailGeneration','revokePreviewUrls','downloadAll','password|encrypted'],
    cssTokens:['p2i-workspace']
  },
  {
    name:'Resize Images', html:'image-tools/resize-images.html', js:'assets/js/tools/resize-images-runtime.js', css:'assets/css/tools/pages/resize-images.css',
    htmlTokens:['data-image-tool="resize-images"','data-resize-mode','data-keep-ratio','data-output-format','data-resize-more'],
    jsTokens:['function setHidden','forceStepHidden','data-keep-ratio','data-percent','data-resize-more'],
    cssTokens:['resize-workspace']
  },
  {
    name:'Crop & Rotate', html:'image-tools/crop-rotate.html', js:'assets/js/tools/crop-rotate-runtime.js', css:'assets/css/tools/pages/crop-rotate.css',
    htmlTokens:['data-image-tool="crop-rotate"','data-image-input','data-progress-wrap','data-start','data-reset'],
    jsTokens:['engines/crop-rotate.js','Edit Another','Clear All','clearResultView','resetToUpload'],
    cssTokens:['crop-workspace']
  }
];

let failed = 0;
const lines = ['# OrivaStudio v41 — Deep Functional Parity Audit','', '## Scope','The five tools previously rebuilt from v76 behavioral study were audited against their documented parity contracts without rewriting their engines. This audit checks the current isolated HTML, runtime and dedicated CSS for the expected workflow ownership markers and v76-derived behaviors documented during the earlier rebuilds.',''];
for (const tool of tools) {
  const html = read(tool.html), js = read(tool.js), css = read(tool.css);
  const checks = [];
  for (const [kind, text, tokens] of [['HTML',html,tool.htmlTokens],['Runtime',js,tool.jsTokens],['CSS',css,tool.cssTokens]]) {
    for (const token of tokens) {
      const ok = text.includes(token);
      checks.push({kind, token, ok}); if (!ok) failed++;
    }
  }
  const runtimeEntry = read(tool.html).match(/assets\/js\/tools\/runtimes\/[^"']+/)?.[0] || 'MISSING';
  const dedicatedRuntime = !runtimeEntry.includes('tool-runtime.js') && !runtimeEntry.includes('image-tools.js') && !runtimeEntry.includes('pdf-tools.js');
  if (!dedicatedRuntime) failed++;
  lines.push(`## ${tool.name}`, '', `- Dedicated HTML: ${exists(tool.html) ? 'PASS' : 'FAIL'}`);
  lines.push(`- Dedicated runtime entry: ${dedicatedRuntime ? 'PASS' : 'FAIL'} — \`${runtimeEntry}\``);
  lines.push(`- Dedicated CSS file: ${exists(tool.css) ? 'PASS' : 'FAIL'} — \`${tool.css}\``);
  lines.push(`- Contract markers: ${checks.every(c=>c.ok) ? 'PASS' : 'FAIL'}`);
  for (const c of checks.filter(c=>!c.ok)) lines.push(`  - Missing ${c.kind} marker: \`${c.token}\``);
  lines.push('');
}
lines.push('## Result','', failed === 0 ? '**PASS — all 5/5 v76-derived functional parity contracts are structurally present in the current isolated implementations.**' : `**FAIL — ${failed} contract markers are missing.**`, '', '## Important limitation','This is a source-level deep parity audit, not a claim that real browser processing has already passed. File chooser upload, canvas decode/export, PDF parsing, ZIP generation, download capture and popup behavior still require the stable end-to-end browser runner planned after v40.');
fs.writeFileSync(path.join(ROOT,'V41_DEEP_FUNCTIONAL_PARITY_AUDIT_REPORT.md'), lines.join('\n'));
console.log(failed === 0 ? 'PASS 5/5' : `FAIL ${failed}`);
process.exitCode = failed ? 1 : 0;
