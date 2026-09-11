/* Remote owner overview. Existing read endpoints only; no persistent measurements or controls. */
(function (root) {
  "use strict";
  const state = { water:null, monitor:null, waterError:"", monitorError:"", loading:false, loadedAt:0, loginRequired:false };
  let account="", generation=0;
  const finite=v=>typeof v==="number"&&Number.isFinite(v);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num=(v,p=1)=>finite(v)?v.toLocaleString("th-TH",{maximumFractionDigits:p}):"—";
  const stamp=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}):"ยังไม่มีเวลาที่วัด";
  function sync() {
    const next=typeof Auth!=="undefined"&&Auth.session?.token||"";
    if(next!==account){account=next;generation++;Object.assign(state,{water:null,monitor:null,waterError:"",monitorError:"",loading:false,loadedAt:0,loginRequired:false});}
    return next;
  }
  function freshness(row,status,now=Date.now()) {
    const time=Date.parse(row?.observed_at);
    if(!row)return "NO_DATA";
    if(!Number.isFinite(time)||time>now+120000)return "INVALID_TIME";
    if(now-time>180000)return "STALE";
    return status||row.quality||"NO_DATA";
  }
  const labels={GOOD:"ข้อมูลล่าสุด",UNVERIFIED:"ล่าสุด · รอตรวจรับ",STALE:"ข้อมูลเก่า",NO_DATA:"ยังไม่มีข้อมูล",INVALID_TIME:"ตรวจสอบเวลาข้อมูล",SENSOR_FAULT:"อ่านค่าไม่สำเร็จ",DISCONNECTED:"ขาดการติดต่อ",DEGRADED:"ข้อมูลไม่ครบ",OUT_OF_RANGE:"ค่านอกช่วง"};
  const badge=status=>`<span class="os-badge ${status==='GOOD'?'os-good':'os-warn'}">${esc(labels[status]||"ยังตรวจสอบไม่ได้")}</span>`;
  function dayEnergy(source,now=Date.now()) {
    // Bangkok has a fixed UTC+7 offset. Never count yesterday or extrapolate to midnight.
    const dayStart=Math.floor((now+25200000)/86400000)*86400000-25200000;
    const raw=source?.windows?.[24]?.points||source?.history||[];
    const rows=[...raw,source?.current].filter(r=>r&&Date.parse(r.observed_at)>=dayStart&&Date.parse(r.observed_at)<=now).sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
    const points=rows.filter((r,i)=>!i||r.observed_at!==rows[i-1].observed_at);
    const values=points.map(r=>['GOOD','UNVERIFIED'].includes(r.quality)?(r.observation_only||r.quality==='UNVERIFIED'?r.observation?.import_energy_total_kwh:r.import_energy_total_kwh):null);
    const reset=values.some((v,i)=>finite(v)&&i>0&&finite(values[i-1])&&v<values[i-1]);
    const invalid=values.some(v=>!finite(v));
    const gaps=points.some((r,i)=>i>0&&Date.parse(r.observed_at)-Date.parse(points[i-1].observed_at)>Math.max(1800,(source?.windows?.[24]?.bucket_seconds||900)*2)*1000);
    return {delta:points.length>=2&&!invalid&&!reset?values.at(-1)-values[0]:null,count:points.length,first:points[0]?.observed_at,last:points.at(-1)?.observed_at,reset,invalid,gaps};
  }
  async function request(path,body) {
    const response=await fetch(root.FarmUltimateRuntime.apiUrl+path,{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000),body:JSON.stringify(body)});
    const result=await response.json();
    if(response.status===401||response.status===403||/ยังไม่ได้ล็อกอิน|เซสชันหมดอายุ/.test(result.error||""))throw Error("AUTH");
    if(!response.ok||!result.ok||result.data?.output_control_allowed!==false)throw Error("READ_FAILED");
    return result.data;
  }
  async function refresh(force=false) {
    const token=sync();
    if(!token){draw();return;}
    if(state.loading||(!force&&Date.now()-state.loadedAt<60000))return;
    const epoch=++generation;state.loading=true;draw();
    const results=await Promise.allSettled([
      request("",{action:"sensor_current",token,source_id:root.SensorTelemetry.SOURCE_ID}),
      request("/monitor/read",{token,hours:24})
    ]);
    if(sync()!==token||epoch!==generation)return;
    state.loginRequired=results.some(r=>r.status==='rejected'&&r.reason?.message==='AUTH');
    for(const [index,key] of ['water','monitor'].entries()) {
      const result=results[index];state[key]=null;state[key+'Error']='';
      if(result.status==='fulfilled') {
        try {
          if(key==='water')state.water=root.SensorTelemetry.normalizeCurrentResponse(result.value);
          else {
            if(result.value.energy?.output_control_allowed!==false||result.value.energy?.modbus_write_allowed!==false||!Array.isArray(result.value.energy?.sources))throw Error('READ_FAILED');
            state.monitor={sources:root.SensorTelemetry.normalizePiHealthResponse(result.value),energy:result.value.energy};
          }
        }catch{state[key+'Error']='ข้อมูลตอบกลับไม่ครบ กรุณาลองใหม่';}
      }else state[key+'Error']=result.reason?.message==='AUTH'?'กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของอีกครั้ง':'เชื่อมต่อข้อมูลไม่ได้ กรุณาลองใหม่';
    }
    if(state.loginRequired){state.water=null;state.monitor=null;}
    state.loading=false;state.loadedAt=Date.now();draw();
  }
  function bodyHtml(now=Date.now()) {
    const token=sync(), water=state.water, current=water?.current;
    const ws=freshness(current,water?.status,now), waterGood=ws==='GOOD'&&(!current?.quality||current.quality==='GOOD');
    const sources=state.monitor?.energy?.sources||[], health=state.monitor?.sources||{};
    const nodes=[['PI5_CONTROLLER_01','Pi 5','ตัวกลางข้อมูลฟาร์ม'],['PI_ZERO_GATEWAY_01','Pi Zero','รับข้อมูลเซนเซอร์']];
    const statuses=nodes.map(([id])=>freshness(health[id]?.current,health[id]?.status,now));
    const issues=[];
    if(token&&!state.loading&&!state.loginRequired){
      if(state.waterError)issues.push('น้ำ: '+state.waterError);else if(ws!=='GOOD')issues.push('น้ำ: '+(labels[ws]||'ยังตรวจสอบไม่ได้'));
      if(state.monitorError)issues.push('สุขภาพและพลังงาน: '+state.monitorError);
      else {nodes.forEach(([,name],i)=>{if(statuses[i]!=='GOOD')issues.push(name+': '+(labels[statuses[i]]||'ยังตรวจสอบไม่ได้'));});
        if(!sources.length)issues.push('พลังงาน: ยังไม่มีข้อมูลมิเตอร์');
        sources.forEach((s,i)=>{const status=freshness(s.current,s.status,now);if(!['GOOD','UNVERIFIED'].includes(status))issues.push('มิเตอร์ '+(i+1)+': '+(labels[status]||'ยังตรวจสอบไม่ได้'));});}
    }
    const allFresh=token&&!state.loading&&!state.loginRequired&&!issues.length&&waterGood&&sources.length>0;
    return `<div class="os-overview"><div><span class="os-eyebrow">REMOTE FARM OVERVIEW</span><h2>${!token||state.loginRequired?'เข้าสู่ระบบเพื่อดูฟาร์ม':state.loading?'กำลังตรวจข้อมูลล่าสุด':allFresh?'ข้อมูลทุกส่วนส่งถึงแล้ว':'มีข้อมูลที่ต้องตรวจสอบ'}</h2><p>${allFresh?'ตรวจเวลาแยกตามแหล่งข้อมูล · มิเตอร์ยังต้องตรวจรับที่หน้างาน':'น้ำ พลังงาน และสุขภาพอุปกรณ์ในหน้าเดียว'}</p></div><span class="os-transport">${root.FarmUltimateRuntime?.isLan?'LAN · ในฟาร์ม':'CLOUD · ดูจากระยะไกล'}</span></div>
      ${!token||state.loginRequired?`<div class="os-message"><p>ใช้บัญชีเจ้าของเดียวกับหน้าเซนเซอร์ ข้อมูลจะแสดงหลังเข้าสู่ระบบ</p><button onclick="App.openSensorLogin()">เข้าสู่ระบบ</button></div>`:''}
      ${issues.length?`<div class="os-alert" role="status"><strong>รายการที่ต้องดูตอนนี้ · ${issues.length}</strong><ul>${issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>ข้อมูลเก่าหรืออ่านไม่ได้ยังไม่ใช่หลักฐานว่าอุปกรณ์ดับ</p></div>`:''}
      <div class="os-grid"><section class="os-card os-water"><div class="os-card-title"><h2>น้ำในบ่อ</h2>${badge(ws)}</div><span class="os-label">ระดับความจุตามแบบจำลอง</span><div class="os-number">${num(waterGood?current?.capacity_percent:null)}<small>%</small></div><div class="os-water-track" aria-hidden="true"><i style="width:${waterGood&&finite(current?.capacity_percent)?Math.max(0,Math.min(100,current.capacity_percent)):0}%"></i></div><dl class="os-metrics"><div><dt>ปริมาตรประมาณ</dt><dd>${num(waterGood?current?.volume_m3:null)} ม³</dd></div><div><dt>ความลึก</dt><dd>${num(waterGood?current?.depth_m:null,2)} ม.</dd></div></dl><p>วัดเมื่อ ${esc(stamp(current?.observed_at))}</p><p class="os-note">ปริมาตรและความจุยังรอสอบเทียบรูปทรงบ่อ</p><button class="os-link" onclick="App.farmMapSelect('pond')">ดูรายละเอียดบ่อ →</button></section>
      <section class="os-card os-energy"><div class="os-card-title"><h2>พลังงานวันนี้</h2><span class="os-badge os-warn">รอตรวจรับมิเตอร์</span></div><p class="os-note">วันนี้ตามเวลาไทย · ผลต่างตัวนับเฉพาะช่วงที่วัดได้ ไม่ใช่ยอดเต็มวันหรือค่าไฟ</p>${sources.length?sources.map((source,i)=>energyHtml(source,i,now)).join(''):'<div class="os-number">—<small>kWh</small></div><p>ยังไม่มีข้อมูลที่ใช้สรุปได้</p>'}<button class="os-link" onclick="App.farmMapSelect('energy')">ดูกราฟพลังงาน →</button></section></div>
      <section class="os-card"><div class="os-card-title"><h2>สุขภาพอุปกรณ์</h2><span class="os-label">ตรวจจากเวลาที่รายงาน</span></div><div class="os-nodes">${nodes.map(([id,name,role],i)=>{const r=health[id]?.current,good=statuses[i]==='GOOD';return `<article><div class="os-card-title"><div><h3>${name}</h3><p>${role}</p></div>${badge(statuses[i])}</div><dl class="os-metrics"><div><dt>อุณหภูมิเครื่อง</dt><dd>${num(good?r?.temp_c:null)} °C</dd></div><div><dt>โหลด 1 นาที</dt><dd>${num(good?r?.load1:null,2)}</dd></div></dl><p>รายงานเมื่อ ${esc(stamp(r?.observed_at))}</p></article>`;}).join('')}</div><button class="os-link" onclick="App.farmMapSelect('health')">ดูสุขภาพระบบย้อนหลัง →</button></section>
      <section class="os-card os-checklist"><div><span class="os-eyebrow">NEXT SITE VISIT</span><h2>เตรียมตรวจเมื่อเข้าฟาร์ม</h2><p>รายการเตรียมงาน · ยังไม่ได้ยืนยันว่าตรวจเสร็จ</p></div><ol><li><strong>ยืนยันมิเตอร์และวงจรที่วัด</strong><span>ถ่ายหน้าจอเทียบค่าเว็บ ระบุว่ามิเตอร์วัดวงจรใด ให้ช่างตรวจ CT และการจับคู่เฟส</span></li><li><strong>สอบเทียบระดับและปริมาตรบ่อ</strong><span>เทียบระดับน้ำกับจุดอ้างอิง และเก็บขนาดบ่อจริงก่อนใช้ปริมาตรวางแผน</span></li><li><strong>ทดสอบเข้าเว็บผ่าน Wi-Fi ฟาร์ม</strong><span>ตรวจการเข้าสู่ระบบ LAN และความเชื่อถือใบรับรองบนอุปกรณ์จริง</span></li></ol></section>
      <footer class="os-footer"><span>ตรวจข้อมูลทุก 1 นาทีขณะเปิดหน้านี้ · เวลาไทย<br>ดูข้อมูลเท่านั้น · ระบบชลประทานยัง SAFE_OFF</span><button id="os-refresh" onclick="OwnerSummary.refresh(true)" ${!token||state.loading?'disabled':''}>${state.loading?'กำลังโหลด…':'รีเฟรชข้อมูล'}</button></footer>`;
  }
  function energyHtml(source,index,now) {
    const status=freshness(source.current,source.status,now), live=['GOOD','UNVERIFIED'].includes(status), row=source.current;
    const observation=row?.observation_only||row?.quality==='UNVERIFIED'?row?.observation:row;
    const day=dayEnergy(source,now);
    return `<article class="os-meter"><div class="os-card-title"><h3>มิเตอร์ ${index+1} · รอยืนยันวงจร</h3>${badge(status)}</div><div class="os-number">${num(day.delta,3)}<small>kWh</small></div><p>${day.count>=2?`${esc(stamp(day.first))} ถึง ${esc(stamp(day.last))} · ${day.count} จุด`:'ต้องมีอย่างน้อย 2 จุดของวันนี้จึงคำนวณได้'}</p>${day.reset||day.invalid?'<p class="os-caution">ตัวนับลดลงหรือมีจุดอ่านไม่ได้ จึงยังไม่รวมยอด</p>':''}${day.gaps?'<p class="os-caution">ข้อมูลขาดช่วง · ผลต่างตัวนับไม่บอกการใช้ไฟระหว่างช่วงที่หาย</p>':''}<dl class="os-metrics"><div><dt>กำลังไฟที่รายงาน</dt><dd>${num(live?observation?.active_power_total_kw:null,2)} kW</dd></div></dl><p>วัดเมื่อ ${esc(stamp(row?.observed_at))}</p>${live&&observation?.active_power_total_kw<0?'<p class="os-caution">กำลังไฟติดลบ · ยังไม่สรุปว่าเป็นการส่งไฟคืน</p>':''}</article>`;
  }
  function draw(){if(typeof document==='undefined')return;const panel=document.getElementById('owner-summary-panel');if(panel){const focused=document.activeElement?.id;panel.innerHTML=bodyHtml();if(focused==='os-refresh')document.getElementById(focused)?.focus({preventScroll:true});}}
  function cardHtml(){return `<section class="owner-summary" aria-label="สรุปสำหรับเจ้าของ"><header class="os-header"><button onclick="App.farmMapBack()">← แผนที่ฟาร์ม</button><div><span class="os-eyebrow">FLYTECH · OWNER</span><h1>สรุปสำหรับเจ้าของ</h1></div></header><div id="owner-summary-panel">${bodyHtml()}</div></section>`;}
  root.OwnerSummary={state,sync,refresh,freshness,dayEnergy,cardHtml,bodyHtml};
  if(typeof document!=='undefined'){
    setInterval(()=>{if(!document.hidden&&document.getElementById('owner-summary-panel')){draw();refresh(false);}},15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.getElementById('owner-summary-panel')){draw();refresh(false);}});
  }
})(typeof window!=='undefined'?window:globalThis);
