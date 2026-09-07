import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve('.cloudflare-staging-dist'),target=path.resolve('.lan-dist');
const files=[];
async function copy(dir=''){
  for(const e of await readdir(path.join(source,dir),{withFileTypes:true})){
    const name=path.join(dir,e.name).replaceAll('\\','/');
    if(e.isSymbolicLink())throw Error('SYMLINK_DENIED');
    if(e.isDirectory()){await mkdir(path.join(target,name),{recursive:true});await copy(name);}
    else if(!e.name.startsWith('_')){await copyFile(path.join(source,name),path.join(target,name));files.push(name);}
  }
}
await mkdir(target,{recursive:true});await copy();
let html=await readFile(path.join(target,'index.html'),'utf8');
// Local farm map/canvas charts do not require Leaflet or remote fonts.
html=html.replace(/\s*<link[^>]+href="https:\/\/[^>]+>/g,'').replace(/\s*<script src="https:\/\/[^>]+><\/script>/g,'');
await writeFile(path.join(target,'index.html'),html);
await writeFile(path.join(target,'js/deployment-config.js'),'globalThis.FarmUltimateLocalConfig=Object.freeze({lanMode:true});\n');
const build=JSON.parse(await readFile(path.join(target,'build.json'),'utf8'));build.transport='LAN';
await writeFile(path.join(target,'build.json'),JSON.stringify(build,null,2));
await writeFile(path.join(target,'asset-manifest.json'),JSON.stringify(files.sort(),null,2));
console.log(JSON.stringify({result:'LAN_SITE_BUILT',assets:files.length,external_startup_dependencies:0,release:build.release_commit}));
