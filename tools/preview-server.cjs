const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 4180);
const today = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'});
const day = offset => { const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10); };
let revision = 1000;
let state = {
  version:54,role:'owner',tourDone:true,
  plots:[{id:'plot-a',name:'แปลง A',sizeRai:12,status:'active',lat:14.1,lng:100.1},{id:'plot-b',name:'แปลง B',sizeRai:8,status:'active',lat:14.1,lng:100.1}],
  cycles:[{id:'cycle-a',plotId:'plot-a',plant:'ข้าวโพดหวาน 72',round:1,startDate:day(-18),status:'active'},
    {id:'cycle-b',plotId:'plot-a',plant:'ข้าวโพดทดลองแปลงย่อย',round:2,startDate:day(-12),status:'active'},
    {id:'cycle-c',plotId:'plot-b',plant:'ข้าวโพดเลี้ยงสัตว์',round:1,startDate:day(-130),status:'done'}],
  tasks:[
    {id:'task-overdue',title:'ใส่ปุ๋ยครั้งที่ 1',type:'fertilize',date:day(-2),plotId:'plot-a',cycleId:'cycle-a',status:'planned',note:'ตรวจความชื้นดินก่อนใส่ปุ๋ย',cost:0,revenue:0},
    {id:'task-overdue-2',title:'ตรวจแปลงและบันทึกการเจริญเติบโต',type:'inspect',date:day(-1),plotId:'plot-a',cycleId:'cycle-b',status:'planned',cost:0,revenue:0},
    {id:'task-today',title:'รดน้ำช่วงเช้า',type:'water',date:today,plotId:'plot-a',cycleId:'cycle-a',status:'planned',cost:0,revenue:0},
    {id:'task-next',title:'ตรวจระบบน้ำและความชื้นดิน',type:'inspect',date:day(3),plotId:'plot-a',cycleId:'cycle-a',status:'planned',cost:0,revenue:0},
    {id:'task-cost',title:'เตรียมแปลงและค่าแรง',type:'expense',date:day(-10),plotId:'plot-a',cycleId:'cycle-a',status:'done',cost:1500,costCat:'labor',revenue:0},
    {id:'task-harvest',title:'เก็บเกี่ยวรอบก่อน',type:'harvest',date:day(-20),plotId:'plot-b',cycleId:'cycle-c',status:'done',cost:4000,revenue:18000}],
  stock:[{id:'stock-a',name:'ปุ๋ยสูตร 15-15-15',category:'fertilizer',unit:'กระสอบ',qty:10,openQty:0,avgCost:750,size:'50 กก.'}],
  sales:[],equipment:[],workers:[],texts:{},notifDismissed:{}
};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const send=(res,code,type,body)=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__preview/bootstrap.js'){
      const session={email:'preview@example.invalid',name:'ฟาร์มตัวอย่าง',token:'preview-only'};
      const bootstrap=`if(!localStorage.getItem('farm-preview-interior-v1')){localStorage.setItem('farm-preview-interior-v1','1');localStorage.setItem('kaset-poomjai-v51::preview@example.invalid',${JSON.stringify(JSON.stringify(state))});localStorage.setItem('farmult-cloud-ts-v1::preview@example.invalid','1000');}localStorage.setItem('farmult-session-v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('farmult-data-owner','preview@example.invalid');localStorage.setItem('farmult-theme','dark');`;
      return send(res,200,types['.js'],bootstrap);
    }
    if(url.pathname==='/__preview/api'&&req.method==='POST'){
      let body='';for await(const chunk of req){body+=chunk;if(body.length>1000000)return send(res,413,types['.json'],'{}');}
      const p=JSON.parse(body);let data={};
      if(p.action==='load')data={data:state,updated_at:revision};
      if(p.action==='save'){
        if(p.base_updated_at!==revision)data={conflict:true};
        else{state=JSON.parse(p.data);revision++;data={updated_at:revision};}
      }
      if(p.action==='me')data={email:'preview@example.invalid',name:'ฟาร์มตัวอย่าง',admin:false};
      return send(res,200,types['.json'],JSON.stringify({ok:true,data}));
    }
    const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
    const file=path.resolve(root,'.'+relative);
    if(!file.startsWith(root+path.sep)||relative.split('/').some(part=>part.startsWith('.')||['worker','tests','tools'].includes(part)))return send(res,403,'text/plain','Forbidden');
    let bytes=await fs.promises.readFile(file);
    if(relative==='/index.html')bytes=Buffer.from(bytes.toString().replace('<head>','<head>\n<script src="/__preview/bootstrap.js"></script>'));
    if(relative==='/js/auth.js')bytes=Buffer.from(bytes.toString().replace('"https://farmbackup.carfork123.workers.dev"','"/__preview/api"'));
    send(res,200,types[path.extname(file)]||'application/octet-stream',bytes);
  }catch(error){send(res,404,'text/plain','Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Preview with isolated sample data: http://127.0.0.1:${port}/`));
