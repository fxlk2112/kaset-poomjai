const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function buildDemoState(today = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'})) {
  const stamp = Date.parse(today+'T05:00:00Z');
  if (!Number.isFinite(stamp)) throw new Error('Invalid demo date');
  const day = offset => new Date(stamp + offset*86400000).toISOString().slice(0,10);
  const note = 'ข้อมูลสมมติสำหรับทดลองใช้ระบบ ไม่ใช่ผลทดลองจริงหรือคำแนะนำการใช้ยา';
  const photo = 'https://farmultimate-solutions.pages.dev/images/landing-trial.webp';
  const context = vm.createContext({console,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:()=>null},window:{},setTimeout(){}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/data.js'),'utf8'),context);
  let serial=0;
  context.demoUid=()=>`demo-${today}-${++serial}`;
  vm.runInContext('uid=demoUid;',context);
  const s=vm.runInContext('seed()',context);
  s.role='owner'; s.tourDone=true; s.demoData={version:1,createdDate:today,note};
  s.plots=Array.from({length:3},(_,i)=>({id:'demo-plot-'+(i+1),name:'แปลงตัวอย่าง '+(i+1),sizeRai:[10,8,6][i],lat:14.1+i*0.01,lng:100.1+i*0.01,status:'active',note,crop:['ข้าวโพดหวาน','คะน้า','ข้าวโพดหวาน'][i],waterZones:[{id:'demo-zone-'+i,name:'โซนตัวอย่าง',areaRai:[10,8,6][i],defaultMinutes:20,method:'น้ำหยด',note}]}));
  s.cycles=[];
  s.plots.forEach((p,i)=>{
    s.cycles.push({id:'demo-cycle-old-'+i,plotId:p.id,plant:p.crop,round:1,startDate:day(-130),endDate:day(-65),status:'done',note});
    s.cycles.push({id:'demo-cycle-active-'+i,plotId:p.id,plant:p.crop,round:2,startDate:day(-30+i*3),status:'active',note});
  });
  s.stock=[
    ['เมล็ดพันธุ์ตัวอย่าง','เมล็ดพันธุ์','ถุง','1 กก.',40,220,290],
    ['ปุ๋ยตัวอย่าง A','ปุ๋ยเคมี','กระสอบ','50 กก.',60,650,800],
    ['ผลิตภัณฑ์ทดลอง A','ยากำจัดศัตรูพืช','ขวด','1 ลิตร',30,180,250],
    ['ผลิตภัณฑ์ทดลอง B','ยากำจัดโรคพืช','ขวด','1 ลิตร',20,240,320],
    ['สารเสริมตัวอย่าง','อาหารเสริม','ขวด','500 มล.',8,100,150],
    ['ถุงเก็บผลผลิตตัวอย่าง','วัสดุ','ถุง','1 ชุด',100,10,18],
    ['สินค้าตัวอย่างใกล้หมด','ปุ๋ยอินทรีย์','ถุง','5 กก.',1,60,90],
    ['สินค้าตัวอย่างหมดสต็อก','วัสดุ','กล่อง','1 ชุด',0,50,80]
  ].map(([name,category,unit,size,qty,avgCost,salePrice],i)=>({id:'demo-stock-'+i,code:'DEMO-'+String(i+1).padStart(3,'0'),name,category,unit,size,qty,openQty:i===4?0.5:0,avgCost,salePrice,memberPrice:Math.round(salePrice*0.9),supplier:'ผู้จำหน่ายสมมติ',note,photos:[]}));
  const task=(type,date,status,plotIndex,extra={})=>context.addTask(s,{type,date,status,plotId:s.plots[plotIndex].id,cycleId:'demo-cycle-active-'+plotIndex,title:'[ตัวอย่าง] '+({work:'ดูแลแปลง',inspect:'สำรวจการเจริญเติบโต',water:'บันทึกให้น้ำ',spray:'ใช้ผลิตภัณฑ์ทดลอง',fertilize:'บันทึกใส่ปุ๋ย',expense:'ค่าแรงเตรียมแปลง',harvest:'เก็บเกี่ยวผลผลิต'})[type],note,doneDate:status==='done'?date:'',doneNote:status==='done'?'ตัวอย่างบันทึกงานเสร็จ':'',cost:0,revenue:0,...extra});
  for(let i=0;i<3;i++) {
    task('expense',day(-120),'done',i,{cycleId:'demo-cycle-old-'+i,cost:2000+i*500,costCat:'labor'});
    task('harvest',day(-65),'done',i,{cycleId:'demo-cycle-old-'+i,harvestQty:1500+i*200,harvestUnitPrice:12,revenue:(1500+i*200)*12,cost:700,finishCycle:true,donePhotos:[photo],doneNote:'ภาพประกอบตัวอย่าง ไม่ใช่ภาพผลผลิตจริง'});
    task('expense',day(-28+i*3),'done',i,{cost:1200+i*100,costCat:'labor'});
    task('fertilize',day(-15+i),'done',i,{costItems:[{stockId:'demo-stock-1',name:s.stock[1].name,category:'fertilizer',qty:1.5,unit:'กระสอบ'}]});
    task('spray',day(-8+i),'done',i,{costItems:[{stockId:'demo-stock-2',name:s.stock[2].name,category:'chemical',qty:0.5,unit:'ขวด'},{name:'ค่าแรงตัวอย่าง',category:'labor',qty:1,totalCost:200}]});
    task('inspect',day(-3),'done',i,{donePhotos:i===0?[photo]:[],doneNote:'ข้อมูลและภาพประกอบสำหรับสาธิต'});
    task('water',day(-2),'failed',i,{doneNote:'ตัวอย่างงานไม่สำเร็จ: ฝนตก จึงงดให้น้ำ'});
    task('inspect',day(-1),'planned',i);
    task('water',today,'planned',i);
    task('fertilize',day(3),'planned',i,{costItems:[{stockId:'demo-stock-1',name:s.stock[1].name,category:'fertilizer',qty:1,unit:'กระสอบ'}]});
    task('work',day(7),'planned',i);
  }
  for(let i=0;i<4;i++) context.addSale(s,{date:day(-12+i*3),customer:'ลูกค้าสมมติ '+(i+1),payMethod:i%2?'transfer':'cash',discount:i===2?20:0,note,items:[{stockId:'demo-stock-'+(i%2),name:s.stock[i%2].name,unit:s.stock[i%2].unit,qty:i+1,price:s.stock[i%2].salePrice,priceMode:'sale'}]});
  context.voidSale(s,s.sales[3].id);
  s.equipment=[['ปั๊มน้ำตัวอย่าง','ปั๊มน้ำ',18500,5],['เครื่องพ่นตัวอย่าง','เครื่องพ่น',4500,3],['รถไถตัวอย่าง','รถไถ',280000,10]].map(([name,type,cost,lifespan],i)=>({id:'demo-equipment-'+i,name,type,cost,lifespan,purchaseDate:day(-420-i*90),maintenance:[{id:'demo-maintenance-'+i,date:day(-30+i*3),cost:500+i*300,note:'[ตัวอย่าง] ตรวจเช็กและเปลี่ยนอะไหล่',updatedAt:stamp}],note}));
  s.workers={working:4,resting:1,leave:1,total:6};
  s.water.sources=[{id:'demo-source-1',name:'บ่อน้ำตัวอย่าง',type:'บ่อ',capacityM3:200,levelPct:65},{id:'demo-source-2',name:'ถังน้ำตัวอย่าง',type:'ถัง',capacityM3:20,levelPct:30}];
  s.water.systems=s.plots.map((p,i)=>({id:'demo-water-'+i,plotId:p.id,name:'ระบบน้ำตัวอย่าง '+(i+1),sourceId:i===2?'demo-source-2':'demo-source-1',pumpName:'ปั๊มจำลอง ไม่เชื่อมต่ออุปกรณ์',valveCount:2,state:'off',lastWatered:day(-2),auto:{enabled:false,everyDays:2,time:'06:00',minutes:20},note}));
  s.water.logs=s.water.systems.flatMap((sys,i)=>Array.from({length:4},(_,j)=>({id:'demo-water-log-'+i+'-'+j,systemId:sys.id,date:day(-8+j*2),time:'06:00',minutes:20+i*5,m3:3+i,note:'ข้อมูลตัวอย่าง ไม่มีคำสั่งไปยังอุปกรณ์จริง'})));
  const configs=[
    ['sampling','สุ่มนับ 5 ทรีตเมนต์ / 3 แปลง',5,1,'screening','manual'],
    ['rcbd','บล็อกสุ่ม 3 สูตร / 4 ซ้ำ',3,4,'rcbd','random'],
    ['manual','จัดผังเอง 3 สูตร / 3 ซ้ำ',3,3,'rcbd','manual'],
    ['screening','คัดสูตรเบื้องต้น',3,2,'screening','random'],
    ['demonstration','แปลงสาธิตที่ปิดงานแล้ว',2,1,'demo','manual']
  ];
  s.trials=configs.map(([key,name,count,reps,trialType,layoutMode],trialIndex)=>{
    const id='demo-trial-'+key, sampling=key==='sampling', offset=key==='demonstration'?-30:0;
    const tr={id,name:'[ตัวอย่าง] '+name,plotId:s.plots[trialIndex%3].id,plotName:'',startDate:day(-18+offset),endDate:offset?day(offset):'',status:offset?'done':'active',crop:'ข้าวโพดหวาน',objective:note,note,trialType,layoutMode,design:sampling?'SAMPLING':layoutMode==='manual'?'MANUAL':'RCBD',collectionMode:sampling?'sampling':'replicated',sampleCount:sampling?3:null,replications:reps,createdAt:stamp,updatedAt:stamp};
    tr.metrics=[{id:id+'-count',name:'จำนวนที่นับพบ',unit:'ตัว/จุด',direction:'low'},{id:id+'-height',name:'ความสูง',unit:'ซม.',direction:'high'}];
    tr.treatments=Array.from({length:count},(_,i)=>({id:id+'-t'+i,code:'T'+(i+1),name:i===0?'เปรียบเทียบ / ไม่ใช้ผลิตภัณฑ์':'สูตรสมมติ '+String.fromCharCode(65+i-1),desc:note,ingredients:i===0?[]:Array.from({length:Math.min(i,3)},(_,j)=>({name:'ผลิตภัณฑ์สมมติ '+String.fromCharCode(65+j),rate:''})),timing:'บันทึกทุก 3 วัน (ตัวอย่าง)',photos:i===1?[photo]:[]}));
    tr.units=[];
    for(let block=1;block<=reps;block++) {
      const order=Array.from({length:count},(_,i)=>(i+block-1)%count);
      order.forEach((ti,index)=>{
        const physicalPlot=sampling?'แปลงตัวอย่าง '+(Math.floor(ti/2)+1):'';
        const sectionName=sampling?(ti===4?'ทั้งแปลง':ti%2?'ครึ่งขวา':'ครึ่งซ้าย'):'';
        tr.units.push({id:id+'-b'+block+'-t'+ti,treatmentId:tr.treatments[ti].id,block:sampling?Math.floor(ti/2)+1:block,order:index+1,physicalPlot,sectionName,label:sampling?physicalPlot+' · '+sectionName:'ซ้ำ '+block+' · ตำแหน่ง '+(index+1),areaRai:sampling?(ti===4?6:ti<2?5:4):0.1,note});
      });
    }
    tr.observations=[];
    for(let visit=0;visit<7;visit++) tr.units.forEach(u=>tr.metrics.forEach((metric,mi)=>{
      const ti=tr.treatments.findIndex(t=>t.id===u.treatmentId);
      const base=mi?24+visit*(4+ti*0.2)+u.block:Math.max(0,30-visit*(2+ti*0.35)+u.block);
      const samples=sampling?[Math.round(base-2),Math.round(base),Math.round(base+2)]:null;
      tr.observations.push({id:id+'-obs-'+visit+'-'+u.id+'-'+mi,unitId:u.id,date:day(-18+visit*3+offset),metricId:metric.id,metric:metric.name,unit:metric.unit,value:samples?samples.reduce((a,b)=>a+b,0)/samples.length:Math.round(base*10)/10,...(samples?{samples}:{}),note:note+' · ครั้งที่ '+(visit+1)+'/7',photos:visit===6&&ti===1&&mi===0?[photo]:[],createdAt:stamp,updatedAt:stamp});
    }));
    return tr;
  });
  context.ensureDefaults(s);
  return JSON.parse(JSON.stringify(s));
}

function mergeDemoState(current,demo) {
  const merged=JSON.parse(JSON.stringify(current));
  const copy=JSON.parse(JSON.stringify(demo));
  const append=(target,key,items)=>{
    if(target[key]!==undefined && !Array.isArray(target[key])) throw new Error('Invalid existing collection: '+key);
    const old=target[key] || [];
    if(items.some(item=>old.some(x=>x.id===item.id))) throw new Error('Demo IDs already exist: '+key);
    target[key]=old.concat(items);
  };
  let no=(current.sales || []).reduce((max,sale)=>Math.max(max,Number(sale.no)||0),Number(current.saleSequence)||0);
  copy.sales.forEach(sale=>sale.no=++no);
  for(const key of ['plots','cycles','tasks','stock','sales','equipment','trials']) append(merged,key,copy[key]);
  merged.saleSequence=no;
  merged.water=merged.water || {};
  for(const key of ['sources','systems','logs']) append(merged.water,key,copy.water[key]);
  merged.demoImports=[...(merged.demoImports || []),{id:'full-demo-'+demo.demoData.createdDate,note:demo.demoData.note,createdDate:demo.demoData.createdDate}];
  return merged;
}

module.exports={buildDemoState,mergeDemoState};
if(require.main===module) process.stdout.write(JSON.stringify(buildDemoState(process.argv[2]),null,2));
