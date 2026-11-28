// Isolated GET-only loopback fixture; production API access is disabled.
import {readFile} from 'node:fs/promises';
const previewUrl=new URL('../../scripts/serve-projects.mjs',import.meta.url);
const source=(await readFile(previewUrl,'utf8'))
  .replaceAll('import.meta.url',JSON.stringify(previewUrl.href))
  .replace("const {buildDemoState}=require('../tools/demo-state.cjs');","const {buildRecordKindDemo:buildDemoState}=require('../qa/project-task-record-kind/fixture.cjs');")
  .replaceAll('4178','4187');
await import('data:text/javascript,'+encodeURIComponent(source));
