const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 4180);
const today = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'});
const day = offset => { const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10); };
let revision = 1000;
let simulateOffline = false;
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
  stock:[{id:'stock-a',name:'ปุ๋ยสูตร 15-15-15',category:'ปุ๋ย',unit:'กระสอบ',qty:10,openQty:0,avgCost:750,salePrice:900,size:'50 กก.'},
    {id:'stock-b',name:'เมล็ดพันธุ์ข้าวโพดหวานพิเศษสำหรับปลูกแปลงทดลอง',category:'เมล็ดพันธุ์',unit:'ถุง',qty:3,openQty:0.5,avgCost:250,salePrice:320},
    {id:'stock-c',name:'วัสดุคลุมดิน',category:'วัสดุ',unit:'ม้วน',qty:0,openQty:0,avgCost:500}],
  sales:[],equipment:[{id:'equipment-a',name:'เครื่องสูบน้ำแปลง A',type:'ปั๊มน้ำ',cost:18500,purchaseDate:'2025-01-15',lifespan:5,maintenance:[]}],
  water:{sources:[{id:'water-source',name:'บ่อเก็บน้ำหลัก',type:'บ่อ',capacityM3:120,levelPct:65}],systems:[{id:'water-system',plotId:'plot-a',name:'ระบบน้ำหยดข้าวโพดหวานแปลง A',sourceId:'water-source',pumpName:'ปั๊มหลัก',valveCount:2,state:'off',lastWatered:day(-2),auto:{enabled:false}}],logs:[]},
  trials:[{id:'trial-a',plotId:'plot-a',name:'เปรียบเทียบปุ๋ยในข้าวโพดหวาน',trialType:'screening',status:'active',startDate:day(-12),design:'RCBD',reps:2,metrics:[{id:'height',name:'ความสูง',unit:'ซม.',direction:'high'}],treatments:[{id:'t1',code:'T1',name:'สูตรเดิม'},{id:'t2',code:'T2',name:'สูตรทดลอง'}],units:[{id:'u1',treatmentId:'t1',rep:1,areaRai:0.5},{id:'u2',treatmentId:'t2',rep:1,areaRai:0.5},{id:'u3',treatmentId:'t1',rep:2,areaRai:0.5},{id:'u4',treatmentId:'t2',rep:2,areaRai:0.5}],observations:[]}],
  workers:[],texts:{},notifDismissed:{}
};
if (process.argv.includes('--trials')) {
  const tr=state.trials[0];
  tr.name='เปรียบเทียบการดูแลข้าวโพดหวาน (ข้อมูลตัวอย่าง)';
  tr.startDate=day(-45);tr.crop='ข้าวโพดหวาน';tr.replications=3;
  tr.objective='ติดตามความสูงและจำนวนใบของแต่ละสูตรตลอดช่วงทดลอง';
  tr.metrics.push({id:'leaves',name:'จำนวนใบ',unit:'ใบ'});
  tr.treatments.push({id:'t3',code:'T3',name:'สูตรทดลอง + ปรับการให้น้ำ'});
  tr.units=[];
  for(let block=1;block<=3;block++) tr.treatments.forEach((t,i)=>tr.units.push({id:'unit-'+block+'-'+i,treatmentId:t.id,block,order:i+1,areaRai:0.25}));
  for(let d=0;d<16;d++) tr.units.forEach((u,i)=>tr.metrics.forEach((m,mi)=>{
    if(d===7 && u.treatmentId==='t3' || d===15 && u.id==='unit-3-1') return;
    tr.observations.push({id:'sample-'+d+'-'+i+'-'+mi,unitId:u.id,date:day(-45+d*3),metricId:m.id,metric:m.name,unit:m.unit,value:mi ? Math.round(3+d*.4+i%3*.3) : Math.round(22+d*(5+i%3*.6)+u.block*1.5),note:d===10 && i===0 && mi===0 ? 'ข้อมูลสาธิตสำหรับตรวจหน้าทดลอง ไม่ใช่ผลทดลองจริง' : '',photos:d===10 && i===0 && mi===0 ? ['http://127.0.0.1:'+port+'/images/landing-trial.webp'] : [],createdAt:1000,updatedAt:1000});
  }));
}
if(process.argv.includes('--demo')) state=require('./demo-state.cjs').buildDemoState(today);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const send=(res,code,type,body)=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/__preview/scenario'&&req.method==='POST'){
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000)return send(res,413,types['.json'],'{}');}
      const scenario=JSON.parse(raw);
      if(scenario.mode==='offline')simulateOffline=true;
      if(scenario.mode==='online')simulateOffline=false;
      if(scenario.mode==='conflict'){
        state.tasks.push({id:'remote-'+(++revision),title:'กิจกรรมจากอีกเครื่อง (ทดสอบ)',type:'inspect',date:today,status:'planned',plotId:'plot-a',cycleId:'cycle-a'});
      }
      return send(res,200,types['.json'],JSON.stringify({ok:true,revision,simulateOffline}));
    }
    if(simulateOffline)return send(res,503,types['.json'],JSON.stringify({ok:false,error:'Preview simulated offline'}));
    if(url.pathname==='/__preview/bootstrap.js'){
      const session={email:'preview@example.invalid',name:'ฟาร์มตัวอย่าง',token:'preview-only'};
      const bootstrap=`if(!localStorage.getItem('farm-preview-interior-v1')){localStorage.setItem('farm-preview-interior-v1','1');localStorage.setItem('kaset-poomjai-v51::preview@example.invalid',${JSON.stringify(JSON.stringify(state))});localStorage.setItem('farmult-cloud-ts-v1::preview@example.invalid','1000');}localStorage.setItem('farmult-session-v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('farmult-data-owner','preview@example.invalid');if(!localStorage.getItem('farmult-theme'))localStorage.setItem('farmult-theme','dark');`;
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
      if(p.action==='market_prices')data=(await import('../worker/src/market-data.js')).MARKET_DATA;
      if(p.action==='market_price_history')data={product:p.product,history:{},markets:[]};
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
