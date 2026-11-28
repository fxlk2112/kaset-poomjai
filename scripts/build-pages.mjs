import {mkdir, readdir, readFile, writeFile, copyFile, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildPages(output) {
  const out = path.resolve(output);
  if (out === path.resolve(root) || path.resolve(root).startsWith(out + path.sep)) throw Error('Output must be a new staging directory');
  // Never reuse/delete a directory that could contain another release or user work.
  await mkdir(out, {recursive:false});
  const tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0'));
  async function copy(relative) {
    const source = path.join(root, relative), target = path.join(out, relative), info = await lstat(source);
    if (info.isSymbolicLink()) throw Error('Symlinks are not release assets: ' + relative);
    if (info.isDirectory()) {
      await mkdir(target, {recursive:true});
      for (const item of await readdir(source)) if (!item.startsWith('.') && item !== 'tests') await copy(path.join(relative,item));
    } else if(tracked.has(relative.split(path.sep).join('/'))) { await mkdir(path.dirname(target), {recursive:true}); await copyFile(source,target); }
  }
  for (const relative of ['index.html','collector.html','guide.html','sw.js','manifest.json','logo.jpg','css','js','icons','images','data/weather-models.json']) await copy(relative);
  try { await copy('_redirects'); } catch(error) { if(error.code!=='ENOENT')throw error; }
  const proxy = await readFile(path.join(root,'functions/api/[[path]].js'),'utf8');
  if (/^import\s/m.test(proxy) || !proxy.includes('export async function onRequest(context)')) throw Error('Update the Pages assembler for the changed proxy contract');
  const worker = proxy.replace('export async function onRequest(context)', 'async function onRequest(context)') + `\nexport default {async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api' || pathname.startsWith('/api/')) return onRequest({request, env});
    return env.ASSETS.fetch(request);
  }};\n`;
  await writeFile(path.join(out,'_worker.js'),worker);
  await writeFile(path.join(out,'_routes.json'),JSON.stringify({version:1,include:['/api','/api/*'],exclude:[]}));
  await verifyPages(out);
  return out;
}

export async function verifyPages(out) {
  const html = await readFile(path.join(out,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g)) {
    const relative=match[1];
    if(/^(?:https?:|data:|\/\/)/.test(relative) || !/\.(js|css|png|jpg|svg|ico|json)$/.test(relative))continue;
    const file=path.resolve(out,relative.replace(/^\//,''));
    if(!file.startsWith(path.resolve(out)+path.sep))throw Error('Asset escapes staging');
    await lstat(file);
  }
  const {default:worker}=await import(pathToFileURL(path.join(out,'_worker.js')).href);
  const request=new Request('https://farm.example.invalid/api',{method:'POST',body:JSON.stringify({action:'health'})});
  const unavailable=await worker.fetch(request,{});
  if(unavailable.status!==503 || (await unavailable.json()).error!=='API_SERVICE_UNAVAILABLE')throw Error('Missing binding did not fail closed');
  let forwarded=false;
  const response=await worker.fetch(request,{FARMULTIMATE_API:{fetch:async r=>{forwarded=r===request;return Response.json({ok:true});}}});
  if(!forwarded || !(await response.json()).ok)throw Error('API forwarding failed');
  const asset=await worker.fetch(new Request('https://farm.example.invalid/'),{ASSETS:{fetch:async()=>new Response('asset')}});
  if(await asset.text()!=='asset')throw Error('Static asset fallback failed');
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const output=process.argv[process.argv.indexOf('--out')+1];
  if(!process.argv.includes('--out') || !output)throw Error('Usage: node scripts/build-pages.mjs --out NEW_DIRECTORY');
  console.log('Validated Pages artifact: '+await buildPages(output));
}
