/* Read-only, sheet-like view of the farm's existing activity records. */
(function (root) {
  'use strict';

  const TYPE_LABELS_LOCAL = {
    work: 'งานทั่วไป', spray: 'ฉีดยา', fertilize: 'ใส่ปุ๋ย',
    harvest: 'เก็บเกี่ยว', water: 'รดน้ำ', inspect: 'ตรวจแปลง', expense: 'ค่าใช้จ่าย'
  };
  const COST_LABELS = {
    labor: 'ค่าจ้างแรงงานชั่วคราว', pilot: 'ค่าแรงนักบิน', meals: 'ค่าอาหารและเครื่องดื่ม',
    chemical: 'ค่าสารเคมีทางการเกษตร', fertilizer: 'ค่าปุ๋ยเคมี', seed: 'ค่าเมล็ดพันธุ์',
    materials: 'ค่าวัสดุอุปกรณ์', utilities: 'ค่าไฟ', other: 'ค่าใช้จ่ายอื่น ๆ'
  };
  const day = value => String(value || '').slice(0, 10);
  const money = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const quantity = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('th-TH', { maximumFractionDigits: 4 });
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function ageDays(start, date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day(start)) || !/^\d{4}-\d{2}-\d{2}$/.test(day(date))) return null;
    const diff = (Date.parse(day(date) + 'T00:00:00Z') - Date.parse(day(start) + 'T00:00:00Z')) / 86400000;
    return Number.isInteger(diff) && diff >= 0 ? diff : null;
  }
  function dateLabel(iso) {
    const match = day(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
  }
  function rowsFromState(state) {
    const plots = new Map((state.plots || []).map(plot => [plot.id, plot]));
    const cycles = new Map((state.cycles || []).map(cycle => [cycle.id, cycle]));
    const stock = new Map((state.stock || []).map(item => [item.id, item]));
    const categories = { ...COST_LABELS, ...Object.fromEntries((state.customCostCats || []).map(cat => [cat.key, cat.label])) };
    const rows = [];
    for (const task of state.tasks || []) {
      if (task.status !== 'done') continue;
      const date = day(task.doneDate || task.date);
      const plot = plots.get(task.plotId);
      const cycle = cycles.get(task.cycleId);
      const base = {
        taskId: String(task.id || ''), date, plotId: task.plotId || '', cycleId: task.cycleId || '',
        plot: plot ? plot.name : 'งานส่วนกลาง', cycle: cycle ? cycle.plant : '',
        age: cycle ? ageDays(cycle.startDate, date) : null,
        title: task.title || TYPE_LABELS_LOCAL[task.type] || 'กิจกรรม',
        area: Number(task.materialAreaRai) > 0 ? Number(task.materialAreaRai) : null,
        note: [task.note, task.doneNote].filter(Boolean).join(' · ')
      };
      let hasMoney = false;
      for (const [index, item] of (task.costItems || []).entries()) {
        const stocked = item.stockId ? stock.get(item.stockId) : null;
        const cost = Number(item.totalCost);
        const knownCost = item.totalCost !== '' && item.totalCost !== null && item.totalCost !== undefined && Number.isFinite(cost);
        if (knownCost && cost > 0) hasMoney = true;
        rows.push({ ...base, key: `${base.taskId}:cost:${index}`, kind: knownCost && cost > 0 ? 'รายจ่าย' : 'ใช้วัสดุ',
          topic: item.name || stocked?.name || base.title,
          costType: categories[item.category] || item.category || '', chemicalType: stocked?.category || '',
          description: base.title, qty: item.usageQty ?? item.qty ?? null, unit: item.usageUnit || item.unit || '',
          pack: item.externalPackQty ?? item.packageSize ?? null,
          used: item.usageQty ?? item.qty ?? null,
          unitPrice: item.externalPackPrice ?? item.unitCost ?? null,
          amount: knownCost && cost > 0 ? -cost : null,
          source: item.stockId ? 'จากสต็อก' : 'พิมพ์เอง' });
      }
      if (!(task.costItems || []).length && Number(task.cost) > 0) {
        hasMoney = true;
        rows.push({ ...base, key: `${base.taskId}:cost`, kind: 'รายจ่าย', topic: base.title,
          costType: categories[task.costCat] || '', chemicalType: '', description: base.title,
          qty: task.qty ?? null, unit: task.unit || '', pack: null, used: task.qty ?? null,
          unitPrice: null, amount: -Number(task.cost), source: 'ต้นทุนกิจกรรม' });
      }
      if (Number(task.revenue) > 0) {
        hasMoney = true;
        rows.push({ ...base, key: `${base.taskId}:revenue`, kind: 'รายได้', topic: base.title,
          costType: '', chemicalType: '', description: base.title,
          qty: task.harvestQty ?? null, unit: '', pack: null, used: task.harvestQty ?? null,
          unitPrice: task.harvestUnitPrice ?? null, amount: Number(task.revenue), source: 'กิจกรรม' });
      }
      if (!hasMoney && !(task.costItems || []).length) {
        rows.push({ ...base, key: `${base.taskId}:activity`, kind: 'กิจกรรม', topic: base.title,
          costType: '', chemicalType: '', description: TYPE_LABELS_LOCAL[task.type] || '',
          qty: null, unit: '', pack: null, used: null, unitPrice: null, amount: null, source: 'กิจกรรม' });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.plot.localeCompare(b.plot, 'th') || a.key.localeCompare(b.key));
  }

  const preview = {
    rowsFromState,
    rows: [],
    render(state) {
      this.rows = rowsFromState(state);
      const plotOptions = [...new Set(this.rows.map(row => row.plotId))];
      const cell = value => `<td>${escapeHtml(value === '' || value == null ? '—' : value)}</td>`;
      const rowHtml = (row, index) => `<tr data-ledger-index="${index}">
        <td class="ledger-date">${escapeHtml(dateLabel(row.date))}</td>
        ${cell(row.plot)}<td data-ledger-extra>${escapeHtml(row.cycle || '—')}</td><td data-ledger-extra>${escapeHtml(row.age == null ? '—' : `${row.age} วัน`)}</td>
        <td><span class="ledger-kind ledger-${row.kind === 'รายจ่าย' ? 'cost' : row.kind === 'รายได้' ? 'income' : 'activity'}">${escapeHtml(row.kind)}</span></td>
        <td class="ledger-topic"><button type="button" data-ledger-task="${escapeHtml(row.taskId)}" onclick="LedgerPreview.open(this.dataset.ledgerTask)">${escapeHtml(row.topic)}</button><small>${escapeHtml(row.source)}</small></td>
        <td class="ledger-num">${quantity(row.qty)}</td>${cell(row.unit)}
        <td class="ledger-num ledger-amount ${row.amount < 0 ? 'negative' : row.amount > 0 ? 'positive' : ''}">${row.amount == null ? '—' : money(row.amount)}</td>
        <td data-ledger-extra>${escapeHtml(row.costType || '—')}</td><td data-ledger-extra>${escapeHtml(row.chemicalType || '—')}</td><td data-ledger-extra>${escapeHtml(row.description || '—')}</td><td data-ledger-extra>${row.area == null ? '—' : `${quantity(row.area)} ไร่`}</td>
        <td class="ledger-num" data-ledger-extra>${quantity(row.pack)}</td><td class="ledger-num" data-ledger-extra>${quantity(row.used)}</td><td class="ledger-num" data-ledger-extra>${quantity(row.unitPrice)}</td>
        ${cell(row.note)}</tr>`;
      const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      return `<section class="ledger-preview" aria-label="สมุดฟาร์มแบบตาราง">
        <div class="ledger-head"><div><p class="ledger-eyebrow">ตัวอย่างมุมมองตาราง · อ่านจากข้อมูลเว็บ</p><h1>สมุดฟาร์ม</h1><p>รูปแบบตารางอ้างอิงจาก Farm Record ใน Lark · ข้อมูลในหน้านี้อ่านอย่างเดียวและอัปเดตตามกิจกรรมที่บันทึกในเว็บ</p></div><button class="btn btn-outline" onclick="App.nav('analytics')">กลับรายงาน</button></div>
        <div class="ledger-summary"><div><span>รายการที่แสดง</span><strong id="ledgerCount">0</strong></div><div><span>ต้นทุน</span><strong id="ledgerCost">0.00</strong></div><div><span>รายได้</span><strong id="ledgerRevenue">0.00</strong></div><div><span>ส่วนต่าง</span><strong id="ledgerNet">0.00</strong></div></div>
        <div class="ledger-controls"><label>แปลง<select id="ledgerPlot" onchange="LedgerPreview.apply()">${option('', 'ทุกแปลงและงานส่วนกลาง')}${plotOptions.map(id => option(id, this.rows.find(row => row.plotId === id)?.plot || 'งานส่วนกลาง')).join('')}</select></label>
          <label>ประเภท<select id="ledgerKind" onchange="LedgerPreview.apply()">${option('', 'ทุกประเภท')}${['รายจ่าย','รายได้','ใช้วัสดุ','กิจกรรม'].map(kind => option(kind, kind)).join('')}</select></label>
          <label>ตั้งแต่<input type="date" id="ledgerFrom" onchange="LedgerPreview.apply()"></label><label>ถึง<input type="date" id="ledgerTo" onchange="LedgerPreview.apply()"></label>
          <label class="ledger-search">ค้นหา<input id="ledgerSearch" type="search" placeholder="ชื่องาน ยา ปุ๋ย แปลง" oninput="LedgerPreview.apply()"></label></div>
        <div class="ledger-table-head"><p class="ledger-guide">หนึ่งงานที่ใช้หลายรายการจะแยกเป็นหลายแถว · ต้นทุนเป็นต้นทุนกิจกรรม ไม่ใช่ยอดเงินสดที่จ่าย</p><button class="btn btn-outline btn-sm" id="ledgerDetailButton" type="button" aria-pressed="false" onclick="LedgerPreview.toggleDetail()">ดูทุกคอลัมน์</button></div>
        <p class="ledger-swipe-hint">ปัดตารางไปทางซ้ายเพื่อดูจำนวนและยอดเงิน →</p>
        <div class="ledger-scroll" id="ledgerScroll" tabindex="0" aria-label="เลื่อนตารางซ้ายขวาเพื่อดูทุกคอลัมน์"><table><thead><tr><th>วันที่บันทึก</th><th>แปลง</th><th data-ledger-extra>รอบปลูก</th><th data-ledger-extra>อายุพืช</th><th>ประเภท</th><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>รวม (บาท)</th><th data-ledger-extra>ประเภทต้นทุน</th><th data-ledger-extra>ประเภทสาร</th><th data-ledger-extra>คำอธิบายกิจกรรม</th><th data-ledger-extra>พื้นที่ทำจริง</th><th data-ledger-extra>ปริมาณ/ขวด</th><th data-ledger-extra>ใช้ทั้งหมด</th><th data-ledger-extra>ราคาอ้างอิง</th><th>หมายเหตุ</th></tr></thead><tbody id="ledgerBody">${this.rows.map(rowHtml).join('')}</tbody></table></div>
        <div class="ledger-empty" id="ledgerEmpty" hidden>ไม่พบรายการตามตัวกรอง</div>
        <p class="ledger-footnote">ตัวเลขและหน่วยแสดงตามที่บันทึกไว้ในเว็บ ช่องว่างหมายถึงไม่มีข้อมูล ไม่ได้แทนด้วยศูนย์ · ยังไม่ได้ส่งรายการไป Lark อัตโนมัติ</p>
      </section>`;
    },
    apply() {
      const get = id => document.getElementById(id)?.value || '';
      const plot = get('ledgerPlot'), kind = get('ledgerKind'), from = get('ledgerFrom'), to = get('ledgerTo');
      const query = get('ledgerSearch').trim().toLocaleLowerCase('th');
      let count = 0, cost = 0, revenue = 0;
      document.querySelectorAll('#ledgerBody tr').forEach(tr => {
        const row = this.rows[Number(tr.dataset.ledgerIndex)];
        const search = `${row.plot} ${row.cycle} ${row.title} ${row.topic} ${row.costType} ${row.description} ${row.note}`.toLocaleLowerCase('th');
        const show = (!plot || row.plotId === plot) && (!kind || row.kind === kind)
          && (!from || row.date >= from) && (!to || row.date <= to) && (!query || search.includes(query));
        tr.hidden = !show;
        if (show) { count++; if (row.amount < 0) cost -= row.amount; else if (row.amount > 0) revenue += row.amount; }
      });
      document.getElementById('ledgerCount').textContent = String(count);
      document.getElementById('ledgerCost').textContent = money(cost);
      document.getElementById('ledgerRevenue').textContent = money(revenue);
      document.getElementById('ledgerNet').textContent = money(revenue - cost);
      document.getElementById('ledgerEmpty').hidden = count > 0;
    },
    toggleDetail() {
      const scroll = document.getElementById('ledgerScroll');
      const button = document.getElementById('ledgerDetailButton');
      const expanded = scroll.classList.toggle('show-detail');
      button.setAttribute('aria-pressed', String(expanded));
      button.textContent = expanded ? 'ซ่อนคอลัมน์เสริม' : 'ดูทุกคอลัมน์';
    },
    open(taskId) { if (root.App && typeof root.App.viewTask === 'function') root.App.viewTask(taskId); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = preview;
  else root.LedgerPreview = preview;
})(typeof window !== 'undefined' ? window : globalThis);
