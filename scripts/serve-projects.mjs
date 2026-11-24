import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {buildDemoState}=require('../tools/demo-state.cjs');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:4178');
    if(req.method!=='GET' || url.pathname.startsWith('/api')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'LOCAL_PREVIEW_ONLY'}));return;}
    if(url.pathname==='/__project_demo.js'){
      const demo=buildDemoState('2026-11-24');
      demo.plots.forEach(p=>{p.lat='';p.lng='';});
      res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});
      res.end(`if(new URL(location.href).searchParams.get('projectPreview')==='1'){const k='kaset-poomjai-v51::sensor-preview@local.invalid';if(!localStorage.getItem(k))localStorage.setItem(k,${JSON.stringify(JSON.stringify(demo))});}`);return;
    }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep) || !/^(index\.html|guide\.html|manifest\.json|sw\.js|collector\.html|(?:css|js|images|icons|assets)\/[^.][\s\S]*)$/.test(rel) || rel.split('/').some(x=>x.startsWith('.')) || /package\.json$/.test(rel))throw new Error('not served');
    if(!(await stat(file)).isFile())throw new Error('not file');
    let data=await readFile(file);
    if(rel==='index.html' && url.searchParams.get('projectPreview')==='1'){
      let html=data.toString().replace('  <script src="js/auth.js','  <script src="/__project_demo.js"></script>\n  <script src="js/auth.js');
      html=html.replace('</body>',`<script>document.addEventListener('DOMContentLoaded',()=>{Auth.session.name='บัญชีตัวอย่าง';route.view='projects';render();const banner=document.createElement('div');banner.textContent='รุ่นทดลองในเครื่อง • ข้อมูลตัวอย่าง • ไม่เชื่อมข้อมูลจริง';banner.style.cssText='position:fixed;bottom:4px;left:4px;z-index:9999;background:#e8f4ee;color:#14624d;font:11px Sarabun,sans-serif;padding:4px 8px;border:1px solid #bad7ca;border-radius:4px;pointer-events:none';document.body.append(banner);});</script></body>`);
      data=Buffer.from(html);
    }
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(_){res.writeHead(404);res.end('Not found');}
}).listen(4178,'127.0.0.1',()=>console.log('Project preview http://127.0.0.1:4178/?projectPreview=1'));
