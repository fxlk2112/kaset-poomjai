// Synthetic, loopback-only integration harness. Uses shipped API handlers; no cloud resources.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import worker from '../../worker/src/lark.js';
import {onRequest} from '../../functions/api/[[path]].js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=fileURLToPath(new URL('.private/runtime/',import.meta.url));
await mkdir(runtime,{recursive:true});
const db=new DatabaseSync(path.join(runtime,'state.sqlite'));
db.exec(await readFile(path.join(root,'worker/schema.sql'),'utf8'));
db.exec('CREATE TABLE IF NOT EXISTS qa_photos (key TEXT PRIMARY KEY, body BLOB, mime TEXT)');
const owner='status-acceptance-qa',email='status-acceptance-qa@example.invalid',token=randomUUID();
db.prepare('INSERT OR IGNORE INTO users (id,email,pass_hash,name,created_at) VALUES (?,?,?,?,?)').run(owner,email,'unused-synthetic','QA มือถือ PDF สลิป สต็อก',1);
db.prepare('DELETE FROM sessions WHERE user_id=?').run(owner);
db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token,owner,Date.now()+86400000);
const fixture=JSON.parse(await readFile(path.join(runtime,'seed.json'),'utf8'));
db.prepare('INSERT OR IGNORE INTO user_data VALUES (?,?,?)').run(owner,JSON.stringify(fixture),Date.now());
const env={DB:{prepare(sql){const statement=db.prepare(sql);let bindings={};return {
  bind(...values){bindings=Object.fromEntries(values.map((v,i)=>['?'+(i+1),v]));return this;},
  async first(){return statement.get(bindings)||null;},async all(){return {results:statement.all(bindings)};},
  async run(){return {meta:{changes:Number(statement.run(bindings).changes)}};}
};}},PHOTOS:{
  async put(key,body,options){db.prepare('INSERT OR REPLACE INTO qa_photos VALUES (?,?,?)').run(key,new Uint8Array(body),options.httpMetadata.contentType);},
  async get(key){const r=db.prepare('SELECT body,mime FROM qa_photos WHERE key=?').get(key);return r?{body:r.body,arrayBuffer:async()=>r.body.buffer.slice(r.body.byteOffset,r.body.byteOffset+r.body.byteLength),httpMetadata:{contentType:r.mime}}:null;},
  async delete(key){db.prepare('DELETE FROM qa_photos WHERE key=?').run(key);}
}};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp'};
const allowedActions=new Set(['load','save','me','photo_put','photo_delete','google_config','sale_slip_put','sale_slip_get']);
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4195');
    if(url.pathname.startsWith('/api')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      const action=body.length?JSON.parse(body.toString()).action:'';
      if(req.method==='POST'&&!allowedActions.has(action)){res.writeHead(403);res.end('LOCAL_TEST_ACTION_DISABLED');return;}
      if(req.method!=='POST'&&!url.pathname.startsWith('/api/photo/')){res.writeHead(403);res.end();return;}
      const response=await onRequest({request:new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )}),env:{FARMULTIMATE_API:{fetch:r=>worker.fetch(r,env)}}});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
      console.log('API',action||'photo',response.status);return;
    }
    if(req.method!=='GET'){res.writeHead(405);res.end();return;}
    if(url.pathname==='/__qa-bootstrap.js'){
      res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'});
      res.end(`window.FARMULTIMATE_PUBLIC_API_URL=location.origin+'/api';localStorage.setItem('farmult-session-v1',${JSON.stringify(JSON.stringify({email,token,name:'QA มือถือ PDF สลิป สต็อก'}))});`);return;
    }
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html',file=path.resolve(root,rel);
    if(!file.startsWith(root)||! /^(index\.html|guide\.html|manifest\.json|sw\.js|(?:css|js|images|icons|assets)\/[^.][\s\S]*)$/.test(rel)||rel.split('/').some(x=>x.startsWith('.')))throw Error('not served');
    let data=await readFile(file);
    if(rel==='index.html')data=Buffer.from(data.toString().replace('<head>','<head><script src="/__qa-bootstrap.js"></script>').replace('</body>',`<script>document.addEventListener('DOMContentLoaded',()=>{route.view='projects';render();const el=document.createElement('small');el.textContent='ทดสอบ API ในเครื่อง · ข้อมูลตัวอย่าง';el.style.cssText='position:fixed;bottom:0;left:0;z-index:9999;background:#e5f4ec;color:#174c3b;padding:4px;pointer-events:none';document.body.append(el);});</script></body>`));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch(error){console.error('QA request failed:',error.name);res.writeHead(500);res.end('LOCAL_TEST_ERROR');}
}).listen(4195,'127.0.0.1',()=>console.log('Synthetic backend QA: http://127.0.0.1:4195/'));
