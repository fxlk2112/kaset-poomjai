"use strict";
function cycleMaterialHistory(cycleId) {
  return S.tasks.filter(t=>t.cycleId===cycleId && t.status==='done' && (['spray','fertilize'].includes(t.type) || t.costItems?.some(ci=>['chemical','fertilizer'].includes(ci.category))))
    .slice().sort((a,b)=>taskRecordDate(b).localeCompare(taskRecordDate(a)));
}
function cycleNotebookHtml(c) {
  const p=plotById(S,c.plotId),tasks=cycleMaterialHistory(c.id),finance=cycleFinance(S,c.id),area=Number(p?.sizeRai)||0;
  const projects=(S.projects || []).filter(p=>p.cycleId===c.id || projectTaskList(p).some(t=>t.cycleId===c.id));
  return `<div class="pw-page"><div class="pw-cycle-summary"><div>ต้นทุนจากงานที่ทำแล้ว<b>${fmtMoney(finance.cost)} บาท</b></div><div>ต้นทุนต่อไร่<b>${area>0?fmtMoney(finance.cost/area)+' บาท':'ยังไม่ทราบพื้นที่'}</b></div><div>งานที่วางแผนไว้<b>${S.tasks.filter(t=>t.cycleId===c.id && t.status==='planned').length} งาน</b><small>ยังไม่รวมในต้นทุนจริง</small></div></div><section class="card pw-section"><div class="pw-between"><h2>ประวัติการใช้ยาและปุ๋ย</h2><button class="btn btn-primary" onclick="App.modalTask(todayISO(),{cycleId:'${c.id}',type:'spray',status:'done'})">${ic('plus')} บันทึกยา / ปุ๋ย</button></div>${tasks.length?`<div class="pw-table-scroll"><table class="pw-cycle-table"><thead><tr><th>วันที่</th><th>กิจกรรม / วัสดุ</th><th>ต้นทุนกิจกรรม</th><th>หลักฐาน</th></tr></thead><tbody>${tasks.map(t=>`<tr><td>${esc(dateLabel(taskRecordDate(t)))}</td><td><button onclick="App.viewTask('${t.id}')"><b>${esc(t.title)}</b></button>${(t.costItems || []).filter(ci=>['chemical','fertilizer'].includes(ci.category)).map(ci=>`<span class="pw-material-row">${esc(ci.name)} · ${fmtNum(ci.usageQty ?? ci.qty)} ${esc(ci.usageUnit || ci.unit || '')} · ${fmtMoney(ci.totalCost)} บาท</span>`).join('')}${t.projectId?`<button class="pw-material-row" onclick="App.projectOpen('${t.projectId}')">${esc(projectById(t.projectId)?projectCode(projectById(t.projectId)):'โครงการ')}</button>`:''}</td><td>${fmtMoney(t.cost)} บาท</td><td><button onclick="App.viewTask('${t.id}')">${taskPhotos(t).length} รูป</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="pw-empty">ยังไม่มีการใช้ยา / ปุ๋ยที่ทำแล้วในรอบนี้</p>'}</section><section class="card pw-section"><h2>โครงการที่เกี่ยวข้อง</h2><div class="pw-cycle-links">${projects.map(p=>`<button class="btn btn-outline" onclick="App.projectOpen('${p.id}')">${esc(projectCode(p))} · ${esc(p.name)}</button>`).join('') || '<p>ยังไม่มีโครงการที่เชื่อมรอบปลูกนี้</p>'}</div></section></div>`;
}
function taskReusableMaterials(task,state) {
  return (task.costItems || []).filter(ci=>['chemical','fertilizer','seed','materials'].includes(ci.category)).map(ci=>{
    const copy=JSON.parse(JSON.stringify(ci));
    delete copy.stockLog;delete copy.stockState;delete copy._deducted;delete copy.areaAllocation;
    copy.source=copy.stockId?'stock':'external';
    if(copy.stockId && !['package','open','record','content'].includes(copy.stockMode))copy.stockMode='content';
    const stock=copy.stockId?stockById(state,copy.stockId):null;
    if(copy.stockId && !stock) { copy.stockId='';copy.source='external';copy.unitCost='';copy.totalCost=0;copy.packagePrice=''; }
    if(stock){copy.unitCost=Number(stock.avgCost)||0;copy.priceMode='cost';copy.totalCost=costTotal(copy);}
    return copy;
  });
}
App.taskUsePreviousMaterials=function(){
  const plot=document.getElementById('t_plot')?.value,cycle=document.getElementById('t_cycle')?.value,type=document.getElementById('t_type')?.value;
  const matches=S.tasks.filter(t=>t.id!==taskEditingId && t.plotId===plot && t.cycleId===cycle && t.type===type && t.status==='done' && t.costItems?.some(ci=>['chemical','fertilizer','seed','materials'].includes(ci.category))).sort((a,b)=>taskRecordDate(b).localeCompare(taskRecordDate(a)));
  if(!matches.length){toast('ยังไม่มีรายการวัสดุครั้งก่อนของงานชนิดนี้ในรอบปลูกนี้');return;}
  const apply=()=>{taskCostItems=taskReusableMaterials(matches[0],S);document.getElementById('t_usecost').checked=true;App.taskToggleCost();App.costRender();TaskWizard.persist();const note=document.getElementById('taskReuseStatus');if(note)note.textContent='ใช้รายการจาก '+dateLabel(taskRecordDate(matches[0]))+' แล้ว · ตรวจปริมาณและราคาก่อนยืนยัน';};
  if(taskCostItems.some(ci=>ci.stockId || ci.name || Number(ci.totalCost)>0)) App.confirm('ใช้วัสดุจากครั้งก่อน?','แทนที่รายการวัสดุในร่างนี้ รูปภาพและผลเดิมจะไม่ถูกนำมาใช้',apply);
  else apply();
};
const projectOriginalModalTask=App.modalTask;
App.modalTask=function(...args){
  const result=projectOriginalModalTask.apply(this,args);
  const list=document.getElementById('costItemsList');
  if(list && !taskEditingId){const panel=document.createElement('div');panel.className='pw-activity-reuse';panel.innerHTML=`<button type="button" class="btn btn-outline" onclick="App.taskUsePreviousMaterials()">${ic('copy')} ใช้รายการวัสดุจากครั้งก่อน</button><small id="taskReuseStatus" role="status">เลือกแปลงและรอบปลูกก่อนใช้รายการเดิม</small>`;list.before(panel);}
  return result;
};
