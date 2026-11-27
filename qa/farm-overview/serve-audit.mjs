// Isolated synthetic origin; existing preview data stays untouched. GET-only, loopback-only.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {removeSampleTimes}=createRequire(import.meta.url)('./remove-sample-times.cjs');
const cleanup=`const cleanupKey='farm-overview-sample-times-removed-v1';if(!localStorage.getItem(cleanupKey)){const state=JSON.parse(localStorage.getItem(k));(${removeSampleTimes.toString()})(state);localStorage.setItem(k,JSON.stringify(state));localStorage.setItem(cleanupKey,'1');}`;
const previewUrl=new URL('../../scripts/serve-projects.mjs',import.meta.url);
const port=process.argv[2]||'4185';
if(!/^418[345]$/.test(port))throw new Error('Use isolated QA ports 4183, 4184 or 4185');
const source=(await readFile(previewUrl,'utf8'))
  .replaceAll('import.meta.url',JSON.stringify(previewUrl.href))
  .replace("const {buildDemoState}=require('../tools/demo-state.cjs');","const {buildOverviewDemo:buildDemoState}=require('../qa/farm-overview/fixture.cjs');")
  .replace('if(!localStorage.getItem(k))localStorage.setItem(k,${JSON.stringify(JSON.stringify(demo))});}', 'if(!localStorage.getItem(k))localStorage.setItem(k,${JSON.stringify(JSON.stringify(demo))});'+cleanup+'}')
  .replaceAll('4178',port)
  .replace("else route.view='projects';render();","else route.view='home';render();")
  .replace('document.body.append(banner);','') // The app already labels synthetic data; keep mobile navigation unobstructed.
  .replace('Project preview','Farm overview QA');
await import('data:text/javascript,'+encodeURIComponent(source));
