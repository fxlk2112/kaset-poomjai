/* Owner energy dashboard: observations only. Never sends hardware commands. */
(function (root) {
  "use strict";
  const state = {data:null, loading:false, error:"", loadedAt:0, selected:0, loginRequired:false};
  const labels = {SYSTEM_TOTAL_FEEDER:"ไฟฟ้ารวมระบบ", FILL_PUMP:"ปั๊มเติมน้ำ", OUTFLOW_PUMP:"ปั๊มจ่ายน้ำ"};
  const names = {GOOD:"ข้อมูลล่าสุด", STALE:"ข้อมูลขาดช่วง", UNVERIFIED:"รอตรวจสอบมิเตอร์", SENSOR_FAULT:"อ่านค่าไม่สำเร็จ", OUT_OF_RANGE:"ค่านอกช่วง", DISCONNECTED:"มิเตอร์ขาดการเชื่อมต่อ", NO_DATA:"รอข้อมูลมิเตอร์", NO_METER_DATA:"รอเชื่อมต่อมิเตอร์", INGEST_NOT_READY:"รอเชื่อมต่อมิเตอร์", UNAVAILABLE:"ยังตรวจสอบข้อมูลไม่ได้"};
  let account = "", generation = 0;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const number = (v, places=2) => typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("th-TH",{minimumFractionDigits:places,maximumFractionDigits:places}) : "—";
  const stamp = v => Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString("th-TH",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"}) : "ยังไม่มีเวลาที่อ่านได้";
  function sync() {
    const next = typeof Auth !== "undefined" && Auth.session?.token || "";
    if (account !== next) {account=next; generation++; Object.assign(state,{data:null,loading:false,error:"",loadedAt:0,selected:0,loginRequired:false});}
    return next;
  }
  function selected() { return state.data?.sources?.[state.selected] || null; }
  function statusOf(source, now=Date.now()) {
    if (!source?.current) return source?.status || state.data?.status || "UNAVAILABLE";
    const row=source.current, time=Date.parse(row.observed_at);
    if (!Number.isFinite(time) || time > now+120000) return "UNVERIFIED";
    if (now-time > (row.stale_after_s || 180)*1000) return "STALE";
    return source.status === "GOOD" && row.quality === "GOOD" ? "GOOD" : source.status;
  }
  function draw() {
    if (typeof document === "undefined") return;
    const panel=document.getElementById("energy-panel");
    if (!panel) return;
    const focus=document.activeElement?.id;
    panel.innerHTML=bodyHtml();
    if (focus?.startsWith("energy-")) document.getElementById(focus)?.focus({preventScroll:true});
  }
  async function refresh(force=false) {
    const token=sync();
    if (!token) {draw(); return;}
    if (state.loading || (!force && Date.now()-state.loadedAt<30000)) return;
    const epoch=++generation;
    state.loading=true; state.error=""; draw();
    try {
      const response=await fetch(root.FarmUltimateRuntime.apiUrl+"/monitor/read", {method:"POST", headers:{"Content-Type":"application/json"}, cache:"no-store", signal:AbortSignal.timeout(12000), body:JSON.stringify({token,hours:24})});
      if (sync()!==token || epoch!==generation) return;
      if (response.status===401 || response.status===403) {state.loginRequired=true; throw Error("กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของมิเตอร์อีกครั้ง");}
      const result=await response.json();
      if (sync()!==token || epoch!==generation) return;
      if (!response.ok || !result.ok || result.data?.output_control_allowed!==false || result.data?.energy?.output_control_allowed!==false || result.data.energy.modbus_write_allowed!==false || !Array.isArray(result.data.energy.sources)) throw Error("ยังโหลดข้อมูลพลังงานไม่ได้ กรุณาลองใหม่");
      state.data=result.data.energy; state.loginRequired=false;
      if (!state.data.sources[state.selected]) state.selected=0;
    } catch(error) {
      if (sync()!==token || epoch!==generation) return;
      state.data=null;
      state.error=error?.name==="TimeoutError" ? "การเชื่อมต่อใช้เวลานาน กรุณาลองใหม่" : ["กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าของมิเตอร์อีกครั้ง","ยังโหลดข้อมูลพลังงานไม่ได้ กรุณาลองใหม่"].includes(error.message) ? error.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่";
    } finally {
      if (epoch===generation) {state.loading=false;state.loadedAt=Date.now();draw();}
    }
  }
  function chartHtml(source, now=Date.now()) {
    const rows=(source?.history || []).filter(r=>Date.parse(r.observed_at)>=now-86400000 && Date.parse(r.observed_at)<=now);
    const good=rows.filter(r=>r.quality==="GOOD" && typeof r.active_power_total_kw==="number" && Number.isFinite(r.active_power_total_kw));
    if (!good.length) return `<div class="energy-chart-empty"><span aria-hidden="true">⌁</span><strong>กราฟจะเริ่มเมื่อมีข้อมูลจริง</strong><p>แสดงกำลังไฟย้อนหลัง 24 ชั่วโมง<br>ไม่สร้างค่าทดแทนในช่วงที่มิเตอร์ยังไม่ส่งข้อมูล</p></div>`;
    const max=Math.max(1,...good.map(r=>r.active_power_total_kw))*1.15, start=now-86400000;
    const x=r=>52+(Date.parse(r.observed_at)-start)/86400000*620;
    const y=r=>180-r.active_power_total_kw/max*150;
    let path="", previous=null;
    for(const row of rows){
      if (!good.includes(row)) {previous=null;continue;}
      const linked=previous && Date.parse(row.observed_at)-Date.parse(previous.observed_at)<=1200000;
      path+=(linked?" L":" M")+x(row).toFixed(1)+","+y(row).toFixed(1);previous=row;
    }
    return `<svg class="energy-chart" viewBox="0 0 700 225" role="img" aria-label="กำลังไฟย้อนหลัง 24 ชั่วโมง หน่วยกิโลวัตต์ มี ${good.length} จุดข้อมูลจริง">
      ${[0,.5,1].map(n=>`<line x1="52" x2="675" y1="${180-n*150}" y2="${180-n*150}" stroke="#315452"/><text x="44" y="${184-n*150}" text-anchor="end">${number(max*n,1)}</text>`).join("")}
      <path d="${path}" fill="none" stroke="#8fedb5" stroke-width="2.5"/>
      ${good.map(r=>`<circle cx="${x(r)}" cy="${y(r)}" r="2.5" fill="#8fedb5"><title>${esc(stamp(r.observed_at))} · ${number(r.active_power_total_kw)} kW</title></circle>`).join("")}
      ${[0,6,12,18,24].map(h=>`<text x="${52+h/24*620}" y="210" text-anchor="middle">${h===24?"ตอนนี้":"−"+(24-h)+" ชม."}</text>`).join("")}
    </svg><p class="energy-caption">จุดวัดจริงล่าสุดของแต่ละช่วง 15 นาที · เว้นเส้นเมื่อข้อมูลขาดช่วง</p>`;
  }
  function bodyHtml() {
    const token=sync(), source=selected(), status=statusOf(source), live=status==="GOOD" && !state.error;
    const row=live ? source.current : null;
    const badge=!token || state.loginRequired ? "เข้าสู่ระบบเพื่อดูข้อมูล" : state.loading && !state.data ? "กำลังตรวจสอบข้อมูล" : names[status] || "รอข้อมูลมิเตอร์";
    const access=!token || state.loginRequired;
    const metric=(label,key,unit,precision=2)=>`<article class="energy-kpi"><span>${label}</span><strong>${number(row?.[key],precision)} <small>${unit}</small></strong></article>`;
    return `<div class="energy-toolbar"><div><span class="energy-eyebrow">ACREL · THREE-PHASE METER</span><h2>${esc(labels[source?.circuit_role] || "ภาพรวมพลังงาน")}</h2></div><span class="energy-state ${live?"is-live":""}" role="status">${esc(badge)}</span></div>
      ${state.data?.sources.length>1?`<label class="energy-source">จุดวัด <select id="energy-source" onchange="EnergyDashboard.select(this.value)">${state.data.sources.map((s,i)=>`<option value="${i}" ${i===state.selected?"selected":""}>${esc(labels[s.circuit_role] || "มิเตอร์")} · ${i+1}</option>`).join("")}</select></label>`:""}
      ${access?`<div class="energy-notice"><div><strong>ข้อมูลพลังงานสำหรับเจ้าของฟาร์ม</strong><p>ใช้บัญชีเดียวกับหน้าเซ็นเซอร์เพื่อดูค่ามิเตอร์และประวัติ</p></div><button id="energy-login" onclick="App.openSensorLogin()">เข้าสู่ระบบ</button></div>`:""}
      ${state.error?`<div class="energy-notice is-warning" role="alert">${esc(state.error)}</div>`:""}
      ${token&&!state.loading&&!state.error&&!source?`<div class="energy-notice is-warning"><div><strong>${status==="STALE"?"ตัวส่งข้อมูลขาดการติดต่อ":status==="UNAVAILABLE"?"ยังตรวจสอบการเชื่อมต่อไม่ได้":"ยังไม่มีค่าที่อ่านจากมิเตอร์จริง"}</strong><p>ได้รับอุปกรณ์แล้ว · รอเชื่อมต่อ RS485 และตรวจสอบค่าเทียบหน้าจอมิเตอร์ที่หน้างาน</p></div></div>`:""}
      ${source&&!live&&!state.error?`<div class="energy-notice is-warning"><div><strong>${esc(names[status] || "รอตรวจสอบข้อมูล")}</strong><p>อ่านได้ล่าสุด ${esc(stamp(source.current?.observed_at))} · ค่าปัจจุบันจะแสดงเมื่ออ่านได้และผ่านการตรวจสอบ</p></div></div>`:""}
      <div class="energy-overview"><article class="energy-power"><div><span>กำลังไฟขณะนี้</span><strong>${number(row?.active_power_total_kw)} <small>kW</small></strong><p>${live?"อัปเดต "+esc(stamp(row.observed_at)):"รอค่าที่อ่านได้จากมิเตอร์"}</p></div><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43"/><path d="m55 17-28 38h20l-3 29 29-42H53z"/></svg></article>
      ${metric("พลังงานสะสม · รับเข้า","import_energy_total_kwh","kWh")}
      ${metric("ตัวประกอบกำลัง","power_factor_total","PF")}
      ${metric("ความถี่ระบบ","frequency_hz","Hz")}</div>
      <section class="energy-phases" aria-labelledby="energy-phase-heading"><div class="energy-section-title"><h3 id="energy-phase-heading">แรงดันและกระแสแต่ละเฟส</h3><span>3 PHASES</span></div><div class="energy-phase-grid">${[1,2,3].map(i=>`<article class="energy-phase phase-${i}"><h4><i></i>เฟส L${i}</h4><dl><div><dt>แรงดัน</dt><dd>${number(row?.["voltage_l"+i+"_v"],1)} <small>V</small></dd></div><div><dt>กระแส</dt><dd>${number(row?.["current_l"+i+"_a"])} <small>A</small></dd></div></dl></article>`).join("")}</div></section>
      <section class="energy-history"><div class="energy-section-title"><h3>กำลังไฟย้อนหลัง</h3><span>24 ชั่วโมง · kW</span></div>${chartHtml(source)}</section>
      <section class="energy-device"><div class="energy-section-title"><h3>มิเตอร์พลังงานไฟฟ้า</h3><span>อ่านข้อมูลเท่านั้น</span></div><div class="energy-device-info"><div><strong>Acrel ADL400N-CT</strong><p>มิเตอร์ 3 เฟส พร้อม CT · RS485 / Modbus RTU</p></div><span class="energy-model">${esc(source?.meter_model || "รุ่นย่อยและอัตราทด CT รอยืนยันหน้างาน")}</span></div><p class="energy-caption">${live?"ข้อมูลมาจากมิเตอร์ที่ตรวจอัตราทด CT ทิศทาง และเทียบค่ากับหน้าจอแล้ว":"เมื่อช่างติดตั้งและตรวจสอบมิเตอร์ครบ ระบบจึงจะเริ่มแสดงค่าจริง"} · พลังงานสะสมไม่ใช่ค่าใช้ไฟเฉพาะวันนี้</p></section>
      <footer class="energy-footer"><span>ข้อมูลส่วนตัวของเจ้าของ · รีเฟรชทุก 30 วินาที</span><button id="energy-refresh" onclick="EnergyDashboard.refresh(true)" ${!token||state.loading?"disabled":""}>${state.loading?"กำลังโหลด…":"↻ รีเฟรชข้อมูล"}</button></footer>`;
  }
  function cardHtml() {
    return `<section class="energy-page" aria-label="แดชบอร์ดพลังงานไฟฟ้า"><header class="energy-header"><button onclick="App.farmMapBack()">← แผนที่ฟาร์ม</button><div><span class="energy-eyebrow">FLYTECH · ENERGY MONITOR</span><h1>พลังงานไฟฟ้า</h1></div><b>DATA ONLY</b></header><div id="energy-panel">${bodyHtml()}</div></section>`;
  }
  root.EnergyDashboard={state,cardHtml,refresh,statusOf,chartHtml,select(index){state.selected=Number(index);draw();}};
  if (typeof document!=="undefined") {
    setInterval(()=>{if (!document.hidden && document.getElementById("energy-panel")) refresh(false);},30000);
    document.addEventListener("visibilitychange",()=>{if (!document.hidden && document.getElementById("energy-panel")) refresh(false);});
  }
})(typeof window!=="undefined"?window:globalThis);
