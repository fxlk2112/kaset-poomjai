"use strict";

// A read-only projection of canonical activities. Never persist totals or consume stock here.
const materialHistoryFilters = new Map();
function materialHistoryNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
}
function materialHistoryCategory(item, task) {
  if (['chemical', 'fertilizer'].includes(item.category)) return item.category;
  if (item.category && !['other', 'materials'].includes(item.category)) return '';
  const stock = item.stockId ? stockById(S, item.stockId) : null;
  if (/ปุ๋ย/.test(stock?.category || '')) return 'fertilizer';
  if (/^(ยา|สาร)|ฮอร์โมน/.test(stock?.category || '')) return 'chemical';
  if (item.stockId || ['spray', 'fertilize'].includes(task.type)) return 'other';
  return '';
}
function materialHistoryItems(task) {
  const saved = task.costItems || [];
  const mismatch = saved.length > 0 && materialHistoryNumber(task.cost) !== null &&
    saved.every(item => materialHistoryNumber(item.totalCost) !== null) &&
    Math.abs(saved.reduce((sum, item) => sum + Number(item.totalCost), 0) - Number(task.cost)) > 0.011;
  let items = taskMaterialItems(task);
  // Old single-material activities predate costItems. Do not add their mirrored top-level fields again.
  if (!saved.length && task.stockId && !(task.reportedMaterials || []).length) {
    items = [{stockId: task.stockId, name: task.materialName, qty: task.qty, unit: task.unit,
      usageQty: task.usageQty, usageUnit: task.usageUnit, category: task.costCat,
      totalCost: task.cost, packageSize: task.packageSize}];
  } else if (!items.length && !saved.length && ['chemical', 'fertilizer'].includes(task.costCat)) {
    items = [{name: 'ไม่ระบุชื่อวัสดุ (บันทึกเดิม)', category: task.costCat, totalCost: task.cost}];
  }
  return items.map(item => {
    const stock = item.stockId ? stockById(S, item.stockId) : null;
    const category = materialHistoryCategory(item, task);
    const name = String(item.name || stock?.name || 'ไม่ระบุชื่อวัสดุ (บันทึกเดิม)').trim();
    return {...item, name, category, cost: mismatch ? null : materialHistoryNumber(item.totalCost), mismatch};
  }).filter(item => item.category);
}
function materialHistoryQuantity(item) {
  const rawUnit = String(item.usageUnit || item.unit || '').trim();
  const qty = materialHistoryNumber(item.usageUnit ? item.usageQty : item.qty);
  if (qty === null) return {qty: null, unit: rawUnit, key: 'unknown'};
  const family = sizeFamily(rawUnit);
  if (family) return {qty: qty * unitToBase(rawUnit), unit: family === 'volume' ? 'มล.' : 'กรัม', key: family};
  // Only a saved package snapshot can convert a historical package count. Never use today's stock size.
  const pack = parseStockSize(item.packageSize);
  if (rawUnit && pack && sizeFamily(pack.unit)) return materialHistoryQuantity({qty: qty * pack.amount, unit: pack.unit});
  const unit = rawUnit.replace(/\.+$/, '');
  return {qty, unit: unit || 'ไม่ระบุหน่วย', key: unit || 'unitless'};
}
function materialHistoryQuantityText(quantity) {
  if (quantity.qty === null) return 'ไม่ระบุปริมาณ';
  let {qty, unit} = quantity;
  if (quantity.key === 'volume' && Math.abs(qty) >= 1000) { qty /= 1000; unit = 'ลิตร'; }
  if (quantity.key === 'mass' && Math.abs(qty) >= 1000) { qty /= 1000; unit = 'กก.'; }
  const number = qty !== 0 && Math.abs(qty) < 0.001 ? '< 0.001' : qty.toLocaleString('th-TH', {maximumFractionDigits: 3});
  return number + ' ' + unit;
}
function materialHistoryModel(tasks, filter = {}) {
  const seen = new Set(), rows = [], planned = [];
  for (const task of tasks) {
    const identity = task.id || task;
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (task.status === 'failed') continue;
    const date = taskRecordDate(task);
    if (filter.month && !date.startsWith(filter.month)) continue;
    const items = materialHistoryItems(task).filter(item => !filter.category || item.category === filter.category);
    if (!items.length) continue;
    const row = {task, date, items};
    if (task.status === 'done') rows.push(row);
    else if (['planned', 'overdue'].includes(task.status)) planned.push(row);
  }
  rows.sort((a, b) => !a.date ? 1 : !b.date ? -1 : b.date.localeCompare(a.date));
  planned.sort((a, b) => !a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date));
  const products = new Map(), days = new Map();
  let cost = 0, missingCosts = 0;
  for (const row of rows) {
    if (!days.has(row.date)) days.set(row.date, []);
    days.get(row.date).push(row);
    for (const item of row.items) {
      if (item.cost === null) missingCosts++; else cost += item.cost;
      const key = item.name.normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('th-TH');
      if (!products.has(key)) products.set(key, {key, name: item.name, tasks: new Set(), rows: [], quantities: new Map(), cost: 0, missingCosts: 0, latest: ''});
      const product = products.get(key), quantity = materialHistoryQuantity(item);
      product.tasks.add(row.task.id || row.task);
      if (!product.rows.some(entry => entry.task === row.task)) product.rows.push({...row, items: []});
      product.rows.find(entry => entry.task === row.task).items.push(item);
      product.latest = row.date > product.latest ? row.date : product.latest;
      if (item.cost === null) product.missingCosts++; else product.cost += item.cost;
      if (!product.quantities.has(quantity.key)) product.quantities.set(quantity.key, {...quantity, qty: quantity.qty === null ? null : 0});
      if (quantity.qty !== null) product.quantities.get(quantity.key).qty += quantity.qty;
    }
  }
  return {rows, planned, days, products: [...products.values()].sort((a, b) => a.name.localeCompare(b.name, 'th')), cost, missingCosts};
}
function materialHistoryScope(plotId, fixedCycleId = '') {
  const key = fixedCycleId ? 'cycle:' + fixedCycleId : 'plot:' + plotId;
  const filter = materialHistoryFilters.get(key) || {};
  const cycles = S.cycles.filter(c => c.plotId === plotId).slice().sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  const chosen = fixedCycleId || filter.cycle || '';
  const cycleId = chosen === '__none__' || cycles.some(c => c.id === chosen) ? chosen : '';
  const tasks = S.tasks.filter(t => t.plotId === plotId && (cycleId === '__none__' ? !cycles.some(c => c.id === t.cycleId) : !cycleId || t.cycleId === cycleId));
  return {key, filter, cycles, cycleId, tasks};
}
function materialHistoryMoney(cost, missing = 0) {
  return (missing && !cost ? 'ยังไม่ระบุต้นทุน' : fmtMoney(Math.round(cost * 100) / 100) + ' บาท') + (missing && cost ? ' + ที่ยังไม่ระบุ' : '');
}
function materialHistoryRowsHtml(rows) {
  return rows.map(({task, items}) => {
    const cycle = cycleById(S, task.cycleId), photos = notebookPhotos(task).length;
    const sum = items.reduce((n, item) => n + (item.cost || 0), 0), missing = items.filter(item => item.cost === null).length;
    return `<article class="mh-activity"><header><div><h4>${esc(task.title || TYPE_LABELS[task.type] || 'บันทึกการใช้วัสดุ')}</h4><p>${cycle ? esc(cycle.plant) + ' · รอบ ' + esc(cycle.round || '—') : 'ไม่ผูกรอบปลูก'}${task.projectId && projectById(task.projectId) ? ' · ' + esc(projectCode(projectById(task.projectId))) : ''}</p></div><span class="mh-done">ทำแล้ว</span></header>
      <table class="mh-items"><thead><tr><th>ยา / ปุ๋ย</th><th>ใช้จริง</th><th>ค่าวัสดุ</th></tr></thead><tbody>${items.map(item => `<tr><th scope="row">${esc(item.name)}</th><td>${esc(materialHistoryQuantityText(materialHistoryQuantity(item)))}</td><td>${item.cost === null ? (item.mismatch ? 'ตรวจต้นทุนเดิม' : 'ไม่ระบุ') : fmtMoney(Math.round(item.cost * 100) / 100) + ' บาท'}</td></tr>`).join('')}</tbody></table>
      <footer><strong>ค่าวัสดุ ${esc(materialHistoryMoney(sum, missing))}</strong><button type="button" class="btn btn-outline btn-sm" onclick="${notebookAction('viewTask', task.id)}" aria-label="${esc('ดูรายละเอียดการใช้: ' + task.title)}">${photos ? notebookIcon('Image') + ' ' + photos + ' รูป · ' : ''}ดูรายละเอียด ${notebookIcon('ChevronRight')}</button></footer></article>`;
  }).join('');
}
function materialHistoryHtml(plotId, fixedCycleId = '') {
  const scope = materialHistoryScope(plotId, fixedCycleId), {key, filter, cycles, cycleId, tasks} = scope;
  const model = materialHistoryModel(tasks, filter), summary = filter.view === 'products';
  const months = [...new Set(tasks.filter(t => t.status !== 'failed' && materialHistoryItems(t).length).map(t => taskRecordDate(t).slice(0, 7)))].filter(Boolean).sort().reverse();
  const change = field => esc('App.materialHistoryFilter(' + JSON.stringify(key) + ',' + JSON.stringify(field) + ',this.value)');
  const options = (values, selected) => values.map(([value, label]) => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const monthValues = [['', 'ทุกเดือน'], ...months.map(month => [month, notebookMonth(month)])];
  if (filter.month && !months.includes(filter.month)) monthValues.push([filter.month, notebookMonth(filter.month)]);
  return `<section class="mh-panel" aria-label="ยาและปุ๋ยที่ใช้"><div class="mh-heading"><div><h2>ยาและปุ๋ยที่ใช้</h2><p>ดูสิ่งที่ใช้ในแปลง จากบันทึกกิจกรรมเดิม</p></div>${!fixedCycleId ? `<label class="mh-cycle">รอบปลูก<select aria-label="รอบปลูกสำหรับยาและปุ๋ย" onchange="${change('cycle')}">${options([['', 'ทุกรอบปลูก'], ...cycles.map(c => [c.id, (c.plant || 'รอบปลูก') + ' · รอบ ' + (c.round || '—') + (c.status === 'active' ? ' · กำลังปลูก' : ' · ปิดรอบ')]), ['__none__', 'ไม่ผูกรอบปลูก']], cycleId)}</select></label>` : ''}</div>
    <div class="mh-toolbar"><div class="mh-switch" role="group" aria-label="มุมมองยาและปุ๋ย">${[['dates', 'ตามวันที่ใช้', 'CalendarDays'], ['products', 'สรุปตามชื่อ', 'List']].map(([value, label, icon]) => `<button type="button" aria-pressed="${summary === (value === 'products')}" onclick="${notebookAction('materialHistoryFilter', key, 'view', value)}">${notebookIcon(icon)} ${label}</button>`).join('')}</div><div class="mh-filters"><select aria-label="ประเภทวัสดุที่ใช้" onchange="${change('category')}">${options([['', 'ยาและปุ๋ยทั้งหมด'], ['chemical', 'ยา / สาร'], ['fertilizer', 'ปุ๋ย'], ['other', 'วัสดุร่วม / ไม่ระบุหมวด']], filter.category || '')}</select><select aria-label="เดือนที่ใช้ยาและปุ๋ย" onchange="${change('month')}">${options(monthValues, filter.month || '')}</select></div></div>
    <div class="mh-totals" role="status"><span>ใช้แล้ว <strong>${model.rows.length} ครั้ง</strong></span><span><strong>${model.products.length} รายการ</strong></span><span>ค่าวัสดุตามที่เลือก <strong>${esc(materialHistoryMoney(model.cost, model.missingCosts))}</strong></span></div>
    <p class="mh-note">รวมเฉพาะงานที่ทำแล้ว · ไม่รวมค่าแรงและงานที่วางไว้${model.missingCosts ? ' · บางรายการยังไม่ระบุต้นทุน หรือยอดเดิมต้องตรวจสอบ' : ''}</p>
    ${summary ? `<div class="mh-products">${model.products.map(product => `<details class="mh-product"><summary><span class="mh-product-name"><strong>${esc(product.name)}</strong><small>ใช้ล่าสุด ${product.latest ? esc(dateLabel(product.latest)) : 'ไม่ระบุวันที่'}</small></span><span class="mh-product-qty"><small>ใช้รวม</small><strong>${[...product.quantities.values()].map(q => esc(materialHistoryQuantityText(q))).join('<br>')}</strong></span><span class="mh-product-count"><small>ใช้แล้ว</small><strong>${product.tasks.size} ครั้ง</strong></span><span class="mh-product-cost"><small>ค่าวัสดุรวม</small><strong>${esc(materialHistoryMoney(product.cost, product.missingCosts))}</strong></span><span class="mh-expand">${notebookIcon('ChevronDown')}</span></summary><div class="mh-product-history"><p>ประวัติการใช้ ${esc(product.name)}</p>${product.rows.map(row => `<h3>${row.date ? esc(dateLabel(row.date)) : 'ไม่ระบุวันที่ใช้'}</h3>${materialHistoryRowsHtml([row])}`).join('')}</div></details>`).join('')}</div>` : [...model.days].map(([date, rows]) => `<section class="mh-day"><h3>${notebookIcon('CalendarDays')} ${date ? esc(dateLabel(date)) : 'ไม่ระบุวันที่ใช้'} <small>${rows.length} งาน</small></h3>${materialHistoryRowsHtml(rows)}</section>`).join('')}
    ${!model.rows.length ? '<p class="mh-empty" role="status">ยังไม่มีการใช้ยาและปุ๋ยที่ทำแล้วตามตัวเลือกนี้</p>' : ''}
    ${model.planned.length ? `<details class="mh-planned"><summary>งานที่วางไว้ ${model.planned.length} งาน <span>ยังไม่รวมยอดใช้จริง</span></summary>${model.planned.map(({task, date, items}) => `<button type="button" onclick="${notebookAction('viewTask', task.id)}"><span><strong>${esc(task.title)}</strong><small>${date ? 'กำหนด ' + esc(dateLabel(date)) : 'ยังไม่กำหนดวัน'} · ${items.map(item => esc(item.name)).join(' · ')}</small></span>${notebookIcon('ChevronRight')}</button>`).join('')}</details>` : ''}
  </section>`;
}
App.materialHistoryFilter = function(key, field, value) {
  if (!['view', 'cycle', 'category', 'month'].includes(field)) return;
  const next = {...materialHistoryFilters.get(key), [field]: value};
  if (field === 'cycle') next.month = '';
  materialHistoryFilters.set(key, next);
  rerender();
};

// The restored page may have rendered before this deferred module arrived.
if (typeof route !== 'undefined' && ['plotDetail', 'cycleDetail'].includes(route.view) && typeof render === 'function') render();
