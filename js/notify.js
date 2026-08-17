/* ---------------- การแจ้งเตือน (กระดิ่ง) ---------------- */
/* อัปเดตตัวเลขบนกระดิ่ง: จำนวนงานครบกำหนดวันนี้ + เลยกำหนด ที่ยังไม่เสร็จและยังไม่ปิด */
function updateNotifBadge() {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  const n = notifList(S);
  const cnt = n.overdue.length + n.dueToday.length;
  badge.textContent = cnt > 99 ? "99+" : cnt;
  badge.hidden = cnt === 0;
}
/* เปิด/ปิดแผงแจ้งเตือน */
App.toggleNotif = function () {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;
  if (panel.hidden) {
    renderNotifPanel();
    panel.hidden = false;
  } else {
    panel.hidden = true;
  }
};
/* วาดแผงแจ้งเตือน: กลุ่ม "เลยกำหนด" (แดง) + "ครบกำหนดวันนี้" (เหลือง) */
function renderNotifPanel() {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;
  const n = notifList(S);
  const rowHtml = (t, grp) => {
    const st = taskStatusOf(t);
    const dotCls = st === "done" ? "dot-green" : st === "overdue" ? "dot-red" : "dot-amber";
    return `
    <div class="notif-row" onclick="App.viewTask('${t.id}')" role="button" tabindex="0" style="cursor:pointer">
      <span class="task-ico ${esc(t.type)}">${ic(TYPE_ICONS[t.type] || "wrench")}</span>
      <div class="grow">
        <div class="bold" style="font-size:.82rem">${esc(t.title)}</div>
        <div class="muted" style="font-size:.68rem">${grp === "overdue" ? `${ic("alert")} เลยกำหนด ${dateLabel(t.date)}` : `${ic("calendar")} ครบกำหนดวันนี้ ${dateLabel(t.date)}`} ${typeTag(t)}</div>
      </div>
      <button class="task-dot ${dotCls}" onclick="event.stopPropagation();App.toggleTask('${t.id}')" aria-label="สลับสถานะเสร็จ" title="ทำเสร็จ"></button>
      <button class="notif-x" onclick="event.stopPropagation();App.dismissNotif('${t.id}')" aria-label="ปิดการแจ้งเตือน" title="ปิดการแจ้งเตือนนี้">✕</button>
    </div>`;
  };
  const overdueHtml = n.overdue.length ? `
    <div class="notif-group"><h3>${ic("alert")} เลยกำหนด (${n.overdue.length})</h3>${n.overdue.map(t => rowHtml(t, "overdue")).join("")}</div>` : "";
  const dueHtml = n.dueToday.length ? `
    <div class="notif-group"><h3>${ic("calendar")} ครบกำหนดวันนี้ (${n.dueToday.length})</h3>${n.dueToday.map(t => rowHtml(t, "due")).join("")}</div>` : "";
  const emptyHtml = (n.overdue.length + n.dueToday.length) === 0 ? `
    <div class="notif-empty">${ic("check")} ไม่มีงานครบกำหนดหรือเลยกำหนด</div>` : "";
  panel.innerHTML = `
    <div class="notif-head">
      <span>${ic("bell")} การแจ้งเตือน</span>
      ${(n.overdue.length + n.dueToday.length) ? `<button class="btn btn-sm btn-ghost" onclick="App.dismissAllNotifs()">${ic("check")} ล้างทั้งหมด</button>` : ""}
    </div>
    ${overdueHtml}${dueHtml}${emptyHtml}`;
}
/* ปิดการแจ้งเตือนของงานนี้ (ซ่อนออกจากกระดิ่ง/แผง) */
App.dismissNotif = function (id) {
  S.notifDismissed[id] = true;
  saveState(S);
  renderNotifPanel();
  updateNotifBadge();
};
/* ล้างทั้งหมด — ปิดการแจ้งเตือนทุกงานที่กำลังแสดง */
App.dismissAllNotifs = function () {
  const n = notifList(S);
  [...n.overdue, ...n.dueToday].forEach(t => { S.notifDismissed[t.id] = true; });
  saveState(S);
  renderNotifPanel();
  updateNotifBadge();
};
/* กดคลิกนอกแผง → ปิด */
document.addEventListener("click", e => {
  const panel = document.getElementById("notifPanel");
  const btn = document.getElementById("notifBtn");
  if (!panel || panel.hidden) return;
  if (btn && btn.contains(e.target)) return;
  if (panel.contains(e.target)) return;
  panel.hidden = true;
});
