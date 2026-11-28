// GET-only loopback preview on a separate origin, preserving all prior preview data.
import {readFile} from 'node:fs/promises';
const previewUrl=new URL('../../scripts/serve-projects.mjs',import.meta.url);
const source=(await readFile(previewUrl,'utf8'))
  .replaceAll('import.meta.url',JSON.stringify(previewUrl.href))
  .replace("const {buildDemoState}=require('../tools/demo-state.cjs');","const {buildProjectDemo:buildDemoState}=require('../qa/project-proposal/fixture.cjs');")
  .replaceAll('4178','4186')
  .replace('document.body.append(banner);','')
  .replace('Project preview','Project workflow QA');
await import('data:text/javascript,'+encodeURIComponent(source));
