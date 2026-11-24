/* Projects group existing farm activities into editable phases. They do not duplicate tasks or costs. */
"use strict";

let projectListFilter = "active";
function projectById(id) { return (S.projects || []).find(p => p.id === id); }
function projectStageById(p, id) { return (p?.stages || []).find(stage => stage.id === id); }
function projectTaskList(p, stageId) {
  return (S.tasks || []).filter(t => t.projectId === p.id && (!stageId || t.projectStageId === stageId))
    .sort((a, b) => (a.status === "planned" ? 0 : 1) - (b.status === "planned" ? 0 : 1) || String(a.date).localeCompare(String(b.date)));
}
function projectCounts(p) {
  const tasks = projectTaskList(p);
  return { total: tasks.length, done: tasks.filter(t => t.status === "done").length,
    planned: tasks.filter(t => t.status === "planned").length, failed: tasks.filter(t => t.status === "failed").length };
}
function projectProgress(p) {
  const n = projectCounts(p);
  return n.total ? Math.round(n.done / n.total * 100) : 0;
}
function projectStageProgress(tasks) {
  if (!tasks.length) return "ยังไม่มีงาน";
  const done = tasks.filter(t => t.status === "done").length;
  return `${fmtNum(done)}/${fmtNum(tasks.length)} งานเสร็จ`;
}
function projectTaskRow(t, p) {
  const plot = t.plotId ? plotById(S, t.plotId) : null;
  const when = ["done", "failed"].includes(t.status) ? taskDoneDate(t) : t.date;
  return `<div class="project-task-row"><button type="button" class="project-task-open" onclick="App.viewTask('${t.id}')"><b>${esc(t.title)}</b><small>${esc(dateLabel(when))} · ${esc(plot?.name || "งานส่วนกลาง")} · ${t.status === "done" ? "เสร็จ" : t.status === "failed" ? "ทำไม่ได้" : "รอทำ"}</small></button><select aria-label="ย้าย ${esc(t.title)} ไปช่วงอื่น" onchange="App.projectMoveTask('${t.id}',this.value)"><option value="">เอาออกจากโครงการ</option>${p.stages.map(stage => `<option value="${stage.id}" ${t.projectStageId === stage.id ? "selected" : ""}>${esc(stage.name)}</option>`).join("")}</select></div>`;
}
function renderProjectDetail() {
  const p = projectById(route.projectId);
  if (!p) return `<div class="project-page"><button class="btn btn-ghost" onclick="App.projectBack()">กลับไปโครงการ</button><p>ไม่พบโครงการนี้</p></div>`;
  const counts = projectCounts(p);
  const stages = p.stages || [];
  return `<div class="project-page"><div class="project-back"><button class="btn btn-ghost btn-sm" onclick="App.projectBack()">← โครงการทั้งหมด</button></div>
    <header class="project-head card"><div class="project-head-main"><span class="project-eyebrow">โครงการ · ${p.status === "done" ? "ปิดแล้ว" : "กำลังดำเนินการ"}</span><h1>${esc(p.name)}</h1>${p.description ? `<p>${esc(p.description)}</p>` : ""}</div><div class="project-head-actions"><button class="btn btn-ghost btn-sm" onclick="App.projectEditModal('${p.id}')">${ic("pencil")} แก้ไข</button><button class="btn btn-ghost btn-sm" onclick="App.projectToggleStatus('${p.id}')">${p.status === "done" ? "เปิดโครงการอีกครั้ง" : "ปิดโครงการ"}</button></div>
    <div class="project-progress"><div><b>${fmtNum(counts.done)}/${fmtNum(counts.total)} งานเสร็จ</b><span>${fmtNum(counts.planned)} รอทำ${counts.failed ? ` · ${fmtNum(counts.failed)} ทำไม่ได้` : ""}</span></div><div class="project-progress-bar" role="progressbar" aria-label="งานที่ทำเสร็จ" aria-valuenow="${projectProgress(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${projectProgress(p)}%"></i></div></div></header>
    <div class="project-section-head"><div><h2>ช่วงงาน</h2><p>เพิ่มกิจกรรมหรือเชื่อมงานเดิมได้ แม้จะอยู่คนละแปลง</p></div>${stages.length < 8 ? `<button class="btn btn-outline btn-sm" onclick="App.projectStageModal('${p.id}')">${ic("plus")} เพิ่มช่วง</button>` : ""}</div>
    <div class="project-stages">${stages.map((stage, i) => {
      const tasks = projectTaskList(p, stage.id), done = tasks.filter(t => t.status === "done").length;
      const status = tasks.length && done === tasks.length ? "complete" : tasks.length && done ? "progress" : "waiting";
      return `<section class="card project-stage" aria-label="ช่วง ${i + 1}: ${esc(stage.name)}"><div class="project-stage-top"><span class="project-stage-number">${i + 1}</span><div><h3>${esc(stage.name)}</h3><small>${projectStageProgress(tasks)}</small></div><span class="project-stage-status ${status}">${status === "complete" ? "ครบแล้ว" : status === "progress" ? "กำลังทำ" : "รอทำ"}</span></div>
        <div class="project-stage-tasks">${tasks.length ? tasks.slice(0, 6).map(t => projectTaskRow(t, p)).join("") : `<p class="project-stage-empty">ยังไม่มีงานในช่วงนี้</p>`}${tasks.length > 6 ? `<details class="project-more-tasks"><summary>ดูอีก ${fmtNum(tasks.length - 6)} งาน</summary>${tasks.slice(6).map(t => projectTaskRow(t, p)).join("")}</details>` : ""}</div>
        ${p.status === "done" ? '<p class="project-stage-empty">เปิดโครงการอีกครั้งเพื่อเพิ่มงาน</p>' : `<div class="project-stage-footer"><button class="btn btn-primary btn-sm" onclick="App.projectNewTask('${p.id}','${stage.id}')">${ic("plus")} สร้างกิจกรรม</button><button class="btn btn-ghost btn-sm" onclick="App.projectLinkModal('${p.id}','${stage.id}')">เชื่อมกิจกรรมเดิม</button></div>`}
        <details class="project-stage-manage"><summary>จัดการช่วงนี้</summary><div><button class="btn btn-ghost btn-sm" onclick="App.projectStageModal('${p.id}','${stage.id}')">เปลี่ยนชื่อ</button>${i ? `<button class="btn btn-ghost btn-sm" onclick="App.projectMoveStage('${p.id}','${stage.id}',-1)">เลื่อนขึ้น</button>` : ""}${i < stages.length - 1 ? `<button class="btn btn-ghost btn-sm" onclick="App.projectMoveStage('${p.id}','${stage.id}',1)">เลื่อนลง</button>` : ""}${stages.length > 1 ? `<button class="btn btn-danger-soft btn-sm" onclick="App.projectRemoveStage('${p.id}','${stage.id}')">ลบช่วง</button>` : ""}</div></details>
      </section>`;
    }).join("")}</div>
    <div class="project-footnote">โครงการช่วยจัดกลุ่มงานเท่านั้น ต้นทุนและการตัดสต็อกยังนับตามกิจกรรมจริงเพียงครั้งเดียว</div></div>`;
}
function renderProjects() {
  if (route.view === "projectDetail") return renderProjectDetail();
  const all = (S.projects || []).slice().sort((a,b) => (a.status === "done") - (b.status === "done") || (b.createdAt || 0) - (a.createdAt || 0));
  const shown = all.filter(p => projectListFilter === "all" || (p.status === "done" ? "done" : "active") === projectListFilter);
  return `<div class="project-page"><header class="project-list-head"><div><h1>โครงการ</h1><p>รวมงานหลายแปลงไว้เป็นช่วง ดูสิ่งที่เสร็จและสิ่งที่ต้องทำต่อ</p></div><button class="btn btn-primary" onclick="App.projectCreateModal()">${ic("plus")} สร้างโครงการ</button></header>
    <div class="project-filters" role="group" aria-label="กรองโครงการ">${[["active","กำลังทำ"],["done","ปิดแล้ว"],["all","ทั้งหมด"]].map(([key,label]) => `<button class="${projectListFilter === key ? "active" : ""}" aria-pressed="${projectListFilter === key}" onclick="App.projectFilter('${key}')">${label}</button>`).join("")}</div>
    ${shown.length ? `<div class="project-grid">${shown.map(p => { const n = projectCounts(p), next = projectTaskList(p).find(t => t.status === "planned"); return `<article class="card project-card"><button class="project-card-open" onclick="App.projectOpen('${p.id}')"><span class="project-eyebrow">${p.status === "done" ? "ปิดแล้ว" : "กำลังดำเนินการ"} · ${p.stages.length} ช่วง</span><h2>${esc(p.name)}</h2>${p.description ? `<p>${esc(p.description)}</p>` : ""}<div class="project-card-progress"><span>${fmtNum(n.done)}/${fmtNum(n.total)} งานเสร็จ</span><span>${projectProgress(p)}%</span></div><div class="project-progress-bar"><i style="width:${projectProgress(p)}%"></i></div>${p.status === "done" ? `<small class="project-card-next">ปิดโครงการแล้ว${n.planned ? ` · ยังมี ${fmtNum(n.planned)} งานรอทำในกิจกรรม` : ""}</small>` : next ? `<small class="project-card-next">ถัดไป: ${esc(next.title)} · ${esc(dateLabel(next.date))}</small>` : `<small class="project-card-next">${n.total ? "ไม่มีงานรอทำ" : "เริ่มเพิ่มกิจกรรมในแต่ละช่วง"}</small>`}</button></article>`; }).join("")}</div>` : `<div class="card project-empty"><h2>${all.length ? "ไม่มีโครงการในกลุ่มนี้" : "ยังไม่มีโครงการ"}</h2><p>${all.length ? "ลองเลือกตัวกรองอื่น" : "สร้างโครงการ แล้วแบ่งงานเป็นช่วง เช่น เตรียมงาน ลงมือทำ และติดตามผล"}</p>${!all.length ? `<button class="btn btn-primary" onclick="App.projectCreateModal()">สร้างโครงการแรก</button>` : ""}</div>`}</div>`;
}
App.projectFilter = function (value) { projectListFilter = value; render(); };
App.projectOpen = function (id) { if (!projectById(id)) return; route.view = "projectDetail"; route.projectId = id; render(); };
App.projectBack = function () { route.view = "projects"; delete route.projectId; render(); };
App.projectCreateModal = function () {
  openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><h3>สร้างโครงการ</h3><p class="modal-sub">ใช้รวมงานหลายแปลงหรือหลายกิจกรรม โดยไม่เปลี่ยนข้อมูลเดิม</p><form onsubmit="return App.projectSaveNew(event)"><div class="field"><label for="projectName">ชื่อโครงการ *</label><input id="projectName" maxlength="100" required placeholder="เช่น เตรียมแปลงสำหรับฤดูใหม่"></div><div class="field"><label for="projectDescription">รายละเอียด (ไม่บังคับ)</label><textarea id="projectDescription" maxlength="500" rows="2" placeholder="เป้าหมายหรือขอบเขตงาน"></textarea></div><p class="hint">เริ่มด้วย 3 ช่วง: เตรียมงาน · ลงมือทำ · ติดตามผล เปลี่ยนชื่อและเพิ่มช่วงภายหลังได้</p><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button><button class="btn btn-primary" type="submit">สร้างโครงการ</button></div></form>`);
  document.getElementById("projectName")?.focus();
};
App.projectSaveNew = function (event) {
  event.preventDefault(); const name = document.getElementById("projectName").value.trim();
  if (!name) { toast("ใส่ชื่อโครงการ"); return false; }
  const p = { id: uid(), name, description: document.getElementById("projectDescription").value.trim(), status: "active", createdAt: Date.now(), stages: ["เตรียมงาน","ลงมือทำ","ติดตามผล"].map(name => ({ id: uid(), name })) };
  S.projects.push(p); saveState(S); closeModal(); App.projectOpen(p.id); toast("สร้างโครงการแล้ว"); return false;
};
App.projectEditModal = function (id) {
  const p = projectById(id); if (!p) return;
  openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><h3>แก้ไขโครงการ</h3><form onsubmit="return App.projectSaveEdit(event,'${id}')"><div class="field"><label for="projectName">ชื่อโครงการ *</label><input id="projectName" maxlength="100" required value="${esc(p.name)}"></div><div class="field"><label for="projectDescription">รายละเอียด</label><textarea id="projectDescription" maxlength="500" rows="3">${esc(p.description || "")}</textarea></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="App.projectDelete('${id}')">ลบโครงการ</button><button type="submit" class="btn btn-primary">บันทึก</button></div></form>`);
};
App.projectSaveEdit = function (event, id) {
  event.preventDefault(); const p = projectById(id); if (!p) return false;
  const name = document.getElementById("projectName").value.trim(); if (!name) { toast("ใส่ชื่อโครงการ"); return false; }
  p.name = name; p.description = document.getElementById("projectDescription").value.trim(); saveState(S); closeModal(); render(); toast("บันทึกโครงการแล้ว"); return false;
};
App.projectDelete = function (id) {
  const p = projectById(id); if (!p) return;
  App.confirm("ลบโครงการ?", "กิจกรรมที่เชื่อมไว้จะยังอยู่ตามเดิม แต่จะไม่อยู่ในโครงการนี้", () => {
    S.tasks.filter(t => t.projectId === id).forEach(t => { delete t.projectId; delete t.projectStageId; });
    S.projects = S.projects.filter(x => x.id !== id); saveState(S); closeModal(); App.projectBack(); toast("ลบโครงการแล้ว");
  });
};
App.projectToggleStatus = function (id) {
  const p = projectById(id); if (!p) return;
  const pending = projectCounts(p).planned;
  if (p.status === "done") { p.status = "active"; saveState(S); render(); toast("เปิดโครงการแล้ว"); return; }
  App.confirm("ปิดโครงการ?", pending ? `ยังมี ${fmtNum(pending)} งานรอทำ งานเหล่านี้จะยังอยู่ในกิจกรรม` : "งานในโครงการจะยังอยู่ในกิจกรรมตามเดิม", () => {
    p.status = "done"; saveState(S); render(); toast("ปิดโครงการแล้ว");
  });
};
App.projectStageModal = function (projectId, stageId) {
  const p = projectById(projectId), stage = projectStageById(p, stageId); if (!p) return;
  openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><h3>${stage ? "เปลี่ยนชื่อช่วง" : "เพิ่มช่วงงาน"}</h3><form onsubmit="return App.projectSaveStage(event,'${projectId}','${stageId || ""}')"><div class="field"><label for="projectStageName">ชื่อช่วง *</label><input id="projectStageName" maxlength="80" required value="${esc(stage?.name || "")}" placeholder="เช่น ตรวจรับและสรุปผล"></div><div class="modal-actions"><button type="button" class="btn btn-ghost" onclick="App.closeModal()">ยกเลิก</button><button class="btn btn-primary" type="submit">บันทึก</button></div></form>`);
  document.getElementById("projectStageName")?.focus();
};
App.projectSaveStage = function (event, projectId, stageId) {
  event.preventDefault(); const p = projectById(projectId); if (!p) return false;
  const name = document.getElementById("projectStageName").value.trim(); if (!name) return false;
  if (p.stages.some(stage => stage.id !== stageId && stage.name.toLocaleLowerCase("th") === name.toLocaleLowerCase("th"))) { toast("ชื่อช่วงนี้มีแล้ว"); return false; }
  if (stageId) { const stage = projectStageById(p, stageId); if (!stage) return false; stage.name = name; }
  else if (p.stages.length < 8) p.stages.push({ id: uid(), name });
  saveState(S); closeModal(); render(); toast("บันทึกช่วงงานแล้ว"); return false;
};
App.projectMoveStage = function (projectId, stageId, direction) {
  const p = projectById(projectId); if (!p) return; const i = p.stages.findIndex(stage => stage.id === stageId), j = i + direction;
  if (i < 0 || j < 0 || j >= p.stages.length) return;
  [p.stages[i], p.stages[j]] = [p.stages[j], p.stages[i]]; saveState(S); render();
};
App.projectRemoveStage = function (projectId, stageId) {
  const p = projectById(projectId); if (!p || p.stages.length < 2) return;
  if (projectTaskList(p, stageId).length) { toast("ย้ายงานออกจากช่วงนี้ก่อน"); return; }
  App.confirm("ลบช่วงงาน?", "ลบเฉพาะช่วงนี้ ไม่ลบกิจกรรม", () => { p.stages = p.stages.filter(stage => stage.id !== stageId); saveState(S); render(); });
};
App.projectNewTask = function (projectId, stageId) {
  const p = projectById(projectId); if (!p || !projectStageById(p, stageId)) return;
  if (p.status === "done") { toast("เปิดโครงการอีกครั้งก่อนเพิ่มงาน"); return; }
  App.modalTask(todayISO(), { projectId, projectStageId: stageId });
};
App.projectLinkModal = function (projectId, stageId) {
  const p = projectById(projectId); if (!p || !projectStageById(p, stageId)) return;
  if (p.status === "done") { toast("เปิดโครงการอีกครั้งก่อนเชื่อมงาน"); return; }
  openModal(`<button class="modal-x" onclick="App.closeModal()">✕</button><h3>เชื่อมกิจกรรมเดิม</h3><p class="modal-sub">${esc(p.name)} · ${esc(projectStageById(p, stageId).name)}</p><div class="field"><label for="projectTaskSearch">ค้นหาชื่องานหรือแปลง</label><input id="projectTaskSearch" type="search" placeholder="พิมพ์เพื่อค้นหา" oninput="App.projectSearchExisting('${projectId}','${stageId}')"></div><div id="projectTaskChoices" class="project-task-choices"></div>`);
  App.projectSearchExisting(projectId, stageId);
  document.getElementById("projectTaskSearch")?.focus();
};
App.projectSearchExisting = function (projectId, stageId) {
  const box = document.getElementById("projectTaskChoices"); if (!box) return;
  const q = (document.getElementById("projectTaskSearch")?.value || "").trim().toLocaleLowerCase("th");
  const matches = (S.tasks || []).filter(t => !t.projectId && (!q || [t.title, plotById(S,t.plotId)?.name].join(" ").toLocaleLowerCase("th").includes(q)))
    .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  box.innerHTML = matches.length ? `${matches.slice(0, 40).map(t => `<button type="button" onclick="App.projectAttachTask('${projectId}','${stageId}','${t.id}')"><b>${esc(t.title)}</b><small>${esc(dateLabel(t.date))} · ${esc(plotById(S,t.plotId)?.name || "งานส่วนกลาง")}</small></button>`).join("")}${matches.length > 40 ? `<p class="hint">พบอีก ${fmtNum(matches.length - 40)} งาน ลองพิมพ์ชื่อให้เจาะจงขึ้น</p>` : ""}` : `<p class="hint">${q ? "ไม่พบงานที่ยังไม่อยู่ในโครงการ" : "ยังไม่มีกิจกรรมที่เชื่อมได้"}</p>`;
};
App.projectAttachTask = function (projectId, stageId, taskId) {
  const p = projectById(projectId), t = S.tasks.find(x => x.id === taskId);
  if (!p || p.status === "done" || !projectStageById(p, stageId) || !t || t.projectId) return;
  t.projectId = projectId; t.projectStageId = stageId; saveState(S); closeModal(); render(); toast("เชื่อมกิจกรรมแล้ว");
};
App.projectMoveTask = function (taskId, stageId) {
  const t = S.tasks.find(x => x.id === taskId), p = t && projectById(t.projectId);
  if (!t || !p || (stageId && !projectStageById(p, stageId))) return;
  if (stageId) t.projectStageId = stageId;
  else { delete t.projectId; delete t.projectStageId; }
  saveState(S); render(); toast(stageId ? "ย้ายช่วงงานแล้ว" : "นำกิจกรรมออกจากโครงการแล้ว");
};
App.taskProjectChange = function (selectedStage) {
  const select = document.getElementById("t_project"), stageSelect = document.getElementById("t_project_stage"), wrap = document.getElementById("taskProjectStageWrap");
  if (!select || !stageSelect || !wrap) return;
  const p = projectById(select.value);
  wrap.hidden = !p;
  stageSelect.disabled = !p;
  if (!p) { stageSelect.innerHTML = ""; return; }
  const preferred = selectedStage || stageSelect.value;
  stageSelect.innerHTML = p.stages.map(stage => `<option value="${stage.id}" ${stage.id === preferred ? "selected" : ""}>${esc(stage.name)}</option>`).join("");
};
