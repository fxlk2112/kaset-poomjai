/* Reservoir observations and explicit user scenarios; no network or control. */
(function(root){
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const n=(v,p=2)=>finite(v)?v.toLocaleString('th-TH',{minimumFractionDigits:p,maximumFractionDigits:p}):'—';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
  const scenario={area:null,evaporation:null};
  function analyze(history,now=Date.now(),hours=24){
    const rows=[...new Map((history||[]).filter(r=>Number.isFinite(Date.parse(r.observed_at))&&Date.parse(r.observed_at)<=now&&Date.parse(r.observed_at)>=now-hours*3600000).map(r=>[r.observed_at,r])).values()].sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
    const good=rows.filter(r=>r.quality==='GOOD'&&finite(r.depth_m)&&finite(r.volume_m3));
    if(good.length<2)return {rows,good,count:good.length,total:rows.length,ready:false};
    const first=good[0],last=good.at(-1),span=(Date.parse(last.observed_at)-Date.parse(first.observed_at))/3600000;
    const gaps=good.slice(1).map((r,i)=>(Date.parse(r.observed_at)-Date.parse(good[i].observed_at))/60000);
    const delta=last.volume_m3-first.volume_m3, depth=(last.depth_m-first.depth_m)*100;
    return {rows,good,count:good.length,total:rows.length,ready:span>=.5&&good.length>=3,first:first.observed_at,last:last.observed_at,span,
      delta,depth,rate:span>=.5&&good.length>=3?delta/span:null,depthRate:span>=.5&&good.length>=3?depth/span:null,
      minDepth:Math.min(...good.map(r=>r.depth_m)),maxDepth:Math.max(...good.map(r=>r.depth_m)),maxGap:Math.max(...gaps)};
  }
  function estimate(area,mm){
    return finite(area)&&area>0&&area<=1e8&&finite(mm)&&mm>=0&&mm<=100?{day:area*mm/1000,hour:area*mm/24000,litres:area*mm}:null;
  }
  function calculate(){
    const area=document.getElementById('pond-area'),evap=document.getElementById('pond-evap');
    if(!area||!evap)return;
    scenario.area=area.value.trim()===''?null:Number(area.value);scenario.evaporation=evap.value.trim()===''?null:Number(evap.value);
    const result=estimate(scenario.area,scenario.evaporation),out=document.getElementById('pond-scenario-result');
    out.textContent=result?`ประมาณการจากค่าที่กรอก: ${n(result.day,3)} ลบ.ม./วัน (${n(result.litres,0)} ลิตร/วัน) · ${n(result.hour,3)} ลบ.ม./ชม. ไม่ใช่ค่าที่วัดจากบ่อ`:'กรอกพื้นที่ผิวน้ำมากกว่า 0 และอัตราระเหย 0–100 มม./วันเพื่อคำนวณ';
  }
  function chart(a){
    if(a.good.length<2)return '<p class="monitor-note">กราฟระดับน้ำจะเริ่มเมื่อมีข้อมูลจริงอย่างน้อย 2 จุด</p>';
    const lo=Math.min(...a.good.map(r=>r.depth_m)),hi=Math.max(...a.good.map(r=>r.depth_m)),span=Math.max(.02,hi-lo),start=Date.parse(a.first),duration=Date.parse(a.last)-start;
    const x=r=>50+(Date.parse(r.observed_at)-start)/duration*610,y=r=>165-(r.depth_m-lo)/span*130;
    const intervals=a.good.slice(1).map((r,i)=>Date.parse(r.observed_at)-Date.parse(a.good[i].observed_at)).sort((a,b)=>a-b);
    const allowed=Math.min(3600000,Math.max(180000,(intervals[Math.floor(intervals.length/2)]||60000)*2));
    let path='',previous=null;
    for(const row of a.rows){if(!a.good.includes(row)){previous=null;continue;}path+=(previous&&Date.parse(row.observed_at)-Date.parse(previous.observed_at)<=allowed?' L':' M')+x(row).toFixed(1)+','+y(row).toFixed(1);previous=row;}
    return `<svg class="monitor-plot" viewBox="0 0 710 215" role="img" aria-label="ระดับน้ำจากประวัติจริง ${a.count} จุด"><path d="${path}" stroke="#4bdce3" stroke-width="2.5" fill="none"/>${a.good.map(r=>`<circle cx="${x(r)}" cy="${y(r)}" r="2" fill="#4bdce3"><title>${esc(time(r.observed_at))} · ${n(r.depth_m,3)} เมตร</title></circle>`).join('')}<text x="40" y="38" text-anchor="end">${n(lo+span,2)}</text><text x="40" y="170" text-anchor="end">${n(lo,2)}</text><text x="50" y="200">${esc(time(a.first))}</text><text x="660" y="200" text-anchor="end">${esc(time(a.last))}</text></svg>`;
  }
  function html(state){
    const a=analyze(state.history,Date.now(),state.hours||24),recent=analyze(state.history,Date.now(),1),c=state.current,valid=c&&state.status==='GOOD'&&!state.error;
    const stat=(label,value,unit,note)=>`<article class="monitor-stat"><span>${label}</span><strong>${n(value)} <small>${unit}</small></strong><p>${note}</p></article>`;
    const d=estimate(scenario.area,scenario.evaporation);
    return `<section class="pond-details" aria-label="รายละเอียดสมดุลน้ำ"><header class="monitor-heading"><div><small>RESERVOIR INSIGHTS</small><h2>น้ำเปลี่ยนไปเท่าไร และเพราะอะไร</h2></div><b>อ่านข้อมูลเท่านั้น</b></header>
      <p class="monitor-note">${valid?'มีข้อมูลระดับน้ำล่าสุด':'ค่าล่าสุดยังไม่พร้อม · สรุปด้านล่างเป็นประวัติที่อ่านได้'} · ปริมาตรคำนวณจากระดับน้ำตามแบบจำลองเดิม รูปทรงและความจุบ่อยังรอสอบเทียบ</p>
      <div class="monitor-stats">${stat('อัตราเปลี่ยนน้ำ · ชั่วโมงล่าสุด',recent.rate,'ลบ.ม./ชม.','บวกคือน้ำเพิ่ม ลบคือน้ำลด · ตามช่วงข้อมูลจริงใน 1 ชั่วโมง')}${stat('ระดับเปลี่ยน · ชั่วโมงล่าสุด',recent.depthRate,'ซม./ชม.','ยังแยกน้ำใช้ น้ำระเหย และรั่วซึมไม่ได้')}${stat('ปริมาตรเปลี่ยนแปลงสุทธิ',a.delta,'ลบ.ม.','จุดท้ายลบจุดแรก · บวกคือน้ำเพิ่ม ลบคือน้ำลด')}${stat('อัตราเปลี่ยนปริมาตรเฉลี่ย',a.rate,'ลบ.ม./ชม.','เฉลี่ยระหว่างจุดต้น–ปลาย ไม่ใช่อัตราไหลจากมิเตอร์')}${stat('ระดับน้ำเปลี่ยนเฉลี่ย',a.depthRate,'ซม./ชม.','ต้องมีข้อมูลอย่างน้อย 3 จุด ครอบคลุม 30 นาที')}${stat('ระดับต่ำสุดในข้อมูล',a.minDepth,'เมตร','ค่าต่ำสุดของจุดที่ได้รับในช่วงนี้')}${stat('ระดับสูงสุดในข้อมูล',a.maxDepth,'เมตร','ค่าสูงสุดของจุดที่ได้รับในช่วงนี้')}${stat('ระดับเปลี่ยนรวม',a.depth,'ซม.','คงเครื่องหมายตามทิศทางการเปลี่ยนแปลง')}</div>
      <div class="monitor-coverage"><strong>คุณภาพและช่วงข้อมูล</strong><p>${a.count}/${a.total} จุดใช้วิเคราะห์ได้${a.first?` · ครอบคลุม ${n(a.span,1)} ชั่วโมง<br>${esc(time(a.first))} ถึง ${esc(time(a.last))} · ช่องว่างยาวสุด ${n(a.maxGap,1)} นาที`:''}<br>ช่วงที่ขอ ${state.hours===168?'7 วัน':'24 ชั่วโมง'} อาจมีข้อมูลจริงไม่ครบช่วง กราฟและสรุปใช้เฉพาะจุดที่ได้รับ</p>${!a.ready?'<p>ยังมีข้อมูลไม่พอคำนวณอัตราการเปลี่ยนแปลง</p>':''}</div>
      <h3>แนวโน้มระดับน้ำจริง</h3>${chart(a)}
      <div class="monitor-coverage is-amber"><strong>น้ำลด ยังไม่เท่ากับน้ำรั่ว</strong><p>การเปลี่ยนน้ำในบ่อ = น้ำเติม + ฝน/น้ำไหลเข้า − น้ำใช้งาน − ระเหย − ซึม/รั่ว − น้ำล้น<br>ขณะนี้แยกส่วนเหล่านี้ออกจากกันไม่ได้ จึงยังไม่รายงานตัวเลข “รั่วซึมจริง” หรือคาดเวลาน้ำหมดจากอัตราสุทธิเพียงอย่างเดียว</p></div>
      <div class="monitor-stats"><article class="monitor-stat"><span>อุณหภูมิน้ำ</span><strong>— <small>°C</small></strong><p>ยังไม่มีเซ็นเซอร์อุณหภูมิน้ำในข้อมูลที่รับอยู่ · อุณหภูมิ Pi หรืออากาศใช้แทนไม่ได้</p></article><article class="monitor-stat"><span>การระเหยจากผิวน้ำจริง</span><strong>— <small>มม./วัน</small></strong><p>ยังไม่มีอัตราระเหยและพื้นที่ผิวน้ำที่ตรวจยืนยัน · ค่าคายระเหยอ้างอิงพืชไม่ใช่การระเหยจากบ่อโดยตรง</p></article><article class="monitor-stat"><span>น้ำเข้า / น้ำออกจริง</span><strong>— <small>ลบ.ม./ชม.</small></strong><p>ยังไม่มีข้อมูลจากมิเตอร์อัตราไหล · สถานะรีเลย์ไม่ยืนยันว่ามีน้ำไหล</p></article></div>
      <details class="monitor-details"><summary>คำนวณการระเหยตามสมมติฐาน</summary><p class="monitor-note">ใช้พื้นที่ผิวน้ำ ณ ระดับปัจจุบัน และอัตราระเหยที่มีแหล่งอ้างอิง ตัวเลขนี้เป็นสถานการณ์ที่กรอกเอง ไม่แก้เซ็นเซอร์หรือสั่งปั๊ม</p><div class="monitor-inputs"><label>พื้นที่ผิวน้ำ (ตร.ม.)<input id="pond-area" type="number" min="0" max="100000000" step="any" value="${finite(scenario.area)?scenario.area:''}" oninput="PondDetails.calculate()"></label><label>อัตราระเหย (มม./วัน)<input id="pond-evap" type="number" min="0" max="100" step="any" value="${finite(scenario.evaporation)?scenario.evaporation:''}" oninput="PondDetails.calculate()"></label></div><p id="pond-scenario-result" class="monitor-coverage" role="status">${d?`ประมาณการจากค่าที่กรอก: ${n(d.day,3)} ลบ.ม./วัน (${n(d.litres,0)} ลิตร/วัน) · ไม่ใช่ค่าที่วัดจากบ่อ`:'กรอกทั้งสองค่าเพื่อคำนวณ'}</p><p class="monitor-note">สูตร: พื้นที่ผิวน้ำ × อัตราระเหย ÷ 1,000 = ลบ.ม./วัน · <a href="https://www.fao.org/fishery/static/FAO_Training/FAO_Training/General/x6705e/x6705e02.htm" target="_blank" rel="noopener noreferrer">หลักการระเหยจากบ่อ: FAO</a></p></details>
      <details class="monitor-details"><summary>ข้อมูลสำคัญที่ควรเพิ่มเพื่อวิเคราะห์ได้แม่นขึ้น</summary><div class="monitor-table"><table><thead><tr><th>ข้อมูล</th><th>ช่วยตอบคำถาม</th><th>สถานะ</th></tr></thead><tbody><tr><td>รูปทรง / ตารางระดับ–ปริมาตร</td><td>น้ำเปลี่ยนจริงกี่ลูกบาศก์เมตร</td><td>ใช้แบบจำลองเดิม · รอสอบเทียบ</td></tr><tr><td>มิเตอร์น้ำเข้าและออก</td><td>น้ำลดเพราะใช้งาน หรือมีส่วนต่างสมดุลน้ำ</td><td>ยังไม่มีข้อมูลตรวจวัด</td></tr><tr><td>อุณหภูมิน้ำ</td><td>แนวโน้มสภาพน้ำและความร้อน</td><td>ยังไม่มีเซ็นเซอร์ในระบบ</td></tr><tr><td>ฝนจริง / ลม / ความชื้น / รังสี</td><td>แยกฝนและประมาณการระเหย</td><td>พยากรณ์ไม่ใช่สถานีตรวจวัดจริง</td></tr><tr><td>อัตราระเหยเฉพาะพื้นที่</td><td>แยกน้ำระเหยจากการซึม</td><td>รอข้อมูลอ้างอิงและพื้นที่ผิวน้ำ</td></tr></tbody></table></div></details></section>`;
  }
  root.PondDetails={analyze,estimate,html,calculate};
})(typeof window!=='undefined'?window:globalThis);
