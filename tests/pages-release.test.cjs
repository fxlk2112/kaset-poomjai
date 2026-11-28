const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');

test('release artifact contains real API proxy, routes and public assets; no internal directories',async t=>{
  const parent=await fs.mkdtemp(path.join(os.tmpdir(),'farm-pages-contract-'));
  t.after(async()=>{assert.ok(path.resolve(parent).startsWith(path.resolve(os.tmpdir())+path.sep+'farm-pages-contract-'));await fs.rm(parent,{recursive:true});});
  const {buildPages,verifyPages}=await import('../scripts/build-pages.mjs');
  const out=await buildPages(path.join(parent,'site'));
  for(const file of ['guide.html','index.html','_worker.js','_routes.json','js/auth.js','data/weather-models.json'])assert.ok((await fs.stat(path.join(out,file))).isFile(),file);
  for(const file of ['worker','qa','.git','tests','node_modules','data/private'])await assert.rejects(fs.stat(path.join(out,file)));
  await verifyPages(out);
  const routes=JSON.parse(await fs.readFile(path.join(out,'_routes.json'),'utf8'));
  assert.deepEqual(routes.include,['/api','/api/*']);
  const {default:proxy}=await import(pathToFileURL(path.join(out,'_worker.js')));
  const {default:backend}=await import('../worker/src/lark.js');
  const request=new Request('https://farm.example.invalid/api',{method:'POST',body:JSON.stringify({action:'health'})});
  const result=await(await proxy.fetch(request,{FARMULTIMATE_API:{fetch:r=>backend.fetch(r,{PHOTOS:{}})}})).json();
  assert.equal(result.ok,true);assert.equal(result.data.output_control_allowed,false);assert.ok(result.data.capabilities.includes('project_files_v1'));
  await assert.rejects(buildPages(out),/EEXIST/,'existing output is never deleted or overwritten');
});
