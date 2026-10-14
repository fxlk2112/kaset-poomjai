/* Application workspace; data, permissions and forms remain owned by the core app. */
Auth.applyTheme();

const Concept = {
  enabled() { return !!Auth.session && !Auth.shareMode && !Auth.landingMode; },
  walletUrl() {
    return this.enabled() && window.location.origin === 'http://127.0.0.1:4207' ? 'http://127.0.0.1:4208/wallet-preview.html' : '';
  },
  taskFilter: 'auto',
  groups: { team: false, tools: false },
  saleFilter: 'all',
  saleQuery: '',
  saleFrom: '',
  saleTo: '',
  salesRange(event) {
    event.preventDefault();
    const from=event.target.elements.from.value,to=event.target.elements.to.value;
    if((from&&!trialValidDate(from))||(to&&!trialValidDate(to))||(from&&to&&from>to)){toast('วันเริ่มต้องไม่เกินวันสิ้นสุด');return false;}
    this.saleFrom=from;this.saleTo=to;render();return false;
  },
  clearSalesRange() { this.saleFrom='';this.saleTo='';render(); },
  openAccount(event) {
    event?.stopPropagation();
    document.body.classList.remove('concept-drawer');
    this.syncNav();
    Auth.toggleProfile();
    if(!document.getElementById('profilePanel').hidden)document.querySelector('#profilePanel button')?.focus();
  },
  active() {
    if (route.view === 'team') return Team.section==='members'?'members':'team';
    if (route.view === 'planner') return 'tasks';
    if (route.view === 'farm') return route.tab==='analytics'?'reports':'farm';
    if (route.view === 'plots') return route.tab === 'trials' ? 'trials' : 'plots';
    if (['plotDetail','cycleDetail'].includes(route.view)) return 'plots';
    return route.view;
  },
  go(key) {
    if (key === 'wallet') { const url=this.walletUrl(); if(url)window.location.assign(url); return; }
    if(typeof ConceptWorkflows!=='undefined')ConceptWorkflows.backStack=[];
    document.body.classList.remove('concept-drawer');
    this.syncNav();
    if (key === 'tasks' || key === 'calendar') { if(key==='calendar')plannerCalendarOpen=true; App.nav('planner'); }
    else if (['plots','cycles','trials'].includes(key)) { route.view='plots'; App.plotsTab(key); }
    else if (key === 'team' || key === 'members') { this.groups.team=true; Team.section=key==='team'?'inbox':'members'; Team.filter='pending'; Team.offset=0; App.nav('team'); }
    else if (key === 'reports') { App.nav('analytics'); }
    else if (key === 'guide') { window.location.assign('/guide.html'); }
    else App.nav(key);
  },
  toggleGroup(key) { this.groups[key] = !this.groups[key]; this.shell(); document.querySelector(`[aria-controls="cn-${key}"]`).focus(); },
  toggleNav() {
    if (matchMedia('(max-width: 899px)').matches) document.body.classList.toggle('concept-drawer');
    else document.body.classList.toggle('concept-nav-hidden');
    this.shell();
    if(document.body.classList.contains('concept-drawer'))document.querySelector('#conceptSidebar button').focus();
    else document.getElementById('conceptMenu').focus();
  },
  taskView(key) { this.taskFilter=key; render(); },
  salesFilter(key) { this.saleFilter=key; render(); },
  searchSales(value) {
    this.saleQuery=value;
    let count=0;
    document.querySelectorAll('.cn-sale-row').forEach(row=>{row.hidden=!row.dataset.search.includes(value.trim().toLocaleLowerCase('th'));if(!row.hidden)count++;});
    document.getElementById('cnSalesEmpty').hidden=count>0;
    document.getElementById('cnSalesCount').textContent=count+' รายการ';
  },
  syncNav() {
    if(!this.enabled())return;
    const mobile=matchMedia('(max-width:899px)').matches;
    const open=mobile?document.body.classList.contains('concept-drawer'):!document.body.classList.contains('concept-nav-hidden');
    document.getElementById('conceptSidebar').inert=!open;
    document.getElementById('conceptMenu').setAttribute('aria-expanded',String(open));
    const drawerOpen=mobile&&open;
    document.getElementById('view').inert=drawerOpen;
    document.getElementById('bottomNav').inert=drawerOpen;
    document.querySelector('.topbar-actions').inert=drawerOpen;
  },
  shell() {
    const enabled=this.enabled();
    document.body.classList.toggle('concept',enabled);
    if(!enabled){
      document.body.classList.remove('concept-drawer');
      for(const el of document.querySelectorAll('#view,#bottomNav,.topbar-actions'))el.inert=false;
      return;
    }
    const active=this.active();
    const pending=S.tasks.filter(t=>taskStatusOf(t)==='overdue').length;
    const navItem=(key,label,icon,count)=>`<button class="cn-link ${active===key?'active':''}" ${active===key?'aria-current="page"':''} onclick="Concept.go('${key}')">${ic(icon)}<span>${label}</span>${count?`<span class="cn-count">${count}</span>`:''}</button>`;
    const group=(key,label,icon,items)=>`<section class="cn-group"><button class="cn-heading" aria-expanded="${this.groups[key]}" aria-controls="cn-${key}" onclick="Concept.toggleGroup('${key}')">${ic(icon)}<span>${label}</span>${ic('chevron','cn-arrow')}</button><div id="cn-${key}" class="cn-links" ${this.groups[key]?'':'hidden'}>${items}</div></section>`;
    document.getElementById('conceptSidebar').innerHTML=`
      <button class="cn-brand" onclick="Concept.go('home')"><img src="logo.jpg" alt=""><span>${esc(T('brandName'))}</span></button>
      <div class="cn-scroll">${navItem('home','ภาพรวมฟาร์ม','home')}
      <div class="cn-section-label">งานในฟาร์ม</div>
      ${navItem('tasks','กิจกรรม','calendar',pending)}${navItem('plots','แปลงและรอบปลูก','map')}${navItem('trials','งานทดลอง','leaf')}${navItem('farm','งานส่วนกลาง','briefcase')}
      <div class="cn-section-label">คลังและธุรกิจ</div>
      ${navItem('stock','คลังวัสดุและยา','box')}${this.walletUrl()?navItem('wallet','กระเป๋าเงิน (ทดลอง)','briefcase'):''}${navItem('sales','ขายสินค้าและเอกสาร','briefcase')}${navItem('reports','รายงานและวิเคราะห์','chart')}
      ${group('team','ทีมบันทึกข้อมูล','user',navItem('team','ตรวจรับข้อมูล','check')+navItem('members','สมาชิกและสิทธิ์','user'))}
      ${group('tools','เครื่องมือฟาร์ม','gear',navItem('weather','สภาพอากาศ','cloud')+navItem('equipment','อุปกรณ์','truck')+navItem('iot','ระบบน้ำ','droplet')+navItem('prices','ราคาตลาด','chart'))}</div>
      <div class="cn-footer"><div class="cn-footer-links"><button onclick="Concept.go('settings')">${ic('gear')} ตั้งค่า</button><button onclick="Concept.go('guide')">${ic('info')} คู่มือ</button></div><button class="cn-account" aria-label="จัดการบัญชี" aria-controls="profilePanel" onclick="Concept.openAccount(event)"><span class="cn-avatar">${ic('user')}</span><span><strong>${esc(Auth.session?.name||'บัญชีของฉัน')}</strong><small>จัดการบัญชี</small></span>${ic('chevron')}</button></div>`;
    const titles={home:'ภาพรวมฟาร์ม',team:'ทีมบันทึกข้อมูล',tasks:'กิจกรรม',plots:'แปลงและรอบปลูก',trials:'งานทดลอง',stock:'คลังวัสดุและยา',sales:'ขายสินค้าและเอกสาร',farm:'งานส่วนกลาง',reports:'รายงานและวิเคราะห์',more:'เครื่องมือเพิ่มเติม',settings:'ตั้งค่า',equipment:'อุปกรณ์',iot:'ระบบน้ำ',weather:'สภาพอากาศ',prices:'ราคาตลาด'};
    document.getElementById('conceptCrumb').innerHTML=`<span>${esc(T('brandName'))}</span>${ic('chevron')}<strong>${titles[active]||'รายละเอียด'}</strong>`;
    if(active==='members')document.getElementById('conceptCrumb').querySelector('strong').textContent='สมาชิกและสิทธิ์';
    this.syncNav();
    const view=document.getElementById('view');
    view.classList.toggle('cn-trials-view',active==='trials');
    const farmTitle=view.querySelector('.farm-heading h1');
    if(farmTitle){farmTitle.textContent=titles[active];view.querySelector('.farm-main-tabs button').innerHTML=ic('briefcase')+' งานส่วนกลาง';}
    if(['farm','reports'].includes(active)){
      const tabs=view.querySelector('.farm-main-tabs');if(tabs)tabs.hidden=true;
      if(active==='reports')view.querySelector('.farm-heading>.btn')?.remove();
    }
    if(active==='settings'){
      const back=view.querySelector('.subpage-back');
      if(back){back.setAttribute('onclick',"Concept.go('home')");back.setAttribute('aria-label','กลับหน้าหลัก');}
    }
    const plannerTitle=view.querySelector('.section-title>span');
    if(active==='tasks'&&plannerTitle){const heading=document.createElement('h1');heading.className='cn-page-title';heading.textContent='กิจกรรม';plannerTitle.replaceWith(heading);}
    if(active==='stock'&&!view.querySelector('.cn-page-title'))view.insertAdjacentHTML('afterbegin','<h1 class="cn-page-title">คลังวัสดุและยา</h1>');
    document.getElementById('bottomNav').innerHTML=[['home','หน้าแรก','home'],['tasks','กิจกรรม','calendar'],['plots','แปลง','map'],['stock','คลัง','box']].map(([key,label,icon])=>`<button class="nav-item ${active===key?'active':''}" ${active===key?'aria-current="page"':''} onclick="Concept.go('${key}')"><span class="nav-ico">${ic(icon)}</span><span>${label}</span></button>`).join('')+`<button class="nav-item" aria-label="เมนูทั้งหมด" onclick="Concept.toggleNav()"><span class="nav-ico">${ic('menu')}</span><span>เมนู</span></button>`;
    document.title=(titles[active]||'FarmUltimate')+' · '+T('brandName');
  }
};

const appShell=document.getElementById('app');
appShell.insertAdjacentHTML('afterbegin','<aside id="conceptSidebar" aria-label="เมนูหลัก"></aside><button class="cn-scrim" aria-label="ปิดเมนู" onclick="Concept.toggleNav()"></button>');
const topRow=document.querySelector('.topbar-row');
topRow.insertAdjacentHTML('afterbegin',`<div class="cn-top-left"><button id="conceptMenu" class="cn-icon" title="เปิดหรือย่อเมนู" aria-label="เปิดหรือย่อเมนู" aria-controls="conceptSidebar" onclick="Concept.toggleNav()">${ic('menu')}</button><div id="conceptCrumb" class="cn-crumb"></div></div>`);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('concept-drawer'))Concept.toggleNav();else if(event.key==='Escape'&&!document.getElementById('profilePanel').hidden){Auth.closeProfile();document.getElementById('profileBtn').focus();}});
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||!document.body.classList.contains('concept-drawer'))return;
  const buttons=[...document.querySelectorAll('#conceptSidebar button')].filter(el=>el.getClientRects().length);
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
matchMedia('(max-width:899px)').addEventListener('change',()=>Concept.syncNav());

const workspaceOriginalHome=renderHome;
renderHome = function () {
  if(!S.plots.length)return workspaceOriginalHome();
  const today=todayISO(),year=today.slice(0,4),fin=ytdFinance(S),plots=S.plots.filter(p=>p.status==='active'),cycles=activeCycles(S);
  const todayTasks=S.tasks.filter(t=>t.date===today);
  const overdue=S.tasks.filter(t=>taskStatusOf(t)==='overdue').sort((a,b)=>a.date.localeCompare(b.date));
  const future=S.tasks.filter(t=>t.status==='planned'&&t.date>today).sort((a,b)=>a.date.localeCompare(b.date));
  const dueToday=todayTasks.filter(t=>!['done','failed'].includes(t.status));
  const taskFilter=Concept.taskFilter==='auto'?(overdue.length?'overdue':dueToday.length?'today':'next'):Concept.taskFilter;
  const list=taskFilter==='overdue'?overdue:taskFilter==='next'?future:dueToday;
  const planted=plots.filter(p=>cycles.some(c=>c.plotId===p.id));
  const yearFinance=p=>taskFinance(S,t=>t.plotId===p.id&&taskRecordDate(t).startsWith(year));
  const financePlots=plots.filter(p=>{const f=yearFinance(p);return f.cost||f.revenue;}).sort((a,b)=>yearFinance(b).cost-yearFinance(a).cost).slice(0,4);
  const metric=(icon,tone,title,value,unit,sub,action)=>`<button class="ch-metric" onclick="${esc(action)}"><div class="ch-metric-label"><span>${title}</span><span class="ch-metric-icon ${tone}">${ic(icon)}</span></div><div class="ch-number">${value}<small>${unit}</small></div><span class="ch-metric-sub">${sub}</span></button>`;
  const dayLabel=thaiDateStr(new Date(today+'T12:00:00'));
  const taskRows=list.slice(0,5).map(t=>{
    const plot=plotById(S,t.plotId),status=taskStatusOf(t),done=t.status==='done';
    const icon=({water:'droplet',spray:'spray',fertilize:'leaf',inspect:'map'})[t.type]||'calendar';
    return `<button class="ch-task" onclick="App.viewTask('${t.id}')"><span class="ch-task-icon ${t.type==='water'?'blue':'green'}">${ic(icon)}</span><span class="ch-task-name"><strong>${esc(t.title)}</strong><small>${esc(plot?.name||'งานส่วนกลาง')} · ${TYPE_LABELS[t.type]||'กิจกรรม'}</small></span><span class="ch-task-date">${t.date===today?'วันนี้':dateLabel(t.date)}</span><span class="ch-status ${status==='overdue'?'late':done?'done':''}">${status==='overdue'?'เลยกำหนด':done?'เสร็จแล้ว':t.status==='failed'?'ไม่สำเร็จ':'รอดำเนินการ'}</span>${ic('chevron')}</button>`;
  }).join('');
  const highest=Math.max(1,...plots.flatMap(p=>{const f=taskFinance(S,t=>t.plotId===p.id&&taskRecordDate(t).startsWith(year));return [f.revenue,f.cost];}));
  return `<div class="ch-heading"><div><p class="ch-eyebrow">${esc(T('brandName'))} / ภาพรวม</p><h1>ภาพรวมฟาร์ม</h1><p class="ch-subtitle">${dayLabel} <span class="ch-dot"></span> ${plots.length} แปลงกำลังดูแล</p></div><div class="ch-heading-actions"><button class="btn btn-outline" onclick="Concept.go('calendar')">${ic('calendar')} ปฏิทินงาน</button><button class="btn btn-primary" onclick="App.modalTask('${today}',{status:'done'})">${ic('plus')} บันทึกกิจกรรม</button></div></div>
    <div class="ch-metrics">
      ${metric('map','green','พื้นที่แปลงทั้งหมด',fmtNum(activeAreaRai(S)),'ไร่',`กำลังปลูก ${planted.length} จาก ${plots.length} แปลง`,'Concept.go("plots")')}
      ${metric('calendar','blue','งานวันนี้',todayTasks.length,'งาน',`เสร็จแล้ว ${todayTasks.filter(t=>t.status==='done').length} งาน`,'Concept.go("tasks")')}
      ${metric('briefcase','amber','ต้นทุนสะสม',fmtMoney(fin.cost),'บาท',`ปี ${Number(year)+543}`,'Concept.go("reports")')}
      ${metric('chart','green','รายรับกิจกรรม',fmtMoney(fin.revenue),'บาท',`ปี ${Number(year)+543} · ไม่รวมขายสินค้า`,'Concept.go("reports")')}
    </div>
    ${overdue.length?`<div class="ch-attention">${ic('clock')}<div><strong>มี ${overdue.length} งานเลยกำหนด</strong><span>ตรวจแปลงและอัปเดตงานที่ยังค้างอยู่</span></div><button onclick="Concept.taskView('overdue')">ดูงานค้าง ${ic('chevron')}</button></div>`:''}
    <div class="ch-workspace"><section class="ch-work"><div class="ch-section-head"><h2>งานที่ต้องดูแล</h2><button onclick="Concept.go('tasks')">ดูทั้งหมด ${ic('chevron')}</button></div><div class="ch-tabs" role="group" aria-label="ช่วงเวลางาน">${[['overdue','เลยกำหนด',overdue.length],['today','วันนี้',dueToday.length],['next','งานถัดไป',future.length]].map(([key,label,count])=>`<button class="${taskFilter===key?'active':''}" aria-pressed="${taskFilter===key}" onclick="Concept.taskView('${key}')">${label}<span>${count}</span></button>`).join('')}</div><div class="ch-task-list">${taskRows||'<p class="ch-empty">ไม่มีงานในช่วงนี้</p>'}</div><button class="ch-add-task" onclick="App.modalTask('${today}')">${ic('plus')} วางแผนงานใหม่</button></section>
    <section class="ch-finance"><div class="ch-section-head"><h2>รายรับและต้นทุน</h2><button onclick="Concept.go('reports')">ดูรายงาน ${ic('chevron')}</button></div><p class="muted">ปี ${Number(year)+543} · แปลงที่มียอดบันทึกสูงสุด ${financePlots.length} แปลง</p><div class="ch-legend"><span><i class="green"></i>รายรับ</span><span><i class="amber"></i>ต้นทุน</span></div>${financePlots.map(p=>{const f=taskFinance(S,t=>t.plotId===p.id&&taskRecordDate(t).startsWith(year));return `<button class="ch-finance-row" onclick="App.openPlot('${p.id}')"><span>${esc(p.name)}<small>${fmtNum(p.sizeRai)} ไร่</small></span><div class="ch-bar-pair"><div><progress max="${highest}" value="${f.revenue}" aria-label="รายรับ ${esc(p.name)}"></progress><b>${fmtMoney(f.revenue)}</b></div><div><progress class="cost" max="${highest}" value="${f.cost}" aria-label="ต้นทุน ${esc(p.name)}"></progress><small>${fmtMoney(f.cost)}</small></div></div></button>`;}).join('')||'<p class="ch-empty">ยังไม่มียอดรายรับหรือต้นทุนที่บันทึกในปีนี้</p>'}<div class="ch-net"><span>ส่วนต่างรายรับ − ต้นทุน</span><strong>${fmtMoney(fin.net)} <small>บาท</small></strong></div></section></div>
    <section class="ch-fields"><div class="ch-section-head"><div><h2>แปลงที่กำลังปลูก</h2><p>${planted.length} แปลง · ${cycles.length} รอบปลูก · พักแปลง ${plots.length-planted.length} แปลง</p></div><button onclick="Concept.go('plots')">แปลงทั้งหมด ${ic('chevron')}</button></div>${!planted.length?'<div class="ch-empty"><p>ยังไม่มีแปลงที่กำลังปลูก</p><button class="btn btn-primary" onclick="Concept.go(\'plots\')">'+ic('leaf')+' เลือกแปลงเพื่อเริ่มปลูก</button></div>':''}<div class="ch-field-grid">${planted.map(p=>{const pc=cycles.filter(c=>c.plotId===p.id);return `<button class="ch-field" onclick="App.openPlot('${p.id}')">${p.photoUrl?`<img src="${esc(p.photoUrl)}" alt="${esc(p.name)}">`:`<span class="ch-field-placeholder" aria-hidden="true">${ic('leaf')}</span>`}<div><span class="ch-field-top"><strong>${esc(p.name)}</strong>${ic('chevron')}</span><p>${fmtNum(p.sizeRai)} ไร่ · ${pc.length} รอบที่กำลังปลูก</p>${pc.map(c=>`<span class="ch-field-state">${esc(c.plant)} · รอบ ${c.round} · อายุ ${ageDays(c.startDate)} วัน</span>`).join('')}</div></button>`;}).join('')}</div></section>
    <div id="teamHomeInbox"></div>`;
};

const conceptBaseRender=render;
render=function(){conceptBaseRender();Concept.shell();if(Concept.enabled()&&route.view==='sales')Concept.searchSales(Concept.saleQuery);};

function renderConceptSales() {
  const sales=[...(S.sales||[])].filter(s=>(!Concept.saleFrom||s.date>=Concept.saleFrom)&&(!Concept.saleTo||s.date<=Concept.saleTo)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(b.createdAt||0)-(a.createdAt||0));
  const valid=sales.filter(s=>s.status!=='void');
  const rows=sales.filter(s=>Concept.saleFilter==='all'||(Concept.saleFilter==='void'?s.status==='void':s.status!=='void'));
  return `<header class="cn-page-heading"><div><h1>ขายสินค้าและเอกสาร</h1><p>ประวัติการขายทั้งหมด</p></div><button class="btn btn-primary" onclick="App.modalSale()">${ic('plus')} ขายสินค้า</button></header>
    <form class="trial-range-form" onsubmit="return Concept.salesRange(event)"><div class="field"><label for="saleFrom">ตั้งแต่วันที่</label><input id="saleFrom" name="from" type="date" value="${esc(Concept.saleFrom)}"></div><div class="field"><label for="saleTo">ถึงวันที่</label><input id="saleTo" name="to" type="date" value="${esc(Concept.saleTo)}"></div><button type="submit" class="btn btn-outline">ดูช่วงนี้</button><button type="button" class="btn btn-ghost" onclick="Concept.clearSalesRange()">ทุกช่วงเวลา</button></form>
    <dl class="cn-sales-summary"><div><dt>ยอดขายสุทธิ · ${Concept.saleFrom||Concept.saleTo?'ช่วงวันที่เลือก':'ทุกช่วงเวลา'} · ทุกผู้ซื้อ</dt><dd>${fmtMoney(valid.reduce((sum,s)=>sum+saleGrandTotal(s),0))} <small>บาท</small></dd></div><div><dt>เอกสารขายที่ไม่ยกเลิกในช่วงนี้</dt><dd>${valid.length} <small>ใบ</small></dd></div></dl>
    <div class="cn-sales-toolbar"><label class="cn-search">${ic('search')}<input type="search" aria-label="ค้นหาเอกสารขาย" placeholder="ชื่อผู้ซื้อ หรือเลขที่เอกสารขาย" value="${esc(Concept.saleQuery)}" oninput="Concept.searchSales(this.value)"></label><div class="cn-document-actions"><button class="btn btn-outline" onclick="App.customerHistory()">${ic('user')} ลูกค้า</button><button class="btn btn-outline" onclick="App.editSaleTemplate()">${ic('pencil')} แบบเอกสาร</button></div></div>
    <div class="cn-sales-filter"><div class="ch-tabs" role="group" aria-label="สถานะเอกสารขาย">${[['all','ทั้งหมด'],['valid','ไม่ยกเลิก'],['void','ยกเลิกแล้ว']].map(([key,label])=>`<button aria-pressed="${Concept.saleFilter===key}" class="${Concept.saleFilter===key?'active':''}" onclick="Concept.salesFilter('${key}')">${label}</button>`).join('')}</div><span id="cnSalesCount" aria-live="polite"></span></div>
    <div class="cn-sale-list">${rows.map(s=>`<button class="cn-sale-row" data-search="${esc((String(s.no)+' '+(s.customer||'')).toLocaleLowerCase('th'))}" onclick="App.viewSale('${esc(s.id)}')"><span class="cn-sale-icon">${ic('briefcase')}</span><span class="cn-sale-name"><strong>เอกสารขาย #${esc(String(s.no))} · ${esc(s.customer||'ไม่ระบุผู้ซื้อ')}</strong><small>${dateLabel(s.date)} · ${(s.items||[]).length} รายการ · ${s.payMethod==='transfer'?'โอนเงิน':'เงินสด'}</small></span><span class="cn-sale-status ${s.status==='void'?'void':''}">${s.status==='void'?'ยกเลิกแล้ว':'บันทึกแล้ว'}</span><b>${fmtMoney(saleGrandTotal(s))}<small>บาท</small></b>${ic('chevron')}</button>`).join('')}</div><div id="cnSalesEmpty" class="ch-empty" hidden>ไม่พบเอกสารขาย</div>`;
}
