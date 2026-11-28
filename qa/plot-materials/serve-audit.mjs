// Reuse the allowlisted, loopback-only preview on a separate synthetic-data origin.
import {readFile} from 'node:fs/promises';
const previewUrl = new URL('../../scripts/serve-projects.mjs', import.meta.url);
const source = (await readFile(previewUrl, 'utf8'))
  .replaceAll('import.meta.url', JSON.stringify(previewUrl.href))
  .replace("const {buildDemoState}=require('../tools/demo-state.cjs');", "const {buildMaterialsDemo:buildDemoState}=require('../qa/plot-materials/fixture.cjs');")
  .replaceAll("4178", "4182")
  .replace("else route.view='projects';render();", "else {route.view='plotDetail';route.plotId='demo-plot-1';plotDetailTab='materials';}render();")
  .replace('Project preview', 'Materials QA');
await import('data:text/javascript,' + encodeURIComponent(source));
