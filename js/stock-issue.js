/* Read-only stock issue history. Never changes stock or creates an activity. */
const StockIssue = (() => {
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((value + Number.EPSILON) * 10000) / 10000;
  const recordDate = task => String(task.doneDate || task.weatherSnapshot?.targetDate || task.date || "").slice(0, 10);
  const stockMode = item => item?.stockMode || "package";
  const deductedItems = task => (task.costItems || []).filter(item => item.stockId && num(item.qty) > 0 && stockMode(item) !== "record");

  function forDate(state, date) {
    const stock = new Map((state.stock || []).map(item => [String(item.id), item]));
    const plots = new Map((state.plots || []).map(plot => [String(plot.id), plot.name]));
    const entries = [], unverified = [];
    for (const task of state.tasks || []) {
      if (task.status !== "done" || recordDate(task) !== date) continue;
      const items = deductedItems(task);
      const logs = Array.isArray(task.stockLog) ? task.stockLog : [];
      if (!logs.length) {
        if (items.length || (task.stockId && num(task.qty) > 0 && task.stockState !== "untracked")) unverified.push(task);
        continue;
      }
      const queues = new Map();
      items.forEach(item => {
        const key = String(item.stockId);
        if (!queues.has(key)) queues.set(key, []);
        queues.get(key).push(item);
      });
      for (const log of logs) {
        const id = String(log.stockId || "");
        const item = (queues.get(id) || []).shift();
        const product = stock.get(id);
        const known = log.mainWithdrawn !== undefined && log.mainWithdrawn !== null && Number.isFinite(Number(log.mainWithdrawn));
        if (!known) { unverified.push(task); continue; }
        const used = item?.usageQty != null && num(item.usageQty) > 0 ? num(item.usageQty) : num(log.qty);
        const usedUnit = item?.usageQty != null && num(item.usageQty) > 0 ? (item.usageUnit || item.unit || product?.unit || "หน่วย") : (item?.unit || product?.unit || "หน่วย");
        entries.push({
          stockId: id, name: item?.name || product?.name || "สินค้าที่ลบจากสต็อก", code: product?.code || item?.code || "",
          unit: product?.unit || item?.unit || "หน่วย", withdrawn: round(num(log.mainWithdrawn)),
          used: round(used), usedUnit, plot: plots.get(String(task.plotId)) || (task.scope === "farm" ? "ทั้งฟาร์ม" : "ไม่ระบุแปลง"),
          title: task.title || task.type || "กิจกรรม", taskId: task.id, batchId: task.batchId || task.id
        });
      }
    }
    const products = new Map();
    for (const entry of entries) {
      const key = entry.stockId + "\u0000" + entry.unit;
      if (!products.has(key)) products.set(key, {stockId: entry.stockId, name: entry.name, code: entry.code, unit: entry.unit,
        withdrawn: 0, used: new Map(), plots: new Set(), activities: new Map()});
      const product = products.get(key);
      product.withdrawn = round(product.withdrawn + entry.withdrawn);
      product.used.set(entry.usedUnit, round((product.used.get(entry.usedUnit) || 0) + entry.used));
      product.plots.add(entry.plot);
      const batch = product.activities.get(entry.batchId) || {title: entry.title, plots: new Set()};
      batch.plots.add(entry.plot);
      product.activities.set(entry.batchId, batch);
    }
    const adjustments = (state.stock || []).flatMap(item => (item.adjustments || [])
      .filter(change => change.date === date && num(change.qty) < 0)
      .map(change => ({name: item.name, code: item.code || "", unit: item.unit || "หน่วย", qty: Math.abs(num(change.qty)), reason: change.reason || "ไม่ระบุเหตุผล"})));
    return {date, entries, products: [...products.values()].map(item => ({...item,
      used: [...item.used].map(([unit, qty]) => ({unit, qty})), plots: [...item.plots],
      activities: [...item.activities.values()].map(activity => ({title: activity.title, plots: [...activity.plots]}))})),
      adjustments, unverified: [...new Map(unverified.map(task => [task.id, task])).values()]};
  }

  function recordDates(state) {
    const dates = (state.tasks || []).filter(task => task.status === "done" &&
      ((Array.isArray(task.stockLog) && task.stockLog.length) || deductedItems(task).length || (task.stockId && num(task.qty) > 0 && task.stockState !== "untracked")))
      .map(recordDate).concat((state.stock || []).flatMap(item => (item.adjustments || []).filter(change => num(change.qty) < 0).map(change => change.date)));
    return [...new Set(dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort().reverse();
  }
  function latestDate(state, fallback) {
    return recordDates(state).find(date => date <= fallback) || fallback;
  }
  function filterHistory(reports, query = "", stockItems = []) {
    const q = String(query).trim().toLocaleLowerCase("th");
    if (!q) return reports;
    const stock = new Map(stockItems.map(item => [String(item.id), item.name || ""]));
    return reports.map(original => {
      const report = {...original};
      const matches = text => String(text || "").toLocaleLowerCase("th").includes(q);
      report.products = report.products.filter(item => matches(item.name) || matches(item.code) || item.plots.some(matches) ||
        item.activities.some(activity => matches(activity.title)));
      report.adjustments = report.adjustments.filter(item => matches(item.name) || matches(item.code) || matches(item.reason));
      report.unverified = report.unverified.filter(task => matches(task.title || task.type) ||
        (task.costItems || []).some(item => matches(item.name) || matches(stock.get(String(item.stockId)))));
      return report;
    }).filter(report => report.products.length || report.adjustments.length || report.unverified.length);
  }
  function history(state, query = "") {
    return filterHistory(recordDates(state).map(date => forDate(state, date)), query, state.stock || []);
  }
  return {forDate, latestDate, history, filterHistory};
})();
if (typeof module !== "undefined") module.exports = StockIssue;

if (typeof App !== "undefined") {
let stockIssueDate = "";
let stockIssueMode = "all";
let stockIssueQuery = "";
let stockIssueDays = [];
function stockIssueNum(value) { return Number(value).toLocaleString("th-TH", {maximumFractionDigits: 4}); }
function stockIssueUsed(product) { return product.used.map(item => `${stockIssueNum(item.qty)} ${item.unit}`).join(" + ") || "—"; }
function stockIssueProductHtml(product, index) {
  return `<div class="stock-issue-product">
    <div class="stock-issue-product-head"><strong>${index + 1}. ${esc(product.name)}</strong>${product.code ? `<small>รหัส ${esc(product.code)}</small>` : ""}</div>
    <div class="stock-issue-amounts"><div><span>หยิบจากสต็อกหลัก</span><b>${stockIssueNum(product.withdrawn)} ${esc(product.unit)}</b></div><div><span>ใช้จริง</span><b>${esc(stockIssueUsed(product))}</b></div></div>
    <div class="stock-issue-context">${product.withdrawn === 0 ? "ใช้ของที่เปิดไว้แล้ว · ไม่หยิบหน่วยใหม่จากสต็อกหลัก · " : ""}แปลง ${esc(product.plots.join(", "))}</div>
    <details><summary>ดูกิจกรรม ${product.activities.length} รายการ</summary>${product.activities.map(activity => `<div class="stock-issue-activity">${esc(activity.title)} · ${esc(activity.plots.join(", "))}</div>`).join("")}</details>
  </div>`;
}
function stockIssueReviewHtml(report) {
  return `${report.adjustments.length ? `<section class="stock-issue-review"><h4>ปรับลดสต็อกแยกจากกิจกรรม</h4><p>ไม่มีข้อมูลว่าใช้กับแปลงไหน จึงไม่รวมในใบเบิกอัตโนมัติ</p>${report.adjustments.map(item => `<div>${esc(item.name)} · ${stockIssueNum(item.qty)} ${esc(item.unit)} · ${esc(item.reason)}</div>`).join("")}</section>` : ""}
    ${report.unverified.length ? `<section class="stock-issue-review"><h4>กิจกรรมเก่าที่ต้องตรวจ ${report.unverified.length} รายการ</h4><p>ไม่พบหลักฐานจำนวนที่หยิบจากสต็อกหลัก จึงไม่เดาปริมาณลงใบพิมพ์</p>${report.unverified.map(task => `<div>${esc(task.title || task.type || "กิจกรรม")}</div>`).join("")}</section>` : ""}`;
}
function stockIssueResultsHtml() {
  if (stockIssueMode === "date") {
    const report = StockIssue.forDate(S, stockIssueDate);
    return `<div class="stock-issue-summary">${esc(dateLabel(stockIssueDate))} · ${report.products.length} สินค้า · ${report.entries.length} รายการตัดสต็อก</div>
      ${report.products.length ? report.products.map(stockIssueProductHtml).join("") : `<div class="empty"><div class="e-title">ไม่มีรายการตัดสต็อกในวันนี้</div><div class="muted">เลือกวันอื่น หรือกลับไปดูรายการทั้งหมด</div></div>`}
      ${stockIssueReviewHtml(report)}`;
  }
  const days = StockIssue.filterHistory(stockIssueDays, stockIssueQuery, S.stock || []);
  const allDays = stockIssueDays.length;
  const productCount = days.reduce((sum, day) => sum + day.products.length, 0);
  return `<div class="stock-issue-summary">${stockIssueQuery.trim() ? `พบ ${days.length} วัน · ${productCount} รายการสินค้า` : `${allDays} วัน · ${productCount} รายการสินค้า`}</div>
    ${days.length ? days.map(day => `<section class="stock-issue-day"><div class="stock-issue-day-head"><h4>${esc(dateLabel(day.date))}</h4><button class="btn btn-sm btn-ghost" onclick="App.stockIssueFilterDate('${day.date}')">ดูเฉพาะวันนี้</button></div>
      ${day.products.map(stockIssueProductHtml).join("")}${stockIssueReviewHtml(day)}</section>`).join("") : `<div class="empty"><div class="e-title">${stockIssueQuery.trim() ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีประวัติตัดสต็อก"}</div><div class="muted">${stockIssueQuery.trim() ? "ลองค้นด้วยชื่อสินค้า รหัส กิจกรรม หรือแปลง" : "กิจกรรมที่ทำเสร็จและตัดสต็อกจะปรากฏที่นี่"}</div></div>`}`;
}
function stockIssueRender() {
  openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("calendar")} ใบเบิกย้อนหลัง</h3>
    <div class="modal-sub">แสดงของที่ใช้จากสต็อกตามวันที่ทำจริง · ดูย้อนหลังได้โดยไม่ตัดสต็อกซ้ำ</div>
    <div class="stock-issue-modes" role="group" aria-label="ช่วงรายการ"><button class="${stockIssueMode === "all" ? "is-active" : ""}" aria-pressed="${stockIssueMode === "all"}" onclick="App.stockIssueAll()">ทั้งหมด</button><button class="${stockIssueMode === "date" ? "is-active" : ""}" aria-pressed="${stockIssueMode === "date"}" onclick="App.stockIssueFilterDate()">เฉพาะวัน</button></div>
    ${stockIssueMode === "all" ? `<label class="stock-issue-search">${ic("search")}<input id="stockIssueSearch" type="search" placeholder="ค้นหาชื่อยา รหัส กิจกรรม หรือแปลง" aria-label="ค้นหาประวัติใช้วัสดุ" value="${esc(stockIssueQuery)}" oninput="App.stockIssueSearch(this.value)"></label>` : `<div class="stock-issue-controls"><button class="btn btn-ghost icon-action" title="วันก่อนหน้า" aria-label="วันก่อนหน้า" onclick="App.stockIssueShift(-1)">‹</button>
      <label>วันที่ใช้จริง<input type="date" value="${esc(stockIssueDate)}" max="${todayISO()}" onchange="App.stockIssueFilterDate(this.value)"></label>
      <button class="btn btn-ghost icon-action" title="วันถัดไป" aria-label="วันถัดไป" ${stockIssueDate >= todayISO() ? "disabled" : ""} onclick="App.stockIssueShift(1)">›</button></div>`}
    <div id="stockIssueResults">${stockIssueResultsHtml()}</div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>${stockIssueMode === "date" ? `<button class="btn btn-primary stock-issue-print-btn" ${StockIssue.forDate(S, stockIssueDate).products.length ? "" : "disabled"} onclick="App.stockIssuePrint()">${ic("printer")} พิมพ์ / บันทึก PDF</button>` : ""}</div>`);
}
App.stockIssueOpen = function () {
  stockIssueDate = StockIssue.latestDate(S, todayISO());
  stockIssueMode = "all";
  stockIssueQuery = "";
  stockIssueDays = StockIssue.history(S);
  stockIssueRender();
};
App.stockIssueAll = function () {
  stockIssueMode = "all";
  stockIssueDays = StockIssue.history(S);
  stockIssueRender();
};
App.stockIssueFilterDate = function (date) {
  stockIssueDate = /^\d{4}-\d{2}-\d{2}$/.test(date || "") && date <= todayISO() ? date : (stockIssueDate || StockIssue.latestDate(S, todayISO()));
  stockIssueMode = "date";
  stockIssueQuery = "";
  stockIssueRender();
};
App.stockIssueSearch = function (value) {
  stockIssueQuery = value;
  const results = document.getElementById("stockIssueResults");
  if (results) results.innerHTML = stockIssueResultsHtml();
};
App.stockIssueShift = function (days) {
  const date = new Date(stockIssueDate + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return;
  date.setUTCDate(date.getUTCDate() + days);
  const next = date.toISOString().slice(0, 10);
  if (next <= todayISO()) App.stockIssueFilterDate(next);
};
App.stockIssuePrint = function () {
  if (stockIssueMode !== "date") return;
  const report = StockIssue.forDate(S, stockIssueDate);
  if (!report.products.length) return;
  document.getElementById("stockIssuePrintArea")?.remove();
  const area = document.createElement("section");
  area.id = "stockIssuePrintArea";
  area.innerHTML = `<h1>สรุปการเบิกและใช้วัสดุ</h1><p>วันที่ทำจริง ${esc(dateLabel(stockIssueDate))}</p>
    <table><thead><tr><th>ลำดับ</th><th>รหัส</th><th>รายการ</th><th>หยิบจากสต็อกหลัก</th><th>ใช้จริง</th><th>แปลง</th></tr></thead>
    <tbody>${report.products.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.code || "—")}</td><td>${esc(item.name)}</td><td>${stockIssueNum(item.withdrawn)} ${esc(item.unit)}</td><td>${esc(stockIssueUsed(item))}</td><td>${esc(item.plots.join(", "))}</td></tr>`).join("")}</tbody></table>
    <p class="stock-issue-print-note">รายการที่หยิบ 0 หน่วย ใช้จากของที่เปิดไว้แล้ว · ไม่รวมการปรับลดสต็อกที่ไม่ได้ผูกกับกิจกรรม</p>
    <div class="stock-issue-signatures"><div>ผู้เบิก ............................................</div><div>ผู้ให้เบิก ............................................</div></div>`;
  document.body.appendChild(area);
  const cleanup = () => { document.body.classList.remove("stock-issue-printing"); area.remove(); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  document.body.classList.add("stock-issue-printing");
  window.print();
};
}
