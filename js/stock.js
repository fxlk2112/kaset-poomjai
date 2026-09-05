/* ---------------- Stock ---------------- */
let stockFilter = "all"; // all | sealed | opened
let stockQuery = "";    // คำค้นหาชื่อ/หน่วย/หมวด
let stockCat = "";      // หมวดสินค้าที่กรอง ("" = ทั้งหมด, "__none__" = ไม่มีหมวด)
let stockViewKey = "own"; // own | shared:<owner email>
let stockPhotoFilter = "all"; // all | with | missing
let stockDensity = "compact"; // compact | detail

function stockShareState() {
  if (!App._stockShares) App._stockShares = { outgoing: [], incoming: [] };
  return App._stockShares;
}
function stockIsSharedView() {
  return String(stockViewKey || "own").startsWith("shared:");
}
function stockViewOwnerEmail() {
  return stockIsSharedView() ? String(stockViewKey).slice("shared:".length) : "";
}
function stockActiveList() {
  if (!stockIsSharedView()) return S.stock || [];
  const cached = App._stockSharedCache && App._stockSharedCache[stockViewOwnerEmail()];
  return cached && Array.isArray(cached.stock) ? cached.stock : [];
}
function stockActiveById(id) {
  return stockActiveList().find(x => String(x.id) === String(id));
}
function stockListValue(list) {
  return (list || []).reduce((a, x) => a + ((Number(x.qty) || 0) + (Number(x.openQty) || 0)) * (Number(x.avgCost) || 0), 0);
}
function stockSourceLabel(email) {
  if (!email) return "สต็อกของฉัน";
  const src = (stockShareState().incoming || []).find(x => String(x.email || "").toLowerCase() === String(email).toLowerCase());
  return (src && (src.name || src.email)) || email;
}
function jsArg(v) {
  return JSON.stringify(String(v == null ? "" : v)).replace(/</g, "\\u003c");
}
function stockSourceSelectHtml() {
  const incoming = stockShareState().incoming || [];
  const options = [`<option value="own" ${stockViewKey === "own" ? "selected" : ""}>สต็อกของฉัน (${(S.stock || []).length})</option>`]
    .concat(incoming.map(src => {
      const email = String(src.email || "");
      const n = src.summary && Number(src.summary.items) || 0;
      return `<option value="shared:${esc(email)}" ${stockViewOwnerEmail() === email ? "selected" : ""}>${esc(src.name || email)} (${n})</option>`;
    }));
  return `
    <div class="stock-source-row">
      <select class="stock-source-select" onchange="App.stockViewSet(this.value)" aria-label="เลือกสต็อก">
        ${options.join("")}
      </select>
      ${stockIsSharedView() ? `<span class="stock-readonly">${ic("eye")} อ่านอย่างเดียว</span>` : ""}
      <button class="btn btn-sm btn-ghost" onclick="App.stockShareRefresh()">${ic("refresh")} รีเฟรช</button>
    </div>`;
}
function stockPhotoError(img) {
  const box = img && img.closest ? img.closest(".stock-thumb") : null;
  if (box) box.innerHTML = ic("box");
  else if (img) img.remove();
}
function stockThumbHtml(x) {
  const photo = firstStockPhoto(x);
  return photo ? `<img src="${esc(stockPhotoSrc({ photo }))}" alt="" loading="lazy" onerror="stockPhotoError(this)">` : ic("box");
}
function stockPriceShort(v) {
  return Number(v) > 0 ? fmtMoney(v) : "ยังไม่ตั้ง";
}
function stockPriceSummaryHtml(x) {
  return `<div class="muted stock-meta-line stock-price-line">ทุน ${stockPriceShort(x.avgCost)} · ทั่วไป ${stockPriceShort(x.salePrice)} · ประจำ ${stockPriceShort(x.memberPrice)}</div>`;
}
function stockPriceRow(label, value, unit) {
  return `<div class="sd-row"><span class="k">${label}</span><span class="bold">${Number(value) > 0 ? `${fmtMoney(value)} บาท/${esc(unit)}` : `<span class="muted">ยังไม่ตั้งราคา</span>`}</span></div>`;
}
function stockHasPhoto(x) {
  return stockPhotos(x).length > 0;
}
/* HTML รายการสต็อก (กรองตามแท็บ + คำค้น) — แยกเป็นฟังก์ชันเพื่ออัปเดตเฉพาะส่วนนี้ ไม่ rebuild ทั้งหน้า */
function stockListHtml() {
  const q = stockQuery.trim().toLowerCase();
  const readonly = stockIsSharedView();
  const list = stockActiveList().filter(x => {
    const open = Number(x.openQty) || 0;
    const avail = (Number(x.qty) || 0) + open;
    if (stockFilter === "has" && avail <= 0) return false;
    if (stockFilter === "out" && avail > 0) return false;
    if (stockFilter === "sealed" && open > 0) return false;
    if (stockFilter === "opened" && open <= 0) return false;
    if (stockCat === "__none__" && x.category) return false;
    if (stockCat && stockCat !== "__none__" && x.category !== stockCat) return false;
    const hasPhoto = stockHasPhoto(x);
    if (stockPhotoFilter === "with" && !hasPhoto) return false;
    if (stockPhotoFilter === "missing" && hasPhoto) return false;
    if (q && !(x.name.toLowerCase().includes(q) || (x.code || "").toLowerCase().includes(q) || x.unit.toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q) || (x.generic || "").toLowerCase().includes(q) || (x.supplier || "").toLowerCase().includes(q))) return false;
    return true;
  });
  const emptyTitle = q ? "ไม่พบรายการที่ค้นหา" : (stockPhotoFilter === "missing" ? "ทุกรายการมีรูปแล้ว" : (stockPhotoFilter === "with" ? "ยังไม่มีรายการที่มีรูป" : (stockCat ? "ไม่มีของในหมวดนี้" : (stockFilter === "has" ? "ยังไม่มีของในสต็อก" : (stockFilter === "out" ? "ไม่มีของที่หมด" : (stockFilter === "sealed" ? "ไม่มีของที่ยังไม่เปิดใช้" : "ไม่มีของที่เปิดใช้แล้ว"))))));
  const emptySub = q ? "ลองค้นด้วยชื่อ หรือรหัสสินค้า (เช่น 00-0000-269)" : (stockPhotoFilter === "missing" ? "พร้อมใช้งานครบเรื่องรูปสินค้าแล้ว" : (stockPhotoFilter === "with" ? "กดเพิ่มรูปในรายละเอียดสินค้าเพื่อเริ่มเก็บรูป" : (stockCat ? "ลองเลือกหมวดอื่น หรือกด 'ทุกหมวดสินค้า'" : (stockFilter === "has" ? "กด รับของเข้า เพื่อเพิ่มของเข้าสต็อก" : (stockFilter === "opened" ? "เมื่อใช้ของไม่หมด จะมีของเหลือจากการเปิดใช้ที่นี่" : "")))));
  const emptyHtml = list.length === 0 ? `<div class="card"><div class="empty"><div class="e-ico">${ic("box")}</div><div class="e-title">${emptyTitle}</div>${emptySub ? `<div class="muted">${emptySub}</div>` : ""}</div></div>` : "";
  const grid = `<div class="card-grid stock-grid stock-grid-${stockDensity}">
    ${list.map(x => {
      const open = Number(x.openQty) || 0;
      const out = (Number(x.qty) || 0) + open <= 0; // ยาหมด
      const hasPhoto = stockHasPhoto(x);
      return `
      <div class="card stock-card stock-card-${stockDensity} ${out ? "stock-card-out" : ""} ${hasPhoto ? "has-photo" : "missing-photo"}">
        <div class="row">
          <div class="stock-thumb" onclick="App.stockDetail('${x.id}')" title="กดดูรายละเอียดสินค้า">${stockThumbHtml(x)}</div>
          <div class="grow">
            <div class="plot-name" onclick="App.stockDetail('${x.id}')" title="กดดูรายละเอียดสินค้า">${esc(x.name)} ${out ? `<span class="stock-out-badge">${ic("alert")} ยาหมด</span>` : `<span class="stock-detail-hint">${ic("info")}</span>`} ${hasPhoto ? "" : `<span class="stock-photo-missing">${ic("image")} ไม่มีรูป</span>`} ${x.category ? `<span class="stock-cat">${esc(x.category)}</span>` : ""} ${x.size ? `<span class="stock-size">${esc(x.size)}</span>` : ""}</div>
            ${x.code ? `<div class="muted stock-meta-line">รหัส: <b>${esc(x.code)}</b></div>` : ""}
            ${x.generic ? `<div class="muted stock-meta-line stock-meta-secondary">ชื่อสามัญ: ${esc(x.generic)}</div>` : ""}
            ${x.supplier ? `<div class="muted stock-meta-line stock-meta-secondary">บริษัทจำหน่าย: ${esc(x.supplier)}</div>` : ""}
            ${stockPriceSummaryHtml(x)}
            ${out ? `<div class="stock-out">${ic("alert")} ยาหมด — ไม่มีของในสต็อก</div>` : (open > 0 ? `<div class="stock-open">${ic("unlock")} เหลือจากการเปิดใช้ ${fmtNum(open)} ${esc(x.unit)} — ใช้ได้ก่อน</div>` : `<div class="stock-sealed">${ic("lock")} ยังไม่เปิดใช้</div>`)}
          </div>
          <div class="stock-qty ${out ? "out" : ""}">${out ? "0" : fmtNum(x.qty)} <small>${esc(x.unit)}</small></div>
        </div>
        <div class="mt-8">
          <div class="muted stock-value">มูลค่ารวม <span class="bold">${fmtMoney((x.qty + open) * x.avgCost)} บาท</span>${open > 0 ? ` <span class="muted">(รวมของเปิดใช้แล้ว)</span>` : ""}</div>
          <div class="stock-actions">
            ${readonly ? `<span class="stock-readonly">${ic("eye")} ดูจาก ${esc(stockSourceLabel(stockViewOwnerEmail()))}</span>` : `
              <button class="btn btn-sm btn-primary" onclick="App.modalReceive('${x.id}')">${ic("down")} รับของเข้า</button>
              <button class="btn btn-sm btn-outline" onclick="App.modalDeduct('${x.id}')">${ic("minus")} ตัดสต็อก</button>
              <button class="btn btn-sm btn-ghost stock-secondary-action" onclick="App.stockDetail('${x.id}')">${ic("info")} รายละเอียด</button>
              <button class="btn btn-sm btn-ghost stock-secondary-action" onclick="App.modalStock('${x.id}')" title="แก้ไขรายการ">${ic("pencil")} แก้ไข</button>
            `}
          </div>
        </div>
      </div>`;
    }).join("")}
    </div>`;
  return emptyHtml + grid;
}
function stockFilterOptionsHtml() {
  const data = stockActiveList();
  const openedCount = data.filter(x => (Number(x.openQty) || 0) > 0).length;
  const sealedCount = data.length - openedCount;
  const hasCount = data.filter(x => (Number(x.qty) || 0) + (Number(x.openQty) || 0) > 0).length;
  const outCount = data.length - hasCount;
  const rows = [
    ["all", "ทั้งหมด", data.length],
    ["has", "มีของ", hasCount],
    ["out", "ยาหมด", outCount],
    ["sealed", "ยังไม่เปิดใช้", sealedCount],
    ["opened", "เปิดใช้แล้ว", openedCount]
  ];
  return rows.map(([key, label, count]) => `<option value="${key}" ${stockFilter === key ? "selected" : ""}>${label} (${fmtNum(count)})</option>`).join("");
}
function stockPhotoOptionsHtml() {
  const data = stockActiveList();
  const withCount = data.filter(stockHasPhoto).length;
  const missingCount = data.length - withCount;
  const rows = [
    ["all", "ทุกรูปภาพ", data.length],
    ["with", "มีรูปแล้ว", withCount],
    ["missing", "ยังไม่มีรูป", missingCount]
  ];
  return rows.map(([key, label, count]) => `<option value="${key}" ${stockPhotoFilter === key ? "selected" : ""}>${label} (${fmtNum(count)})</option>`).join("");
}
function stockFilterLabel() {
  const map = { all: "ทั้งหมด", has: "มีของ", out: "ยาหมด", sealed: "ยังไม่เปิดใช้", opened: "เปิดใช้แล้ว" };
  return map[stockFilter] || "ทั้งหมด";
}
function stockPhotoLabel() {
  const map = { all: "", with: "มีรูปแล้ว", missing: "ยังไม่มีรูป" };
  return map[stockPhotoFilter] || "";
}
function stockCatLabel() {
  if (!stockCat) return "";
  return stockCat === "__none__" ? "(ไม่มีหมวด)" : stockCat;
}
function stockCatOptionsHtml(catCounts, total) {
  return `<option value="">ทุกหมวดสินค้า (${total})</option>
    ${Object.keys(catCounts).sort((a, b) => a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b, "th")).map(c => `<option value="${esc(c)}" ${stockCat === c ? "selected" : ""}>${c === "__none__" ? "(ไม่มีหมวด)" : esc(c)} (${catCounts[c]})</option>`).join("")}`;
}
function stockActiveFilterCount() {
  return (stockFilter !== "all" ? 1 : 0) + (stockCat ? 1 : 0) + (stockPhotoFilter !== "all" ? 1 : 0) + (stockQuery.trim() ? 1 : 0);
}
function stockFilterStatusHtml() {
  const parts = [];
  const q = stockQuery.trim();
  if (stockFilter !== "all") parts.push("สถานะ: " + stockFilterLabel());
  if (stockCat) parts.push("หมวด: " + stockCatLabel());
  if (stockPhotoFilter !== "all") parts.push("รูป: " + stockPhotoLabel());
  if (q) parts.push("ค้นหา: " + q);
  const active = parts.length > 0;
  return `
    <div class="stock-filter-status ${active ? "" : "is-clear"}" id="stockFilterStatus">
      <span>${active ? "กำลังกรอง " + esc(parts.join(" · ")) : "แสดงสต็อกทั้งหมด"}</span>
      ${active ? `<button class="btn btn-sm btn-ghost" onclick="App.stockResetFilters()">${ic("refresh")} ล้างตัวกรอง</button>` : ""}
    </div>`;
}
function renderStock() {
  if (typeof Auth !== "undefined" && Auth.session && !App._stockSharesLoaded && !App._stockSharesLoading) {
    setTimeout(() => App.stockShareRefresh(true), 0);
  }
  const data = stockActiveList();
  const readonly = stockIsSharedView();
  const total = stockListValue(data);
  const filterCount = stockActiveFilterCount();
  /* นับจำนวนต่อหมวด (ใช้ใน dropdown กรอง) */
  const catCounts = {};
  data.forEach(x => { const c = x.category || "__none__"; catCounts[c] = (catCounts[c] || 0) + 1; });
  return `
    <div class="card stock-value-card">
      <div class="row row-between">
        <div>
          <div style="font-size:.76rem;opacity:.85">มูลค่าสต็อกทั้งหมด</div>
          <div class="bold" style="font-size:1.5rem">${fmtMoney(total)} บาท</div>
          ${readonly ? `<div style="font-size:.72rem;opacity:.9;margin-top:2px">กำลังดู: ${esc(stockSourceLabel(stockViewOwnerEmail()))}</div>` : ""}
        </div>
        <span style="font-size:2rem;color:#fff">${ic("box")}</span>
      </div>
    </div>
    ${stockSourceSelectHtml()}
    <div class="row row-between section-title stock-title-row" data-tkey="stockTitle">
      <span>${readonly ? "สต็อกที่แชร์มา" : T("stockTitle")} (${data.length})</span>
      <div class="row stock-toolbar">
        ${readonly ? `
          <button class="btn btn-sm btn-primary" onclick="App.stockViewSet('own')">${ic("box")} สต็อกของฉัน</button>
          <button class="btn btn-sm btn-ghost" onclick="App.stockShareOpen()">${ic("user")} แชร์สต็อก</button>
        ` : `
          <button class="btn btn-sm btn-primary" onclick="App.modalStock()">${ic("plus")} เพิ่มสินค้า</button>
          <button class="btn btn-sm btn-outline" onclick="App.modalSale()">${ic("dollar")} ขายสินค้า</button>
          <button class="btn btn-sm btn-ghost stock-toolbar-secondary stock-desktop-extra" onclick="App.stockDensityToggle()">${ic("menu")} ${stockDensity === "compact" ? "ละเอียด" : "ย่อ"}</button>
          <button class="btn btn-sm btn-ghost stock-filter-mobile-btn stock-desktop-extra" onclick="App.stockFilterOpen()">${ic("search")} กรอง${filterCount ? ` (${filterCount})` : ""}</button>
          <button class="btn btn-sm btn-ghost stock-toolbar-secondary stock-desktop-extra" onclick="App.stockToolsOpen()">${ic("menu")} จัดการสต็อก</button>
          <button class="btn btn-sm btn-ghost stock-mobile-options-btn" onclick="App.stockQuickOptionsOpen()">${ic("menu")} ตัวเลือก${filterCount ? ` (${filterCount})` : ""}</button>
        `}
      </div>
    </div>
    <div class="stock-filter-panel">
      <label class="stock-filter-field">
        <span>สถานะ</span>
        <select class="stock-filter-select" id="stockStatusSelect" onchange="App.stockFilter(this.value)" aria-label="กรองสถานะสต็อก">
          ${stockFilterOptionsHtml()}
        </select>
      </label>
      <label class="stock-filter-field">
        <span>หมวด</span>
        <select class="stock-cat-select" id="stockCatSelect" onchange="App.stockCatFilter(this.value)" aria-label="กรองหมวดสินค้า">
          ${stockCatOptionsHtml(catCounts, data.length)}
        </select>
      </label>
      <label class="stock-filter-field">
        <span>รูปภาพ</span>
        <select class="stock-filter-select" id="stockPhotoSelect" onchange="App.stockPhotoFilter(this.value)" aria-label="กรองรูปสินค้า">
          ${stockPhotoOptionsHtml()}
        </select>
      </label>
    </div>
    ${stockFilterStatusHtml()}
    <div class="stock-search">
      ${ic("search")}
      <input type="text" id="stockSearchInput" placeholder="ค้นหาปุ๋ย/ยา/เมล็ดพันธุ์..." value="${esc(stockQuery)}" oninput="App.stockSearch(this.value)">
      <button class="stock-search-clear" aria-label="ล้างคำค้นหา" title="ล้างคำค้นหา" onclick="App.stockSearch('')" style="${stockQuery ? "" : "display:none"}">✕</button>
    </div>
    <div id="stockListWrap">${stockListHtml()}</div>
    <div class="muted" style="font-size:.72rem;text-align:center;padding:6px">${ic("info")} สต็อกหลักเก็บเป็นหน่วยเต็ม · เมื่อใช้ของไม่หมด ของที่เหลือจากการเปิดใช้จะนำไปใช้ก่อนเสมอ · วิธีคิดต้นทุนแบบถัวเฉลี่ยถ่วงน้ำหนัก (Weighted Average)</div>`;
}
App.stockFilter = function (key) {
  stockFilter = key;
  rerender();
};
App.stockCatFilter = function (v) {
  stockCat = v;
  rerender();
};
App.stockPhotoFilter = function (v) {
  stockPhotoFilter = v || "all";
  rerender();
};
App.stockDensityToggle = function () {
  stockDensity = stockDensity === "compact" ? "detail" : "compact";
  rerender();
};
App.stockQuickOptionsOpen = function () {
  const filterCount = stockActiveFilterCount();
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("menu")} ตัวเลือกสต็อก</h3>
    <div class="modal-sub">คำสั่งรองสำหรับรายการสต็อก</div>
    <div class="action-list">
      <button class="action-item" onclick="App.stockFilterOpen()">
        <span class="action-ico">${ic("search")}</span>
        <span><b>กรองรายการ${filterCount ? ` (${filterCount})` : ""}</b><small>สถานะ หมวด และรูปสินค้า</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.stockDensityToggle()">
        <span class="action-ico">${ic("menu")}</span>
        <span><b>${stockDensity === "compact" ? "แสดงรายละเอียดเพิ่ม" : "ย่อรายการให้สั้น"}</b><small>ปรับความแน่นของรายการสต็อก</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.stockToolsOpen()">
        <span class="action-ico">${ic("box")}</span>
        <span><b>จัดการสต็อก</b><small>Lark, Excel, แชร์, ประวัติ</small></span>
      </button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
App.stockResetFilters = function () {
  stockFilter = "all";
  stockCat = "";
  stockPhotoFilter = "all";
  stockQuery = "";
  rerender();
};
App.stockFilterOpen = function () {
  const data = stockActiveList();
  const catCounts = {};
  data.forEach(x => { const c = x.category || "__none__"; catCounts[c] = (catCounts[c] || 0) + 1; });
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("search")} กรองสต็อก</h3>
    <div class="modal-sub">เลือกเฉพาะรายการที่ต้องจัดการ เช่น ยาหมด หรือสินค้าที่ยังไม่มีรูป</div>
    <div class="stock-filter-modal">
      <label class="field"><span>สถานะ</span><select id="sf_status">${stockFilterOptionsHtml()}</select></label>
      <label class="field"><span>หมวด</span><select id="sf_cat">${stockCatOptionsHtml(catCounts, data.length)}</select></label>
      <label class="field"><span>รูปภาพ</span><select id="sf_photo">${stockPhotoOptionsHtml()}</select></label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="App.stockResetFilters();App.closeModal()">${ic("refresh")} ล้าง</button>
      <button class="btn btn-primary" onclick="App.stockApplyFilters()">${ic("check")} ใช้ตัวกรอง</button>
    </div>`);
};
App.stockApplyFilters = function () {
  stockFilter = document.getElementById("sf_status")?.value || "all";
  stockCat = document.getElementById("sf_cat")?.value || "";
  stockPhotoFilter = document.getElementById("sf_photo")?.value || "all";
  closeModal();
  rerender();
};
App.stockToolsOpen = function () {
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("box")} จัดการสต็อก</h3>
    <div class="modal-sub">คำสั่งเสริมสำหรับนำเข้า ซิงก์ แชร์ และดูประวัติ แยกไว้ตรงนี้เพื่อให้หน้าสต็อกหลักอ่านง่ายขึ้น</div>
    <div class="action-list">
      <button class="action-item" onclick="App.closeModal();App.stockShareOpen()">
        <span class="action-ico">${ic("user")}</span>
        <span><b>แชร์สต็อก</b><small>ให้บัญชีอื่นดูสต็อกของคุณ</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.larkStockSync()">
        <span class="action-ico">${ic("refresh")}</span>
        <span><b>ซิงก์ Lark</b><small>ดึงจำนวนและรูปจาก Lark Base</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.importProducts()">
        <span class="action-ico">${ic("upload")}</span>
        <span><b>อัปเดตราคา Excel</b><small>เติมเฉพาะราคาจากไฟล์เสริม</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.importProducts('full')">
        <span class="action-ico">${ic("box")}</span>
        <span><b>นำเข้าสินค้า Excel</b><small>เพิ่มสินค้าใหม่ พร้อมเลือกว่าจะทับอะไร</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.saleHistory()">
        <span class="action-ico">${ic("box")}</span>
        <span><b>ประวัติขาย</b><small>ดูใบส่งสินค้าและยอดขายย้อนหลัง</small></span>
      </button>
      <button class="action-item" onclick="App.closeModal();App.customerHistory()">
        <span class="action-ico">${ic("user")}</span>
        <span><b>ลูกค้า</b><small>ดูประวัติลูกค้าและรายการที่เคยซื้อ</small></span>
      </button>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
/* พิมพ์ค้นหา -> อัปเดตเฉพาะรายการ (ไม่ rebuild ทั้งหน้า = focus ไม่หลุด พิมพ์ต่อเนื่องได้) */
App.stockSearch = function (v) {
  stockQuery = v;
  const input = document.getElementById("stockSearchInput");
  if (input && input.value !== v) input.value = v;
  const wrap = document.getElementById("stockListWrap");
  if (wrap) wrap.innerHTML = stockListHtml();
  const status = document.getElementById("stockFilterStatus");
  if (status) status.outerHTML = stockFilterStatusHtml();
  const clearBtn = document.querySelector(".stock-search-clear");
  if (clearBtn) clearBtn.style.display = v ? "" : "none";
};
function stockShareModalHtml() {
  const st = stockShareState();
  const outgoing = st.outgoing || [];
  const incoming = st.incoming || [];
  const incomingHtml = incoming.length ? incoming.map(src => {
    const sum = src.summary || {};
    return `
      <div class="stock-share-item">
        <div>
          <div class="bold">${esc(src.name || src.email)}</div>
          <div class="muted">${esc(src.email)} · ${fmtNum(sum.items || 0)} รายการ · รูป ${fmtNum(sum.photos || 0)}</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick='App.stockShareUse(${jsArg(src.email)})'>${ic("eye")} ดูสต็อก</button>
      </div>`;
  }).join("") : `<div class="empty" style="padding:18px 8px"><div class="e-title">ยังไม่มีใครแชร์สต็อกให้บัญชีนี้</div><div class="muted">ให้เจ้าของสต็อกกดแชร์มาที่อีเมลบัญชีของคุณ</div></div>`;
  const outgoingHtml = outgoing.length ? outgoing.map(row => `
    <div class="stock-share-item">
      <div>
        <div class="bold">${esc(row.name || row.email)}</div>
        <div class="muted">${esc(row.email)}</div>
      </div>
      <button class="btn btn-sm btn-danger-soft" onclick='App.stockShareRevoke(${jsArg(row.email)})'>${ic("trash")} ยกเลิก</button>
    </div>`).join("") : `<div class="muted" style="font-size:.78rem;padding:8px 0">ยังไม่ได้แชร์ให้บัญชีอื่น</div>`;
  return `
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("user")} แชร์สต็อก</h3>
    <div class="modal-sub">แชร์สต็อกของบัญชีนี้ให้บัญชีอื่นดูได้ โดยไม่ต้องส่ง Lark Base และคนรับแชร์แก้ข้อมูลของคุณไม่ได้</div>
    <div class="stock-share-box">
      <div class="bold">${ic("upload")} แชร์สต็อกของฉันให้บัญชีอื่น</div>
      <div class="stock-share-input">
        <input id="stock_share_email" type="email" placeholder="email ที่สมัครในเว็บแล้ว">
        <button class="btn btn-primary" onclick="App.stockShareGrant()">${ic("plus")} แชร์</button>
      </div>
      <div class="hint">บัญชีปลายทางต้องเคยสมัครหรือเคยล็อกอินในเว็บนี้ก่อน ระบบจึงจะหาเจอ</div>
    </div>
    <div class="stock-share-box">
      <div class="bold">${ic("eye")} คนที่เห็นสต็อกของฉัน</div>
      <div class="stock-share-list">${outgoingHtml}</div>
    </div>
    <div class="stock-share-box">
      <div class="bold">${ic("box")} สต็อกที่คนอื่นแชร์ให้ฉัน</div>
      <div class="stock-share-list">${incomingHtml}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-outline" onclick="App.stockShareRefresh()">${ic("refresh")} รีเฟรช</button>
    </div>`;
}
App.stockShareRefresh = async function (silent) {
  if (typeof Auth === "undefined" || !Auth.session) return;
  App._stockSharesLoading = true;
  const r = await authCall("stock_share_list", { token: Auth.session.token }).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }));
  App._stockSharesLoading = false;
  App._stockSharesLoaded = true;
  if (!r.ok) {
    if (!silent) toast(r.error || "โหลดรายการแชร์ไม่สำเร็จ");
    return false;
  }
  App._stockShares = r.data || { outgoing: [], incoming: [] };
  const incoming = App._stockShares.incoming || [];
  if (stockIsSharedView() && !incoming.find(x => String(x.email || "").toLowerCase() === stockViewOwnerEmail().toLowerCase())) {
    stockViewKey = "own";
    toast("สต็อกที่เคยดูถูกยกเลิกแชร์แล้ว");
  }
  const modal = document.querySelector(".modal");
  if (modal && modal.querySelector("#stock_share_email")) modal.innerHTML = stockShareModalHtml();
  if (route.view === "stock") rerender();
  if (!silent) toast("อัปเดตรายการแชร์แล้ว");
  return true;
};
App.stockShareOpen = async function () {
  if (typeof Auth === "undefined" || !Auth.session) {
    toast("กรุณาล็อกอินก่อนแชร์สต็อก");
    return;
  }
  openModal(`
    <div class="lark-sync-loading">
      <div class="lark-sync-spinner" aria-hidden="true"></div>
      <h3>กำลังโหลดรายการแชร์</h3>
      <div class="lark-sync-note">กำลังตรวจบัญชีที่เห็นสต็อกของคุณและสต็อกที่คนอื่นแชร์มา</div>
    </div>`);
  const ok = await App.stockShareRefresh(true);
  if (!ok) {
    openModal(`
      <button class="modal-x" onclick="App.closeModal()">✕</button>
      <h3>${ic("alert")} โหลดรายการแชร์ไม่สำเร็จ</h3>
      <div class="modal-sub">ลองเช็กอินเทอร์เน็ตหรือเข้าสู่ระบบใหม่ แล้วกดเปิดแชร์สต็อกอีกครั้ง</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button></div>`);
    return;
  }
  openModal(stockShareModalHtml());
};
App.stockShareGrant = async function () {
  const input = document.getElementById("stock_share_email");
  const email = (input && input.value || "").trim().toLowerCase();
  if (!email) { toast("กรอกอีเมลที่ต้องการแชร์ก่อน"); return; }
  toast("กำลังแชร์สต็อก...");
  const r = await authCall("stock_share_grant", { token: Auth.session.token, email }).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }));
  if (!r.ok) { toast(r.error || "แชร์ไม่สำเร็จ"); return; }
  await App.stockShareRefresh(true);
  openModal(stockShareModalHtml());
  toast("แชร์สต็อกแล้ว");
};
App.stockShareRevoke = function (email) {
  App.confirm("ยกเลิกแชร์สต็อก?", `บัญชี ${email} จะไม่เห็นสต็อกของคุณอีก`, async () => {
    const r = await authCall("stock_share_revoke", { token: Auth.session.token, email }).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }));
    if (!r.ok) { toast(r.error || "ยกเลิกแชร์ไม่สำเร็จ"); return; }
    await App.stockShareRefresh(true);
    openModal(stockShareModalHtml());
    toast("ยกเลิกแชร์แล้ว");
  });
};
App.stockShareUse = async function (email) {
  await App.stockViewSet("shared:" + email);
  closeModal();
};
App.stockViewSet = async function (value) {
  const v = String(value || "own");
  if (v === "own") {
    stockViewKey = "own";
    rerender();
    return;
  }
  const email = v.startsWith("shared:") ? v.slice("shared:".length) : "";
  if (!email) return;
  if (!App._stockSharedCache) App._stockSharedCache = {};
  if (!App._stockSharedCache[email]) {
    toast("กำลังโหลดสต็อกที่แชร์มา...");
    const r = await authCall("stock_share_get", { token: Auth.session.token, owner_email: email }).catch(() => ({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" }));
    if (!r.ok) { toast(r.error || "โหลดสต็อกที่แชร์มาไม่สำเร็จ"); return; }
    App._stockSharedCache[email] = r.data || { stock: [] };
  }
  stockViewKey = "shared:" + email;
  stockCat = "";
  stockQuery = "";
  rerender();
};
App.deleteStock = function (id) {
  if (stockIsSharedView()) { toast("สต็อกที่แชร์มาเป็นโหมดอ่านอย่างเดียว"); return; }
  App.confirm("ลบรายการวัสดุ?", "", () => {
    S.stock = S.stock.filter(x => x.id !== id);
    saveState(S);
    rerender();
    toast("ลบรายการแล้ว");
  });
};

/* ---------------- รายละเอียดสินค้า (กดที่การ์ดสต็อก) ---------------- */
App.stockDetail = function (id) {
  const x = stockActiveById(id);
  if (!x) return;
  const readonly = stockIsSharedView();
  const open = Number(x.openQty) || 0;
  const photos = stockPhotos(x);
  const row = (k, v) => v ? `<div class="sd-row"><span class="k">${k}</span><span class="bold">${v}</span></div>` : "";
  const mainPhotoHtml = photos.length
    ? `<button class="sd-main-photo" onclick="App.viewPhoto('${x.id}', 0)" title="ดูรูปใหญ่">
        <img src="${esc(stockPhotoSrc({ photo: photos[0] }))}" alt="" loading="lazy" onerror="this.closest('.sd-main-photo').remove()">
        <span>${ic("eye")} แตะเพื่อดูรูปใหญ่</span>
      </button>`
    : "";
  const stripHtml = photos.length
    ? `<div class="sd-strip">${photos.map((p, i) => `<div class="sd-strip-item ${i === 0 ? "is-main" : ""}"><img src="${esc(stockPhotoSrc({ photo: p }))}" alt="" loading="lazy" onclick="App.viewPhoto('${x.id}', ${i})" onerror="this.remove()">${i === 0 ? `<span class="sd-main-badge">รูปหลัก</span>` : ""}${readonly ? "" : `<button class="sd-strip-x" aria-label="ลบรูปนี้" onclick="event.stopPropagation();App.stockPhotoRemoveOne('${x.id}', ${i})" title="ลบรูปนี้">✕</button>${i > 0 ? `<button class="sd-main-btn" aria-label="ตั้งเป็นรูปหลัก" onclick="event.stopPropagation();App.stockPhotoSetMain('${x.id}', ${i})" title="ตั้งเป็นรูปหลัก">${ic("check")}</button>` : ""}`}</div>`).join("")}</div>`
    : `<div class="sd-no-photo">${ic("image")} ${readonly ? "ยังไม่มีรูปในสต็อกที่แชร์มา" : "ยังไม่มีรูป — กดเพิ่มรูปด้านล่าง"}</div>`;
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <div class="sd-head">
      <div>
        <h3 style="margin:0">${esc(x.name)}</h3>
        <div class="modal-sub">${x.category ? esc(x.category) : "ไม่มีหมวด"}${x.unit ? ` · ${esc(x.unit)}` : ""}${readonly ? ` · จาก ${esc(stockSourceLabel(stockViewOwnerEmail()))}` : ""}</div>
      </div>
    </div>
    ${mainPhotoHtml}
    ${stripHtml}
    ${readonly ? "" : `<div class="sd-photo-actions">
      <button class="btn btn-sm btn-ghost" onclick="App.stockPhoto('${x.id}')">${ic("camera")} เพิ่มรูป${photos.length ? ` (${photos.length})` : ""}</button>
    </div>`}
    <div class="sd-rows">
      ${row("รหัสสินค้า", x.code)}
      ${row("ชื่อสามัญ", x.generic)}
      ${row("หมวดสินค้า", x.category)}
      ${row("ขนาด", x.size)}
      ${row("หน่วยนับ", x.unit)}
      ${row("บริษัทจำหน่าย", x.supplier)}
      <div class="sd-row"><span class="k">ในสต็อก</span><span class="bold">${fmtNum(x.qty)} ${esc(x.unit)}${open > 0 ? ` <span class="stock-open" style="display:inline">+ เปิดใช้แล้ว ${fmtNum(open)} ${esc(x.unit)}</span>` : ""}</span></div>
      ${stockPriceRow("ราคาต้นทุน", x.avgCost, x.unit)}
      ${stockPriceRow("ราคาทั่วไป", x.salePrice, x.unit)}
      ${stockPriceRow("ราคาลูกค้าประจำ", x.memberPrice, x.unit)}
      ${x.salePrice ? `<div class="sd-row"><span class="k">กำไรทั่วไป/หน่วย</span><span class="bold ${x.salePrice - x.avgCost >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(x.salePrice - x.avgCost)} บาท/${esc(x.unit)}</span></div>` : ""}
      ${x.memberPrice ? `<div class="sd-row"><span class="k">กำไรลูกค้าประจำ/หน่วย</span><span class="bold ${x.memberPrice - x.avgCost >= 0 ? "price-trend-up" : "price-trend-down"}">${fmtMoney(x.memberPrice - x.avgCost)} บาท/${esc(x.unit)}</span></div>` : ""}
      <div class="sd-row"><span class="k">มูลค่ารวม</span><span class="bold">${fmtMoney((x.qty + open) * x.avgCost)} บาท</span></div>
    </div>
    ${readonly ? "" : `<div class="sd-danger-zone">
      <div>
        <b>โซนอันตราย</b>
        <span>ลบรายการนี้เมื่อแน่ใจว่าไม่ต้องใช้แล้ว</span>
      </div>
      <button class="btn btn-sm btn-danger-soft" onclick="App.deleteStock('${x.id}')">${ic("trash")} ลบรายการ</button>
    </div>`}
    <div class="modal-actions sd-actions" style="margin-top:14px">
      ${readonly ? `<button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>` : `
        <button class="btn btn-primary" onclick="App.modalReceive('${x.id}')">${ic("down")} รับของเข้า</button>
        <button class="btn btn-outline" onclick="App.modalDeduct('${x.id}')">${ic("minus")} ตัดสต็อก</button>
        <button class="btn btn-ghost" onclick="App.modalStock('${x.id}')">${ic("pencil")} แก้ไข</button>
      `}
    </div>`);
};
/* ย่อรูปอัตโนมัติ (กัน localStorage เต็ม) แล้วคืนเป็น data URL */
function downscaleImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const s = Math.min(1, maxSide / Math.max(w, h));
      w = Math.max(1, Math.round(w * s));
      h = Math.max(1, Math.round(h * s));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}
App.stockPhoto = function (id) {
  if (stockIsSharedView()) { toast("สต็อกที่แชร์มาเป็นโหมดอ่านอย่างเดียว"); return; }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true; // เลือกได้หลายรูปในครั้งเดียว
  input.style.display = "none";
  document.body.appendChild(input);
  input.onchange = async () => {
    const files = input.files ? [...input.files] : [];
    input.remove();
    if (!files.length) return;
    const x = stockById(S, id);
    if (!x) return;
    if (!Array.isArray(x.photos)) x.photos = x.photo ? [x.photo] : [];
    try {
      let ok = 0, cloud = 0;
      for (const f of files) {
        /* พยายามอัปขึ้น R2 ก่อน — เก็บแค่ URL ไม่กินพื้นที่เครื่อง
           ถ้าไม่ได้ (ออฟไลน์/ยังไม่ล็อกอิน) fallback เก็บ base64 ในเครื่องแบบเดิม */
        const url = await App.uploadPhotoR2(f, 960);
        if (url) { x.photos.push(url); cloud++; }
        else x.photos.push(await downscaleImage(f, 480, 0.68));
        ok++;
      }
      x.photo = x.photos[0] || "";
      saveState(S);
      render(); // อัปเดตการ์ดด้านหลังทันที (ไม่ต้องรีเฟรช)
      App.stockDetail(id);
      toast(ok > 1 ? `เพิ่ม ${ok} รูปแล้ว${cloud ? ` (${cloud} รูปเก็บบนคลาวด์)` : ""}` : `เพิ่มรูปแล้ว${cloud ? " (เก็บบนคลาวด์)" : " (เก็บในเครื่อง)"}`);
    } catch (e) { toast("อ่านรูปไม่สำเร็จ — ลองไฟล์ JPG/PNG"); console.error(e); }
  };
  input.click();
};
App.stockPhotoSetMain = function (id, idx) {
  if (stockIsSharedView()) { toast("สต็อกที่แชร์มาเป็นโหมดอ่านอย่างเดียว"); return; }
  const x = stockById(S, id);
  if (!x || !Array.isArray(x.photos) || !x.photos[idx]) return;
  const chosen = x.photos.splice(idx, 1)[0];
  x.photos.unshift(chosen);
  x.photo = chosen;
  saveState(S);
  render();
  App.stockDetail(id);
  toast("ตั้งเป็นรูปหลักแล้ว");
};
App.stockPhotoRemoveOne = function (id, idx) {
  if (stockIsSharedView()) { toast("สต็อกที่แชร์มาเป็นโหมดอ่านอย่างเดียว"); return; }
  const x = stockById(S, id);
  if (!x || !Array.isArray(x.photos)) return;
  const gone = x.photos[idx];
  x.photos.splice(idx, 1);
  x.photo = x.photos[0] || "";
  saveState(S);
  render(); // อัปเดตการ์ดด้านหลังทันที (ไม่ต้องรีเฟรช)
  App.stockDetail(id);
  toast("ลบรูปแล้ว");
  /* ถ้าเป็นรูปบนคลาวด์ (R2) — ลบไฟล์จริงทิ้งด้วย (best-effort) */
  if (gone && typeof gone === "string" && gone.startsWith("http") && typeof Auth !== "undefined" && Auth.session) {
    authCall("photo_del", { token: Auth.session.token, url: gone }).catch(() => {});
  }
};
/* ดูภาพใหญ่ (lightbox) — กดที่รูปในป๊อปอัป */
let lightboxEl = null;
App.viewPhoto = function (id, idx) {
  const photos = stockPhotos(stockActiveById(id));
  if (!photos.length) return;
  const n = photos.length;
  const cur = ((idx % n) + n) % n;
  if (!lightboxEl) {
    lightboxEl = document.createElement("div");
    lightboxEl.id = "lightbox";
    document.body.appendChild(lightboxEl);
  }
  lightboxEl.innerHTML = `
    <div class="lightbox-backdrop" onclick="App.closeLightbox()">
      <button class="lightbox-x" aria-label="ปิดรูปใหญ่" title="ปิดรูปใหญ่" onclick="App.closeLightbox()">✕</button>
      ${n > 1 ? `<button class="lightbox-nav prev" onclick="event.stopPropagation();App.viewPhoto('${id}',${cur - 1})">‹</button>
      <button class="lightbox-nav next" onclick="event.stopPropagation();App.viewPhoto('${id}',${cur + 1})">›</button>` : ""}
      <img src="${esc(stockPhotoSrc({ photo: photos[cur] }))}" alt="" onclick="event.stopPropagation()">
      ${n > 1 ? `<div class="lightbox-count">${cur + 1} / ${n}</div>` : ""}
    </div>`;
};
App.closeLightbox = function () {
  if (lightboxEl) lightboxEl.innerHTML = "";
};

/* ---------------- นำเข้าสินค้าจากไฟล์ Excel (.xlsx) ---------------- */
/* อ่าน ZIP (Central Directory) แล้วคลาย entry ที่บีบอัดด้วย DecompressionStream */
async function zipEntries(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ไฟล์ไม่ใช่ ZIP (.xlsx)");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const map = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true);
    const xlen = dv.getUint16(off + 30, true);
    const clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(new Uint8Array(u8.buffer, u8.byteOffset + off + 46, nlen));
    map[name] = { method, csize, lho };
    off += 46 + nlen + xlen + clen;
  }
  return map;
}
async function zipRead(u8, entry) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const lho = entry.lho;
  const nlen = dv.getUint16(lho + 26, true);
  const xlen = dv.getUint16(lho + 28, true);
  const start = lho + 30 + nlen + xlen;
  const data = new Uint8Array(u8.buffer, u8.byteOffset + start, entry.csize);
  if (entry.method === 0) return data;
  if (typeof DecompressionStream === "undefined") throw new Error("เบราว์เซอร์นี้ไม่รองรับการอ่าน .xlsx — ลองใช้ Chrome");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function xlsxCellText(cell, shared) {
  const t = cell.getAttribute("t") || "";
  if (t === "inlineStr") {
    const ts = cell.getElementsByTagName("t");
    let s = "";
    for (let i = 0; i < ts.length; i++) s += ts[i].textContent;
    return s;
  }
  const v = cell.getElementsByTagName("v")[0];
  if (!v) return "";
  if (t === "s") { const i = Number(v.textContent); return shared[i] || ""; }
  return v.textContent;
}
function xlsxHeaderNorm(v) {
  return String(v || "").trim().replace(/\s+/g, "").toLowerCase();
}
function xlsxFindCol(headers, aliases) {
  const keys = aliases.map(xlsxHeaderNorm).filter(Boolean);
  return headers.findIndex(h => {
    const v = xlsxHeaderNorm(h);
    return keys.some(k => v.includes(k));
  });
}
function xlsxFindHeaderRow(grid) {
  const nameAliases = ["ชื่อสินค้า", "ชื่อรายการสินค้า", "รายการสินค้า", "productname", "สินค้า"];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].some(v => xlsxFindCol([v], nameAliases) >= 0)) return i;
  }
  return -1;
}
function cleanXlsxPhotoName(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  /* ไฟล์ export บางตัวใส่ image.png ซ้ำทุกแถว เป็น placeholder ไม่ใช่รูปสินค้าจริง */
  if (/^image\.(png|jpe?g|webp|gif)$/i.test(s)) return "";
  return s;
}
/* แยกคอลัมน์จากไฟล์ .xlsx -> รายการสินค้า {name, generic, category, size, unit, supplier, avgCost, salePrice, memberPrice} */
async function parseXlsxProducts(file) {
  const u8 = new Uint8Array(await file.arrayBuffer());
  const entries = await zipEntries(u8);
  const read = async (name) => {
    const e = entries[name];
    return e ? new TextDecoder().decode(await zipRead(u8, e)) : null;
  };
  const wbXml = await read("xl/workbook.xml");
  const relsXml = await read("xl/_rels/workbook.xml.rels");
  if (!wbXml || !relsXml) throw new Error("ไฟล์ .xlsx ไม่สมบูรณ์");
  const wb = new DOMParser().parseFromString(wbXml, "application/xml");
  const sheetEl = wb.getElementsByTagName("sheet")[0];
  const sheetName = sheetEl ? sheetEl.getAttribute("name") || "" : "";
  const rid = sheetEl ? sheetEl.getAttribute("r:id") : "";
  let target = "";
  const rels = new DOMParser().parseFromString(relsXml, "application/xml").getElementsByTagName("Relationship");
  for (let i = 0; i < rels.length; i++) {
    if (rels[i].getAttribute("Id") === rid) { target = rels[i].getAttribute("Target") || ""; break; }
  }
  if (!target) throw new Error("ไม่พบชีตข้อมูลในไฟล์");
  const t2 = target.replace(/^\//, "");
  const sheetPath = t2.startsWith("xl/") ? t2 : "xl/" + t2.replace(/^\.?\//, "");
  const sheetXml = await read(sheetPath);
  if (!sheetXml) throw new Error("ไม่พบชีตข้อมูลในไฟล์");
  /* sharedStrings (ถ้ามี) */
  const shared = [];
  const ssXml = await read("xl/sharedStrings.xml");
  if (ssXml) {
    const sis = new DOMParser().parseFromString(ssXml, "application/xml").getElementsByTagName("si");
    for (let i = 0; i < sis.length; i++) {
      const ts = sis[i].getElementsByTagName("t");
      let s = "";
      for (let j = 0; j < ts.length; j++) s += ts[j].textContent;
      shared.push(s);
    }
  }
  const sheet = new DOMParser().parseFromString(sheetXml, "application/xml");
  const rows = sheet.getElementsByTagName("row");
  const grid = [];
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].getElementsByTagName("c");
    const rowArr = [];
    for (let c = 0; c < cells.length; c++) {
      const col = (cells[c].getAttribute("r") || "").replace(/[0-9]+$/, "");
      let idx = 0;
      for (let k = 0; k < col.length; k++) idx = idx * 26 + (col.charCodeAt(k) - 64);
      rowArr[idx - 1] = xlsxCellText(cells[c], shared);
    }
    grid.push(rowArr);
  }
  /* หาแถวหัวตาราง (รองรับทั้ง "ชื่อสินค้า" และ "ชื่อรายการสินค้า") */
  const hi = xlsxFindHeaderRow(grid);
  if (hi < 0) throw new Error("ไม่พบคอลัมน์ชื่อสินค้า/ชื่อรายการสินค้าในไฟล์");
  const headers = grid[hi].map(h => String(h || "").trim());
  const findCol = aliases => xlsxFindCol(headers, aliases);
  const iName = findCol(["ชื่อสินค้า", "ชื่อรายการสินค้า", "รายการสินค้า", "product name", "product"]),
        iCode = findCol(["รหัสสินค้า", "รหัสสินค้าเดิม", "sku", "code"]),
        iGeneric = findCol(["ชื่อสามัญ", "สารสำคัญ", "generic"]),
        iCat = findCol(["หมวดสินค้า", "หมวดหมู่ของสินค้า", "หมวดหมู่", "category"]),
        iUnit = findCol(["หน่วยนับ", "หน่วย", "unit"]),
        iSize = findCol(["ขนาดสินค้า", "ขนาด", "size"]),
        iSupp = findCol(["บริษัทจำหน่าย", "บริษัทผู้ผลิต", "ผู้ผลิต", "supplier", "manufacturer"]),
        iPhoto = findCol(["รูปถ่าย", "รูปสินค้า", "รูปภาพ", "photo", "image"]),
        iQty = findCol(["จำนวนที่นับ", "จำนวนในคลังสินค้า", "จำนวนคงเหลือ", "qty", "stock"]),
        iAvgCost = findCol(["ราคาต้นทุน", "ต้นทุน", "cost"]),
        iSale = findCol(["ราคาลูกค้าทั่วไป", "ราคาขาย", "ขายปลีก", "sale price", "retail"]),
        iMember = findCol(["ราคาลูกค้าประจำ", "ราคานักบิน", "ราคาส่ง", "member", "wholesale"]);
  const products = [];
  /* แปลงตัวเลขจาก Excel: ตัดเครื่องหมายคั่น/สกุลเงิน/ช่องว่างออก */
  const toNum = v => {
    const n = parseFloat(String(v == null ? "" : v).replace(/[^\d.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };
  for (let r = hi + 1; r < grid.length; r++) {
    const row = grid[r];
    const name = String(row[iName] || "").trim();
    if (!name) continue;
    products.push({
      name,
      code: iCode >= 0 ? String(row[iCode] || "").trim() : "",
      generic: String(row[iGeneric] || "").trim(),
      category: String(row[iCat] || "").trim(),
      size: String(row[iSize] || "").trim(),
      unit: String(row[iUnit] || "").trim() || "ชิ้น",
      supplier: String(row[iSupp] || "").trim(),
      photo: cleanXlsxPhotoName(row[iPhoto]),
      qty: iQty >= 0 ? toNum(row[iQty]) : undefined,
      avgCost: iAvgCost >= 0 ? toNum(row[iAvgCost]) : undefined,
      salePrice: iSale >= 0 ? toNum(row[iSale]) : undefined,
      memberPrice: iMember >= 0 ? toNum(row[iMember]) : undefined
    });
  }
  return { products, sheetName, headers };
}
function stockImportDefaultOptions(mode) {
  if (mode === "full") {
    return { priceOnly: false, addNew: true, updateMeta: true, updatePrices: true, updateQty: false, updatePhotos: false };
  }
  return { priceOnly: true, addNew: false, updateMeta: false, updatePrices: true, updateQty: false, updatePhotos: false };
}
function stockImportOptionsFromForm() {
  const mode = (App._stockImportMode || "price");
  if (mode !== "full") return stockImportDefaultOptions("price");
  const checked = id => !!document.getElementById(id)?.checked;
  return {
    priceOnly: false,
    addNew: checked("imp_addnew"),
    updateMeta: checked("imp_meta"),
    updatePrices: checked("imp_prices"),
    updateQty: checked("imp_qty"),
    updatePhotos: checked("imp_photos")
  };
}
function stockImportOptionCheckbox(id, label, note, checked, disabled) {
  return `
    <label class="stock-import-option ${disabled ? "is-disabled" : ""}">
      <input id="${id}" type="checkbox" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
      <span><b>${label}</b><small>${note}</small></span>
    </label>`;
}
function stockImportOptionsHtml(options, locked) {
  const o = Object.assign(stockImportDefaultOptions(locked ? "price" : "full"), options || {});
  return `
    <div class="stock-import-options">
      <div class="bold">${ic("check")} เลือกข้อมูลที่จะบันทึก</div>
      ${stockImportOptionCheckbox("imp_addnew", "เพิ่มสินค้าใหม่", "ถ้า Excel มีสินค้าใหม่ ให้เพิ่มเข้าสต็อก", o.addNew, locked)}
      ${stockImportOptionCheckbox("imp_prices", "อัปเดตราคา", "ต้นทุน / ราคาทั่วไป / ราคาลูกค้าประจำ", o.updatePrices, locked)}
      ${stockImportOptionCheckbox("imp_meta", "อัปเดตข้อมูลสินค้า", "รหัส ชื่อสามัญ และหมวดสินค้า", o.updateMeta, locked)}
      ${stockImportOptionCheckbox("imp_qty", "อัปเดตจำนวนสต็อก", "เปิดเฉพาะตอนต้องการใช้จำนวนจากไฟล์นับจริง", o.updateQty, locked)}
      ${stockImportOptionCheckbox("imp_photos", "อัปเดตรูปสินค้า", "เปิดเมื่อไฟล์มีชื่อรูปใหม่ที่ต้องการใช้แทนเดิม", o.updatePhotos, locked)}
    </div>`;
}
/* กดนำเข้า Excel: มีทั้งโหมดราคาเสริม และโหมดนำเข้าสินค้าเต็มแบบเลือก field ได้ */
App.importProducts = function (mode = "price") {
  App._stockImportMode = mode === "full" ? "full" : "price";
  const fullMode = App._stockImportMode === "full";
  const options = stockImportDefaultOptions(App._stockImportMode);
  const req = ["ชื่อสินค้า / ชื่อรายการสินค้า"];
  const cols = [
    ["ชื่อสินค้า / ชื่อรายการสินค้า", "จำเป็น", "สารกำจัดเพลี้ย"],
    ["รหัสสินค้า", "แนะนำ", "00-0000-269"],
    ["หน่วยนับ", "ช่วยจับคู่", "ขวด"],
    ["ขนาดสินค้า", "ช่วยจับคู่", "1,000 ซีซี"],
    ["บริษัทจำหน่าย / บริษัทผู้ผลิต", "ช่วยจับคู่", "บริษัทตัวอย่าง"],
    ["ราคาต้นทุน", "ไม่จำเป็น", "220"],
    ["ราคาลูกค้าทั่วไป", "ไม่จำเป็น", "250"],
    ["ราคาลูกค้าประจำ / ราคาส่ง", "ไม่จำเป็น", "230"],
  ];
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("upload")} ${fullMode ? "นำเข้าสินค้าจาก Excel" : "อัปเดตราคาจาก Excel"}</h3>
    <div class="modal-sub">${fullMode ? "เหมาะกับบัญชีที่ใช้ Excel เป็นฐานสินค้า เลือกก่อนว่ารอบนี้จะบันทึกอะไร" : "ใช้ไฟล์ราคาเสริมกับสต็อกที่มีอยู่แล้วจาก Lark"}</div>

    <div class="bold" style="font-size:.86rem;margin:4px 0 6px">${ic("info")} ข้อกำหนดไฟล์</div>
    <div class="td-list" style="border:1px solid var(--line);border-radius:10px;padding:2px 10px">
      <div class="td-row"><span class="td-k">นามสกุล</span><span class="td-v">.xlsx เท่านั้น (Excel 2007+ / Google Sheets) — .xls อ่านไม่ได้</span></div>
      <div class="td-row"><span class="td-k">ชีต</span><span class="td-v">ระบบอ่านเฉพาะชีตแรก (Sheet 1)</span></div>
      <div class="td-row"><span class="td-k">หัวตาราง</span><span class="td-v">ต้องมีแถวที่มี "${req[0]}" — ข้อมูลเริ่มจากแถวถัดไป</span></div>
      <div class="td-row"><span class="td-k">ตรวจซ้ำ</span><span class="td-v">เทียบชื่อ+ขนาด+หน่วย+บริษัทก่อน ถ้าไม่เจอจะใช้รหัสสินค้าที่ไม่ซ้ำ</span></div>
      <div class="td-row"><span class="td-k">อัปเดต</span><span class="td-v">${fullMode ? "เลือกได้ว่าจะเพิ่มสินค้าใหม่/แก้ราคา/จำนวน/รูปหรือไม่" : "เฉพาะราคาเท่านั้น ไม่เพิ่มสินค้าใหม่ ไม่แก้หมวด จำนวน หรือรูป"}</span></div>
      <div class="td-row"><span class="td-k">ก่อนบันทึก</span><span class="td-v">ระบบจะแสดง Preview ให้ยืนยันก่อนทุกครั้ง</span></div>
      <div class="td-row"><span class="td-k">ราคา 0/ว่าง</span><span class="td-v">จะไม่ทับราคาที่มีอยู่เดิม เพื่อกันไฟล์ที่ยังกรอกไม่ครบ</span></div>
    </div>

    ${fullMode ? stockImportOptionsHtml(options, false) : ""}

    <div class="bold" style="font-size:.86rem;margin:14px 0 6px">${ic("menu")} คอลัมน์ในหัวตาราง</div>
    <div class="td-list" style="border:1px solid var(--line);border-radius:10px;padding:2px 10px">
      ${cols.map(c => `
        <div class="td-row">
          <span class="td-k" style="flex-basis:110px">${c[0]}</span>
          <span class="td-v" style="font-weight:400">${c[1]}${c[1] === "จำเป็น" ? ` <span class="badge badge-red" style="margin-left:4px">ต้องมี</span>` : ""}</span>
          <span class="muted" style="font-size:.72rem;text-align:right;flex-shrink:0">${esc(c[2])}</span>
        </div>`).join("")}
    </div>
    <div class="muted" style="font-size:.7rem;margin-top:10px">${ic("dollar")} ราคาเป็นตัวเลขต่อ 1 หน่วย เช่น 250 = 250 บาท/ขวด · คอลัมน์อื่นในไฟล์จะถูกอ่านเพื่อจับคู่เท่านั้น</div>

    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.pickImportFile()">${ic("upload")} เลือกไฟล์ .xlsx</button>
    </div>`);
};
function stockImportChangeText(ch) {
  const from = ch.isMoney ? fmtMoney(ch.from) : (ch.field === "photos" ? `${fmtNum(ch.from)} รูป` : esc(ch.from));
  const to = ch.isMoney ? fmtMoney(ch.to) : (ch.field === "photos" ? `${fmtNum(ch.to)} รูป` : esc(ch.to));
  return `${esc(ch.label)} ${from} → ${to}`;
}
function stockImportPreviewHtml(ctx) {
  const priceOnly = ctx && ctx.options && ctx.options.priceOnly;
  const plan = ctx.plan || stockImportPlan(S, ctx.products || [], ctx.options || {});
  const s = plan.summary || {};
  const changed = (plan.rows || []).filter(r => r.action === "add" || r.action === "update");
  const shown = changed.slice(0, 80);
  const card = (label, value, sub, cls) => `
    <div class="lark-sync-result ${cls || ""}">
      <b>${fmtNum(value || 0)}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}
    </div>`;
  return `
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("upload")} ${priceOnly ? "Preview อัปเดตราคา" : "Preview นำเข้าสินค้า"}</h3>
    <div class="modal-sub">${esc(ctx.fileName || "")}${ctx.sheetName ? ` · ชีต ${esc(ctx.sheetName)}` : ""}</div>
    ${priceOnly ? "" : stockImportPreviewOptionsHtml(ctx.options || {})}
    <div class="lark-sync-results">
      ${card("ทั้งหมดในไฟล์", s.total, "รายการที่อ่านได้", "blue")}
      ${priceOnly
        ? `${card("อัปเดตราคา", s.updated, "รายการที่ราคาเปลี่ยน", "amber")}
           ${card("ไม่เปลี่ยน", s.skipped, "ราคาตรงเดิมหรือไม่มีราคาใหม่", "")}
           ${card("ไม่พบในสต็อก", s.missing, "ยังไม่เพิ่ม เพราะต้องอ้างอิงจาก Lark", "green")}`
        : `${card("เพิ่มใหม่", s.added, "ยังไม่มีในสต็อก", "green")}
           ${card("อัปเดตเดิม", s.updated, "มีข้อมูลเปลี่ยน", "amber")}
           ${card("ไม่เปลี่ยน", s.skipped, "ตรงกับข้อมูลเดิม", "")}
           ${s.missing ? card("ไม่พบในสต็อก", s.missing, "ข้าม เพราะปิดเพิ่มสินค้าใหม่", "green") : ""}`}
    </div>
    <div class="stock-import-price-summary">
      <span>ต้นทุน ${fmtNum(s.costUpdates || 0)}</span>
      <span>ราคาทั่วไป ${fmtNum(s.saleUpdates || 0)}</span>
      <span>ราคาประจำ ${fmtNum(s.memberUpdates || 0)}</span>
      ${priceOnly ? "" : `<span>จำนวน ${fmtNum(s.qtyUpdates || 0)}</span><span>รูป ${fmtNum(s.photoUpdates || 0)}</span>`}
    </div>
    <div class="lark-sync-summary-note">${ic("info")} ${priceOnly ? "Excel รอบนี้อัปเดตเฉพาะราคา ไม่เพิ่มสินค้าใหม่ ไม่แตะจำนวน หมวด หรือรูป" : "ตรวจแล้วค่อยกดบันทึกจริง"} · ราคา 0 หรือช่องว่างจาก Excel จะไม่ทับราคาที่มีอยู่เดิม</div>
    ${!shown.length ? `<div class="empty"><div class="e-ico">${ic("check")}</div><div class="e-title">ไม่มีรายการเปลี่ยนแปลง</div><div class="muted">ไฟล์นี้ตรงกับข้อมูลสต็อกปัจจุบันแล้ว</div></div>` : `
      <div class="stock-import-preview-list">
        ${shown.map(r => `
          <div class="stock-import-preview-row">
            <div>
              <b>${r.action === "add" ? "เพิ่ม" : "อัปเดต"} · ${esc(r.item.name)}</b>
              <small>${r.item.code ? `รหัส ${esc(r.item.code)} · ` : ""}${esc(r.item.size || "-")} · ${esc(r.item.unit || "-")}${r.match === "code" ? " · เทียบจากรหัส" : ""}</small>
            </div>
            <span>${r.action === "add" ? "รายการใหม่" : (r.changes || []).slice(0, 4).map(stockImportChangeText).join(" · ")}</span>
          </div>`).join("")}
      </div>
      ${changed.length > shown.length ? `<div class="sale-more-hint">แสดง 80 รายการแรก · ยังมีอีก ${fmtNum(changed.length - shown.length)} รายการ</div>` : ""}
    `}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="App.confirmImportProducts()" ${changed.length ? "" : "disabled"}>${ic("save")} บันทึกจริง</button>
    </div>`;
}
function stockImportPreviewOptionsHtml(options) {
  const o = Object.assign(stockImportDefaultOptions("full"), options || {});
  return `
    <div class="stock-import-options stock-import-options-preview">
      <div class="bold">${ic("check")} ปรับตัวเลือกแล้ว Preview จะเปลี่ยนทันที</div>
      ${["addNew", "updatePrices", "updateMeta", "updateQty", "updatePhotos"].map(k => {
        const meta = {
          addNew: ["เพิ่มสินค้าใหม่", "เพิ่มรายการที่ยังไม่มีในสต็อก"],
          updatePrices: ["อัปเดตราคา", "ต้นทุน / ทั่วไป / ลูกค้าประจำ"],
          updateMeta: ["อัปเดตข้อมูลสินค้า", "รหัส ชื่อสามัญ และหมวด"],
          updateQty: ["อัปเดตจำนวน", "ใช้จำนวนจาก Excel ทับจำนวนเดิม"],
          updatePhotos: ["อัปเดตรูป", "ใช้ชื่อรูปจาก Excel ทับรูปเดิม"]
        }[k];
        return `
          <label class="stock-import-option">
            <input type="checkbox" ${o[k] ? "checked" : ""} onchange="App.stockImportOption('${k}', this.checked)">
            <span><b>${meta[0]}</b><small>${meta[1]}</small></span>
          </label>`;
      }).join("")}
    </div>`;
}
App.stockImportOption = function (key, value) {
  const pending = App._stockImportPending;
  if (!pending || !pending.products || !pending.options || pending.options.priceOnly) return;
  pending.options[key] = !!value;
  pending.plan = stockImportPlan(S, pending.products, pending.options);
  openModal(stockImportPreviewHtml(pending));
};
/* เลือกไฟล์จริงและนำเข้า (เรียกจากปุ่มในหน้าต่างคำแนะนำ) */
App.pickImportFile = function () {
  const options = stockImportOptionsFromForm();
  closeModal();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  input.style.display = "none";
  document.body.appendChild(input);
  input.onchange = async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    try {
      const { products, sheetName } = await parseXlsxProducts(file);
      if (!products.length) { toast("ไม่พบรายการสินค้าในไฟล์"); return; }
      const plan = stockImportPlan(S, products, options);
      App._stockImportPending = { products, plan, sheetName, fileName: file.name, options };
      openModal(stockImportPreviewHtml(App._stockImportPending));
    } catch (err) {
      toast("อ่านไฟล์ไม่สำเร็จ: " + (err && err.message ? err.message : "ไฟล์ไม่ใช่ .xlsx"));
      console.error(err);
    }
  };
  input.click();
};
App.confirmImportProducts = function () {
  const pending = App._stockImportPending;
  if (!pending || !pending.products) { toast("ไม่มีไฟล์รอบันทึก"); return; }
  const { added, updated, skipped, missing } = mergeStockProducts(S, pending.products, pending.options || {});
  App._stockImportPending = null;
  saveState(S);
  closeModal();
  render();
  toast(pending.options && pending.options.priceOnly
    ? `อัปเดตราคาแล้ว ${fmtNum(updated)} รายการ${skipped ? ` · ไม่เปลี่ยน ${fmtNum(skipped)}` : ""}${missing ? ` · ไม่พบในสต็อก ${fmtNum(missing)}` : ""}`
    : `นำเข้าสินค้าแล้ว ${fmtNum(added)} รายการ${updated ? ` · อัปเดต ${fmtNum(updated)}` : ""}${skipped ? ` · ไม่เปลี่ยน ${fmtNum(skipped)}` : ""}${pending.sheetName ? ` จากชีต "${pending.sheetName}"` : ""}`);
};
