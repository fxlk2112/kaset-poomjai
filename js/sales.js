/* ---------------- การขายสินค้า + ใบเสร็จรับเงิน ---------------- */
let saleItems = [];      // รายการขายชั่วคราว: {stockId, name, unit, qty, price}
let saleQueries = {};    // คำค้นหาสต็อกต่อแถว
/* ขายจากสต็อกหลัก (หน่วยเต็ม) เท่านั้น — ไม่นับของที่เปิดใช้แล้ว */
function saleAvail(x) { return Math.floor(Number(x.qty) || 0); }
function saleItemsHtml(i) {
  const it = saleItems[i];
  if (!it) return "";
  const q = (saleQueries[i] || "").trim().toLowerCase();
  const list = S.stock.filter(x => {
    const avail = saleAvail(x);
    if (avail <= 0) return false;
    return !q || x.name.toLowerCase().includes(q) || (x.code || "").toLowerCase().includes(q) || x.unit.toLowerCase().includes(q) || (x.category || "").toLowerCase().includes(q);
  });
  if (!list.length) return `<div class="muted" style="font-size:.72rem;padding:6px 2px">${q ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีของในสต็อกหลัก — ไปรับของเข้าก่อน"}</div>`;
  let shown = q ? list.slice(0, 20) : list.slice(0, 5);
  if (it.stockId && !shown.some(x => x.id === it.stockId)) {
    const picked = list.find(x => x.id === it.stockId) || stockById(S, it.stockId);
    if (picked && saleAvail(picked) > 0) shown = [picked, ...shown].slice(0, q ? 20 : 5);
  }
  const more = list.length - shown.length;
  return shown.map(x => {
    const sel = it.stockId === x.id;
    const sub = `ขายได้ ${fmtNum(saleAvail(x))} ${esc(x.unit)}`;
    const sp = Number(x.salePrice) || 0;
    return `<button type="button" class="stock-pick-item ${sel ? "selected" : ""}" onclick="App.salePick(${i}, '${x.id}')" ${sel ? `title="กดอีกครั้งเพื่อเอารายการนี้ออก"` : ""}>
      <span class="sp-name">${esc(x.name)}</span>${sel ? `<span class="sp-x">✕</span>` : (sp ? `<span class="sp-sub">${sub} · ขาย ${fmtMoney(sp)} บาท</span>` : `<span class="sp-sub">${sub}</span>`)}
    </button>`;
  }).join("") + (more > 0 ? `<div class="sale-more-hint">${q ? `แสดง 20 รายการแรก · เหลือ ${fmtNum(more)} รายการ` : `พิมพ์ค้นหาเพื่อดูอีก ${fmtNum(more)} รายการ`}</div>` : "");
}
App.saleQuery = function (i, v) {
  saleQueries[i] = v;
  const el = document.getElementById("salePickList_" + i);
  if (el) el.innerHTML = saleItemsHtml(i);
};
App.salePick = function (i, id) {
  const it = saleItems[i];
  if (!it) return;
  /* กดรายการที่เลือกอยู่ซ้ำ -> ยกเลิกการเลือก (เอารายการนี้ออก ไม่ต้องลบทั้งแถว) */
  if (it.stockId === id) {
    it.stockId = ""; it.name = ""; it.unit = ""; it.price = 0;
    App.saleRender();
    return;
  }
  const x = stockById(S, id);
  if (!x) return;
  it.stockId = id;
  it.name = x.name;
  it.unit = x.unit;
  it.price = Number(x.salePrice) || 0;
  it.qty = it.qty || 1;
  App.saleRender();
};
App.saleSet = function (i, field, v) {
  const it = saleItems[i];
  if (!it) return;
  it[field] = v;
  App.saleSum();
};
App.saleAdd = function () {
  saleItems.push({ stockId: "", name: "", unit: "", qty: 1, price: 0 });
  App.saleRender();
};
App.saleRemove = function (i) {
  saleItems.splice(i, 1);
  App.saleRender();
};
function saleLineTotal(it) {
  return Math.round((Number(it.qty) || 0) * (Number(it.price) || 0));
}
App.saleSum = function () {
  const el = document.getElementById("saleTotal");
  if (!el) return;
  const sum = saleItems.reduce((a, it) => a + saleLineTotal(it), 0);
  el.textContent = fmtMoney(sum) + " บาท";
  /* ยอดหลังหักส่วนลด */
  const disc = Number((document.getElementById("sale_discount") || {}).value) || 0;
  const gt = document.getElementById("saleGrandTotal");
  if (gt) gt.value = fmtMoney(Math.max(0, sum - disc)) + " บาท";
};
App.saleRender = function () {
  const list = document.getElementById("saleItemsList");
  if (!list) return;
  list.innerHTML = saleItems.map((it, i) => `
    <div class="usage-row">
      <div class="usage-row-head">
        <strong>รายการที่ ${i + 1}</strong>
        <button type="button" class="btn btn-sm btn-danger-soft" onclick="App.saleRemove(${i})">${ic("trash")} ลบ</button>
      </div>
      <div class="field"><label>เลือกสินค้า</label>
        <div class="stock-picker">
          <input class="sp-search" type="text" placeholder="ค้นหาปุ๋ย/ยา/เมล็ด..." value="${esc(saleQueries[i] || "")}" oninput="App.saleQuery(${i}, this.value)">
          <div class="stock-pick-list" id="salePickList_${i}">${saleItemsHtml(i)}</div>
        </div>
      </div>
      ${it.stockId ? `
      <div class="form-row-2">
        <div class="field"><label>จำนวน * (หน่วยเต็ม)</label><input type="number" min="1" max="${saleAvail(stockById(S, it.stockId))}" step="1" value="${it.qty}" oninput="App.saleSet(${i}, 'qty', this.value)">
          <div class="hint">ขายเป็นหน่วยเต็มเท่านั้น (ขายได้ ${fmtNum(saleAvail(stockById(S, it.stockId)))} ${esc(it.unit)})</div></div>
        <div class="field"><label>ราคา/หน่วย (บาท)</label><input type="number" min="0" step="0.5" value="${it.price || ""}" oninput="App.saleSet(${i}, 'price', this.value)"></div>
      </div>
      <div class="row row-between muted" style="font-size:.78rem;padding:2px 2px 0"><span>รวมรายการนี้</span><b>${fmtMoney(saleLineTotal(it))} บาท</b></div>` : ""}
    </div>`).join("");
  App.saleSum();
};
/* เปิดฟอร์มขายสินค้า — ใส่ saleId เพื่อแก้ไขใบเสร็จเดิม */
App.modalSale = function (saleId) {
  const editing = saleId ? (S.sales || []).find(x => x.id === saleId) : null;
  saleItems = editing
    ? editing.items.map(it => ({ stockId: it.stockId, name: it.name, unit: it.unit, qty: it.qty, price: it.price }))
    : [{ stockId: "", name: "", unit: "", qty: 1, price: 0 }];
  saleQueries = {};
  const today = todayISO();
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("dollar")} ${editing ? `แก้ไขใบเสร็จ #${editing.no}` : "ขายสินค้า / ออกใบเสร็จ"}</h3>
    <div class="modal-sub">${editing ? "แก้ไขรายการ — ระบบคืนสต็อกของเดิม แล้วตัดใหม่ตามที่แก้" : "เลือกสินค้า (หลายรายการได้) ระบบตัดสต็อกและออกใบเสร็จรับเงินให้อัตโนมัติ"}</div>
    <form onsubmit="return App.submitSale(event, '${editing ? editing.id : ""}')">
      <div class="form-row-2">
        <div class="field"><label>ชื่อลูกค้า</label><input id="sale_customer" list="saleCustomerList" placeholder="พิมพ์หรือเลือกลูกค้าเดิม..." autocomplete="off" value="${editing ? esc(editing.customer || "") : ""}">
          <datalist id="saleCustomerList">${customerList(S).map(c => `<option value="${esc(c.name)}">`).join("")}</datalist>
          ${customerList(S).length ? `<div class="hint" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">ลูกค้าเดิม: ${customerList(S).slice(0, 4).map(c => `<button type="button" class="chip" onclick="App.salePickCustomer('${esc(c.name)}')">${esc(c.name)}</button>`).join("")}</div>` : `<div class="hint">ลูกค้าที่เคยซื้อจะโผล่ที่นี่ ไม่ต้องพิมพ์ซ้ำ</div>`}
        </div>
        <div class="field"><label>วันที่</label><input id="sale_date" type="date" value="${editing ? editing.date : today}"></div>
      </div>
      <div id="saleItemsList"></div>
      <button type="button" class="btn btn-ghost btn-block" onclick="App.saleAdd()">${ic("plus")} เพิ่มรายการสินค้า</button>
      <div class="row row-between" style="background:var(--green-soft);border-radius:10px;padding:10px 12px;margin-top:10px">
        <span class="bold">รวมเป็นเงิน</span><span class="bold" style="font-size:1.1rem" id="saleTotal">0 บาท</span>
      </div>
      <div class="form-row-2">
        <div class="field" style="margin-top:8px"><label>ส่วนลด (บาท)</label><input id="sale_discount" type="number" min="0" step="1" value="${editing ? (editing.discount || "") : ""}" oninput="App.saleSum()" placeholder="0"></div>
        <div class="field" style="margin-top:8px"><label>ยอดหลังหักส่วนลด</label><input id="saleGrandTotal" type="text" readonly value="0 บาท" style="font-weight:800;color:var(--green-deep)"></div>
      </div>
      <div class="field"><label>หมายเหตุ</label><input id="sale_note" placeholder="เช่น ส่งของให้ลูกค้า / วางบิล" autocomplete="off" value="${editing ? esc(editing.note || "") : ""}"></div>
      <div class="field"><label>ชำระโดย</label>
        <div class="row" style="gap:14px">
          <label class="row" style="gap:5px;cursor:pointer"><input type="radio" name="sale_pay" value="cash" ${!editing || editing.payMethod !== "transfer" ? "checked" : ""} onchange="App.salePayToggle()"> เงินสด</label>
          <label class="row" style="gap:5px;cursor:pointer"><input type="radio" name="sale_pay" value="transfer" ${editing && editing.payMethod === "transfer" ? "checked" : ""} onchange="App.salePayToggle()"> โอนเงิน</label>
        </div>
      </div>
      <div class="field" id="saleAcctBox" ${editing && editing.payMethod === "transfer" ? "" : "hidden"}><label>เลขบัญชีร้าน (ให้ลูกค้าโอนมา)</label><input id="sale_acct" placeholder="เช่น 123-4-56789-0 (สาขา...)" autocomplete="off" value="${editing ? esc(editing.account || "") : ""}"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button>
        <button type="submit" class="btn btn-primary">${ic("check")} ${editing ? "บันทึกการแก้ไข" : "บันทึก + ออกใบเสร็จ"}</button>
      </div>
    </form>`);
  App.saleRender();
};
/* กดลูกค้าเดิม -> ใส่ชื่อให้อัตโนมัติ */
App.salePickCustomer = function (name) {
  const el = document.getElementById("sale_customer");
  if (el) el.value = name;
};
/* แสดง/ซ่อนช่องเลขบัญชีตามวิธีชำระ */
App.salePayToggle = function () {
  const sel = document.querySelector("input[name='sale_pay']:checked");
  const box = document.getElementById("saleAcctBox");
  if (box) box.hidden = !(sel && sel.value === "transfer");
};
/* บันทึกการขาย → ตัดสต็อก → เปิดใบเสร็จ (หรือแก้ไขใบเดิม: คืนสต็อกเดิมแล้วตัดใหม่) */
App.submitSale = function (e, saleId) {
  e.preventDefault();
  const items = saleItems.filter(it => it.stockId && (Number(it.qty) || 0) > 0);
  if (!items.length) { toast("เลือกสินค้าและระบุจำนวนก่อน"); return false; }
  /* เช็คจำนวนเต็ม */
  for (const it of items) {
    if (!Number.isInteger(Number(it.qty))) { toast(`จำนวนต้องเป็นหน่วยเต็ม: ${it.name}`); return false; }
  }
  /* กรณีแก้ไข: เช็คของพอโดยนับของเดิมที่จะคืนกลับเข้ามาด้วย */
  const editing = saleId ? (S.sales || []).find(x => x.id === saleId) : null;
  for (const it of items) {
    const x = stockById(S, it.stockId);
    if (!x) continue;
    const oldQty = editing ? (editing.items || []).find(o => o.stockId === it.stockId) : null;
    const avail = saleAvail(x) + (oldQty ? (Number(oldQty.qty) || 0) : 0);
    if ((Number(it.qty) || 0) > avail) { toast(`ของไม่พอ: ${x.name} (ขายได้ ${fmtNum(avail)} ${x.unit})`); return false; }
  }
  const data = {
    date: document.getElementById("sale_date").value || todayISO(),
    customer: document.getElementById("sale_customer").value,
    items,
    discount: document.getElementById("sale_discount").value,
    note: document.getElementById("sale_note").value,
    payMethod: (document.querySelector("input[name='sale_pay']:checked") || {}).value,
    account: document.getElementById("sale_acct").value
  };
  const sale = editing ? updateSale(S, editing.id, data) : addSale(S, data);
  saveState(S);
  closeModal();
  render();
  toast(editing ? "บันทึกการแก้ไขใบเสร็จแล้ว · ปรับสต็อกแล้ว" : "บันทึกการขายแล้ว");
  App.viewSale(sale.id);
  return false;
};
/* เติมแถวว่างให้ตารางใบส่งสินค้าไม่ต่ำกว่า 8 แถว (เหมือนไฟล์ตัวอย่าง) */
function emptyRowsHtml(n) {
  let h = "";
  for (let i = n; i < 8; i++) h += `<tr class="receipt-empty-row"><td colspan="7"></td></tr>`;
  return h;
}
function saleShareText(sale) {
  const total = saleTotal(sale);
  const disc = Number(sale.discount) || 0;
  const grand = saleGrandTotal(sale);
  const payTxt = sale.payMethod === "transfer" ? `โอนเงิน${sale.account ? ` (${sale.account})` : ""}` : "เงินสด";
  const lines = [
    `${T("brandName")} - ใบส่งสินค้า #${sale.no}`,
    `วันที่ ${dateLabel(sale.date)}${sale.customer ? ` | ลูกค้า ${sale.customer}` : ""}`,
    "",
    ...(sale.items || []).map((it, i) => `${i + 1}. ${it.name}${it.code ? ` (${it.code})` : ""} ${fmtNum(it.qty)} ${it.unit || ""} x ${fmtMoney(it.price)} = ${fmtMoney(it.total)} บาท`),
    "",
    `รวม ${fmtMoney(total)} บาท`,
    disc > 0 ? `ส่วนลด ${fmtMoney(disc)} บาท` : "",
    `ยอดสุทธิ ${fmtMoney(grand)} บาท`,
    `ชำระโดย ${payTxt}`,
    sale.note ? `หมายเหตุ: ${sale.note}` : ""
  ];
  return lines.filter((line, idx, arr) => line || (arr[idx - 1] && arr[idx + 1])).join("\n");
}
App.copySaleSummary = async function (id) {
  const sale = (S.sales || []).find(x => x.id === id);
  if (!sale) return;
  const text = saleShareText(sale);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast("คัดลอกสรุปใบส่งสินค้าแล้ว");
      return;
    }
  } catch (e) {}
  window.prompt("คัดลอกข้อความนี้ส่งลูกค้า", text);
};
App.shareSaleSummary = async function (id) {
  const sale = (S.sales || []).find(x => x.id === id);
  if (!sale) return;
  const text = saleShareText(sale);
  const title = `ใบส่งสินค้า #${sale.no}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      toast("เปิดหน้าต่างแชร์แล้ว");
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  const url = "https://line.me/R/msg/text/?" + encodeURIComponent(text);
  window.open(url, "_blank", "noopener");
  toast("เปิด LINE สำหรับส่งใบสินค้าแล้ว");
};
/* ใบส่งสินค้า (A4) — รูปแบบตามไฟล์ตัวอย่าง */
App.viewSale = function (id) {
  const sale = (S.sales || []).find(x => x.id === id);
  if (!sale) return;
  const rows = sale.items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="text-align:center">${esc(it.code || "")}</td>
      <td>${esc(it.name)}</td>
      <td style="text-align:center">${fmtNum(it.qty)}</td>
      <td style="text-align:center">${esc(it.unit)}</td>
      <td style="text-align:right">${fmtMoney(it.price)}</td>
      <td style="text-align:right">${fmtMoney(it.total)}</td>
    </tr>`).join("");
  const total = saleTotal(sale);
  const disc = Number(sale.discount) || 0;
  const grand = saleGrandTotal(sale);
  const payTxt = sale.payMethod === "transfer" ? `โอนเงิน${sale.account ? ` เข้าบัญชี ${esc(sale.account)}` : ""}` : "เงินสด";
  let grandTxt = "";
  try { grandTxt = thaiBahtText(grand); } catch (e) { grandTxt = ""; }
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("box")} ใบส่งสินค้า เลขที่ ${sale.no}</h3>
    <div class="receipt" id="receiptArea">
      <div class="receipt-head">
        <div class="receipt-brand">${esc(T("brandName"))}</div>
        <div class="receipt-no">ใบส่งสินค้า เลขที่ ${sale.no}</div>
      </div>
      <div class="receipt-meta">
        <div class="receipt-cust"><span>ชื่อ</span><b>${sale.customer ? esc(sale.customer) : "—"}</b></div>
        <div class="receipt-date"><span>วันที่</span><b>${dateLabel(sale.date)} (${sale.date})</b></div>
      </div>
      <table class="receipt-table">
        <thead><tr><th style="width:36px">ลำดับ</th><th style="width:80px">รหัส</th><th>รายการ</th><th style="width:52px">จำนวน</th><th style="width:70px">หน่วย/ชิ้น</th><th style="width:86px">ราคาต่อหน่วย</th><th style="width:90px">ราคารวม</th></tr></thead>
        <tbody>${rows}
        ${emptyRowsHtml(sale.items.length)}
        </tbody>
      </table>
      <div class="receipt-total">
        <div class="row row-between"><span>รวมเป็นเงิน</span><b>${fmtMoney(total)} บาท</b></div>
        ${disc > 0 ? `<div class="row row-between"><span>ส่วนลด</span><b>${fmtMoney(disc)} บาท</b></div>` : ""}
        <div class="row row-between"><span>ยอดหลังหักส่วนลด</span><b>${fmtMoney(grand)} บาท</b></div>
        <div class="row row-between receipt-grand"><span>จำนวนเงินทั้งสิ้น</span><b>${fmtMoney(grand)} บาท</b></div>
        ${grandTxt ? `<div class="receipt-baht">(${esc(grandTxt)})</div>` : ""}
      </div>
      ${sale.note ? `<div class="receipt-note"><span>หมายเหตุ</span> ${esc(sale.note)}</div>` : ""}
      <div class="receipt-sign">
        <div><div class="receipt-sign-label">ผู้รับของ</div><div class="receipt-sign-line">(......................................)</div><div class="receipt-sign-date">....../......../..........</div></div>
        <div><div class="receipt-sign-label">ผู้ส่งของ</div><div class="receipt-sign-line">(......................................)</div><div class="receipt-sign-date">....../......../..........</div></div>
      </div>
      <div class="receipt-foot">ชำระโดย ${payTxt} · ${esc(T("brandSub"))}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-primary" onclick="App.shareSaleSummary('${sale.id}')">${ic("share")} แชร์</button>
      <button class="btn btn-outline" onclick="App.copySaleSummary('${sale.id}')">${ic("copy")} คัดลอกส่งลูกค้า</button>
      <button class="btn btn-outline" onclick="App.modalSale('${sale.id}')">${ic("pencil")} แก้ไข</button>
      <button class="btn btn-danger-soft" onclick="App.voidSale('${sale.id}')">${ic("trash")} ยกเลิกใบ</button>
      <button class="btn btn-outline" onclick="App.printSale()">${ic("save")} พิมพ์ A4</button>
    </div>`);
};
/* พิมพ์ใบเสร็จ — พิมพ์เฉพาะส่วน .receipt */
/* แปลงจำนวนเงินเป็นตัวอักษรไทย เช่น 1,250 -> หนึ่งพันสองร้อยห้าสิบบาทถ้วน */
function thaiBahtText(n) {
  n = Math.round(Number(n) || 0);
  if (n <= 0) return "ศูนย์บาทถ้วน";
  const numThai = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const digits = String(n).split("").map(Number);
  const len = digits.length;
  let out = "";
  const groups = [
    { val: 1000000, name: "ล้าน" },
    { val: 100000, name: "แสน" },
    { val: 10000, name: "หมื่น" },
    { val: 1000, name: "พัน" },
    { val: 100, name: "ร้อย" },
    { val: 10, name: "สิบ" },
    { val: 1, name: "" }
  ];
  let prev = 0;
  for (const g of groups) {
    const d = Math.floor(n / g.val) % 10;
    if (d === 0) { prev = d; continue; }
    if (g.val === 1) {
      if (d === 1 && prev !== 0 && prev !== 1) out += "เอ็ด";
      else if (d === 1 && prev === 0) out += "หนึ่ง";
      else if (d === 2 && prev === 0) out += "สอง";
      else out += numThai[d];
    } else if (g.val === 10) {
      out += (d === 1 ? "" : (d === 2 ? "ยี่" : numThai[d])) + "สิบ";
    } else if (g.val === 1000000 && d === 1 && prev === 0) {
      out += "หนึ่งล้าน";
    } else {
      out += (d === 1 ? "หนึ่ง" : numThai[d]) + g.name;
    }
    prev = d;
  }
  return out + "บาทถ้วน";
}
App.printSale = function () {
  const area = document.getElementById("receiptArea");
  if (!area) return;
  const html = area.outerHTML;
  const w = window.open("", "_blank", "width=800,height=1100");
  if (!w) { toast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ — อนุญาตป๊อปอัปแล้วลองใหม่"); return; }
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>ใบส่งสินค้า</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Sarabun, Tahoma, sans-serif; color: #111; margin: 0; font-size: 13px; }
    .receipt { padding: 0; }
    .receipt-head { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
    .receipt-brand { font-size: 1.4rem; font-weight: 800; color: #111; }
    .receipt-no { font-size: .95rem; font-weight: 700; margin-top: 4px; }
    .receipt-meta { display: flex; justify-content: space-between; font-size: .9rem; margin: 8px 0 6px; }
    .receipt-meta span { color: #666; margin-right: 8px; }
    .receipt-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .receipt-table th { border: 1px solid #111; background: #f1f5f4; text-align: center; padding: 5px 4px; font-size: .8rem; }
    .receipt-table td { border: 1px solid #999; padding: 5px 4px; }
    .receipt-empty-row td { border-color: #ccc; height: 20px; }
    .receipt-total { margin-top: 8px; font-size: .9rem; width: 45%; margin-left: auto; }
    .receipt-total .row { display: flex; justify-content: space-between; padding: 3px 6px; }
    .receipt-total .receipt-grand { border-top: 2px solid #111; font-weight: 800; font-size: 1rem; margin-top: 4px; }
    .receipt-baht { font-size: .8rem; padding: 2px 6px; }
    .receipt-note { margin-top: 8px; font-size: .82rem; }
    .receipt-note span { color: #666; }
    .receipt-sign { display: flex; justify-content: space-between; margin-top: 36px; text-align: center; }
    .receipt-sign-label { font-size: .85rem; font-weight: 700; }
    .receipt-sign-line { margin-top: 34px; font-size: .85rem; }
    .receipt-sign-date { font-size: .78rem; color: #444; margin-top: 4px; }
    .receipt-foot { margin-top: 14px; font-size: .75rem; color: #555; text-align: center; }
  </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
};
/* ยกเลิกใบเสร็จ — คืนสต็อก + ลบใบ */
App.voidSale = function (id) {
  App.confirm("ยกเลิกใบเสร็จนี้?", "สต็อกที่ขายไปจะถูกคืนกลับ", () => {
    voidSale(S, id);
    saveState(S);
    closeModal();
    render();
    toast("ยกเลิกใบเสร็จแล้ว · คืนสต็อกแล้ว");
  });
};
/* ประวัติการขาย — รายการใบเสร็จทั้งหมด */
App.saleHistory = function () {
  const sales = [...(S.sales || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("box")} ประวัติการขาย (${sales.length})</h3>
    <div class="modal-sub">${sales.length ? "กดใบเสร็จเพื่อดู/พิมพ์ซ้ำ" : "ยังไม่มีการขาย — กด ขายสินค้า เพื่อออกใบเสร็จใบแรก"}</div>
    ${sales.length === 0 ? `<div class="empty"><div class="e-ico">${ic("dollar")}</div><div class="e-title">ยังไม่มีใบเสร็จ</div></div>` : ""}
    ${sales.map(s => `
      <div class="row-line" onclick="App.viewSale('${s.id}')" role="button" style="cursor:pointer">
        <span class="task-ico" style="background:var(--green-soft);color:var(--green-dark)">${ic("dollar")}</span>
        <div class="grow">
          <div class="bold" style="font-size:.85rem">ใบเสร็จ #${s.no} ${s.customer ? `— ${esc(s.customer)}` : ""}</div>
          <div class="muted" style="font-size:.7rem">${dateLabel(s.date)} · ${s.items.length} รายการ · ${s.payMethod === "transfer" ? "โอนเงิน" : "เงินสด"}</div>
        </div>
        <b class="price-trend-up" style="font-size:.9rem">${fmtMoney(saleGrandTotal(s))}</b>
      </div>`).join("")}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-primary" onclick="App.modalSale()">${ic("dollar")} ขายสินค้า</button>
    </div>`);
};
/* ประวัติลูกค้า — รายชื่อลูกค้าทั้งหมด + ยอดซื้อรวม */
App.customerHistory = function () {
  const customers = customerList(S);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <h3>${ic("user")} ประวัติลูกค้า (${customers.length})</h3>
    <div class="modal-sub">${customers.length ? "กดลูกค้าเพื่อดูว่าซื้ออะไรไปบ้าง" : "ยังไม่มีลูกค้า — กด ขายสินค้า แล้วใส่ชื่อลูกค้า จะบันทึกประวัติให้อัตโนมัติ"}</div>
    ${customers.length === 0 ? `<div class="empty"><div class="e-ico">${ic("user")}</div><div class="e-title">ยังไม่มีข้อมูลลูกค้า</div></div>` : ""}
    ${customers.map(c => `
      <div class="row-line" onclick="App.customerDetail('${esc(c.name)}')" role="button" style="cursor:pointer">
        <span class="task-ico" style="background:var(--green-soft);color:var(--green-dark)">${ic("user")}</span>
        <div class="grow">
          <div class="bold" style="font-size:.88rem">${esc(c.name)}</div>
          <div class="muted" style="font-size:.7rem">${c.count} ครั้ง · ซื้อล่าสุด ${dateLabel(c.lastDate)}</div>
        </div>
        <div style="text-align:right">
          <div class="bold price-trend-up" style="font-size:.9rem">${fmtMoney(c.total)} บาท</div>
          <div class="muted" style="font-size:.66rem">ยอดรวม</div>
        </div>
      </div>`).join("")}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
      <button class="btn btn-primary" onclick="App.modalSale()">${ic("dollar")} ขายสินค้า</button>
    </div>`);
};
/* ประวัติการซื้อของลูกค้ารายคน — ดูทุกใบเสร็จ + รายการสินค้าที่ซื้อ */
App.customerDetail = function (name) {
  const sales = (S.sales || [])
    .filter(s => String(s.customer || "").trim() === name)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
  const total = sales.reduce((a, s) => a + saleGrandTotal(s), 0);
  const items = {}; // สรุปรวมสินค้าที่เคยซื้อ: name -> {qty, unit, total}
  sales.forEach(s => (s.items || []).forEach(it => {
    if (!items[it.name]) items[it.name] = { qty: 0, unit: it.unit, total: 0 };
    items[it.name].qty += it.qty;
    items[it.name].total += it.total;
  }));
  const topItems = Object.entries(items).sort((a, b) => b[1].total - a[1].total);
  openModal(`
    <button class="modal-x" onclick="App.closeModal()">✕</button>
    <div class="row" style="gap:10px;align-items:center">
      <span class="plot-emoji" style="background:var(--green-soft);color:var(--green-dark)">${ic("user")}</span>
      <div class="grow">
        <h3 style="margin:0">${esc(name)}</h3>
        <div class="modal-sub" style="margin-bottom:0">${sales.length} ครั้ง · ยอดซื้อรวม ${fmtMoney(total)} บาท</div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="App.modalSale()">${ic("dollar")} ขายอีก</button>
    </div>
    <div class="section-title" style="margin:14px 2px 6px;font-size:.9rem">${ic("box")} สินค้าที่เคยซื้อ (รวมทุกครั้ง)</div>
    <div class="card" style="padding:6px 14px">
      ${topItems.length === 0 ? `<div class="muted" style="padding:8px;text-align:center;font-size:.8rem">ยังไม่มีรายการสินค้า</div>` : ""}
      ${topItems.map(([n, it]) => `
        <div class="row-line">
          <div class="grow">
            <div class="bold" style="font-size:.84rem">${esc(n)}</div>
            <div class="muted" style="font-size:.68rem">ซื้อรวม ${fmtNum(it.qty)} ${esc(it.unit)}</div>
          </div>
          <b>${fmtMoney(it.total)} บาท</b>
        </div>`).join("")}
    </div>
    <div class="section-title" style="margin:14px 2px 6px;font-size:.9rem">${ic("calendar")} ประวัติใบเสร็จ</div>
    ${sales.map(s => `
      <div class="row-line" onclick="App.viewSale('${s.id}')" role="button" style="cursor:pointer">
        <div class="grow">
          <div class="bold" style="font-size:.84rem">${dateLabel(s.date)} · ใบเสร็จ #${s.no}</div>
          <div class="muted" style="font-size:.68rem">${s.items.length} รายการ · ${s.payMethod === "transfer" ? "โอนเงิน" : "เงินสด"}${s.note ? ` · ${esc(s.note)}` : ""}</div>
        </div>
        <b>${fmtMoney(saleGrandTotal(s))} บาท</b>
      </div>`).join("")}
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="App.customerHistory()">${ic("chevron")} กลับรายชื่อลูกค้า</button>
      <button class="btn btn-ghost" onclick="App.closeModal()">ปิด</button>
    </div>`);
};
