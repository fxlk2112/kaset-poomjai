
/* อ่านสีจาก CSS variable — ให้กราฟสอดคล้องทั้งโหมดสว่าง/มืด */
function chartCol(name, fallback) {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; } catch (e) { return fallback; }
}
/* ============================================================
   FARMULTIMATE SOLUTIONS v52 — lightweight SVG charts (no dependencies)
   ปรับสมดุล: กราฟจำกัดขนาดพอดี, แท่งค่าลบวาดจากเส้นศูนย์กลาง,
   ป้ายค่าย่อ (หมื่น/ล้าน) อ่านง่าย
   ============================================================ */
"use strict";

/* ย่อตัวเลขสำหรับป้ายกราฟ: 50,000 -> "5 หมื่น", 1,200,000 -> "1.2 ล." */
function fmtChartVal(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + " ล.";
  if (a >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + " หมื่น";
  return fmtNum(n);
}

const Charts = {

  /* Shared date axis with one series per treatment; absent measurements remain gaps. */
  series(container, dates, series, opts = {}) {
    const W = Math.max(260, Math.min(1100, container.clientWidth || 700));
    const H = Math.max(220, container.clientHeight || 300), L = 58, R = 20, T = 24, B = 44;
    const values = series.flatMap(s => s.points.filter(p => p.value !== null && Number.isFinite(p.value)).map(p => p.value));
    if (!dates.length || !values.length) { container.innerHTML = ''; return; }
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const padding = (rawMax - rawMin || Math.abs(rawMax) || 1) * .12;
    const min = Math.max(opts.minValue ?? -Infinity, rawMin - padding);
    const max = Math.max(min + .000001, Math.min(opts.maxValue ?? Infinity, rawMax + padding));
    const time = d => Date.parse(d + 'T12:00:00Z');
    const first = time(dates[0]), span = time(dates[dates.length-1]) - first;
    const x = d => span ? L + (time(d)-first)/span*(W-L-R) : (L+W-R)/2;
    const y = v => T + (max-v)/(max-min)*(H-T-B);
    const text = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const label = opts.dateLabel || (d => d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(2,4));
    const muted = chartCol('--muted','#64746c'), rule = chartCol('--line','#dae2dc');
    let out = '';
    for (let i=0;i<=4;i++) {
      const v=min+(max-min)*i/4, yy=y(v);
      out += `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="${rule}"/><text x="${L-10}" y="${yy+4}" text-anchor="end" font-size="11" fill="${muted}">${text(fmtChartVal(Number(v.toFixed(2))))}</text>`;
    }
    const ticks = span ? Array.from({length: W<500 ? 3 : 5}, (_,i) => first+span*i/(W<500 ? 2 : 4)) : [first];
    let tickDates = [...new Set(ticks.map(t=>new Date(t).toISOString().slice(0,10)))];
    if (opts.recordDateTicks) {
      // Keep real time spacing, but label only recorded dates without crowding.
      const candidates = [...new Set(dates)];
      tickDates = [candidates[0]];
      const last = candidates[candidates.length-1];
      for (const d of candidates.slice(1,-1)) {
        if (x(d)-x(tickDates[tickDates.length-1])>=76 && x(last)-x(d)>=76) tickDates.push(d);
      }
      if (last!==tickDates[0]) tickDates.push(last);
    }
    tickDates.forEach(d => {
      out += `<text x="${Math.max(32,Math.min(W-32,x(d)))}" y="${H-16}" text-anchor="middle" font-size="11" fill="${muted}">${text(label(d))}</text>`;
    });
    series.forEach((s,index) => {
      const dash = ['', '8 4', '2 4', '10 3 2 3'][index%4];
      let segment=[], previous=null, missing=false;
      const flush = () => {
        if (segment.length>1) out += `<polyline points="${segment.join(' ')}" fill="none" stroke="${text(s.color)}" stroke-width="2.5" stroke-dasharray="${dash}" stroke-linejoin="round"/>`;
        segment=[];
      };
      s.points.forEach(p => {
        if (p.value === null || !Number.isFinite(p.value)) { flush(); missing=true; return; }
        if (opts.connectMissing && missing && previous) {
          out += `<line x1="${x(previous.date)}" y1="${y(previous.value)}" x2="${x(p.date)}" y2="${y(p.value)}" stroke="${text(s.color)}" stroke-width="2" stroke-dasharray="4 5" opacity="0.65"><title>${text('ช่วงไม่มีค่าวัด ระหว่าง '+label(previous.date)+' ถึง '+label(p.date))}</title></line>`;
        }
        previous=p;missing=false;
        segment.push(`${x(p.date)},${y(p.value)}`);
      });
      flush();
      s.points.forEach(p => {
        if (p.value === null || !Number.isFinite(p.value)) return;
        const title = `${s.label} · ${p.date}: ${Number(p.value.toFixed(2))} ${opts.unit || ''} · ${opts.sampleLabel ? p.n+' '+opts.sampleLabel : 'n='+p.n+'/'+s.expected}`;
        out += `<circle cx="${x(p.date)}" cy="${y(p.value)}" r="4" fill="${text(s.color)}" stroke="${chartCol('--card','#fff')}" stroke-width="1.5"><title>${text(title)}</title></circle>`;
      });
    });
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${text(opts.description || 'แนวโน้ม '+(opts.unit || '')+' แยก '+series.map(s=>s.label).join(', ')+' ตั้งแต่ '+dates[0]+' ถึง '+dates[dates.length-1]+'. ค่าตัวเลขและจำนวนแปลงอยู่ในตารางเปรียบเทียบทุกวันที่วัด')}"><title>${text(opts.title || 'แนวโน้มแต่ละสูตร')}</title>${out}</svg>`;
  },

  /* Bar chart. items: [{label, value, color?}]
     ถ้ามีค่าลบ -> วาดเส้นศูนย์ (baseline) กลาง แท่งบวกขึ้นบน แท่งลบลงล่าง */
  bars(container, items, opts) {
    opts = opts || {};
    if (!items.length) { container.innerHTML = ''; return; }
    const W = 320, H = 200, padL = 8, padR = 8, padT = 26, padB = 28;
    const n = items.length;
    const hasNeg = items.some(i => Number(i.value) < 0);
    const max = Math.max(1, ...items.map(i => Math.abs(Number(i.value))));
    const slot = (W - padL - padR) / n;
    const bw = Math.min(30, slot * 0.58);
    const plotH = H - padT - padB;
    const zeroY = hasNeg ? padT + plotH / 2 : H - padB;
    const scale = max;
    let out = "";
    if (hasNeg) {
      out += `<line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="${chartCol("--muted","#94a3b8")}" stroke-width="1" stroke-dasharray="4 3"/>`;
    }
    items.forEach((it, i) => {
      const v = Number(it.value) || 0;
      const h = (Math.abs(v) / scale) * (hasNeg ? plotH / 2 : plotH);
      const x = padL + slot * i + (slot - bw) / 2;
      const y = v >= 0 ? zeroY - h : zeroY;
      const color = it.color || opts.color || (v >= 0 ? "#16a34a" : "#dc2626");
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 1.5).toFixed(1)}" rx="3" fill="${color}" opacity="0.92"/>`;
      /* ป้ายค่า: เหนือแท่งบวก / ใต้แท่งลบ (เฉพาะแท่งสูงพอจะไม่ชนกัน) */
      if (h > 13) {
        const ly = v >= 0 ? y - 7 : Math.min(zeroY + h + 13, H - 4);
        out += `<text x="${(x + bw / 2).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${v >= 0 ? "#15803d" : "#b91c1c"}">${fmtChartVal(v)}</text>`;
      }
      out += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="9" fill="${chartCol("--muted","#6b7280")}">${it.label}</text>`;
    });
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
  },

  /* Donut chart. slices: [{label, value, color}] — วงพอดี ไม่ยักษ์ */
  donut(container, slices, opts) {
    opts = opts || {};
    const total = slices.reduce((a, s) => a + s.value, 0) || 1;
    const W = 200, cx = W / 2, cy = W / 2, r = 70, sw = 26;
    let angle = -90 * Math.PI / 180;
    let paths = "";
    slices.forEach(s => {
      const frac = s.value / total;
      const a2 = angle + frac * 2 * Math.PI;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      if (frac > 0.001) {
        paths += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      angle = a2;
    });
    const center = opts.centerLabel
      ? `<text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="14" font-weight="800" fill="${chartCol("--text","#111827")}">${opts.centerLabel}</text>
         <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="${chartCol("--muted","#6b7280")}">${opts.centerSub || ""}</text>`
      : "";
    container.innerHTML = `<svg viewBox="0 0 ${W} ${W}" role="img">${paths}${center}</svg>`;
  },

  /* Line / area chart. items: [{label, value}] */
  line(container, items, opts) {
    opts = opts || {};
    const W = 320, H = 170, padL = 8, padR = 8, padT = 16, padB = 24;
    const max = Math.max(1, ...items.map(i => i.value));
    const min = Math.min(0, ...items.map(i => i.value));
    const range = (max - min) || 1;
    const n = items.length;
    const px = i => n <= 1 ? W / 2 : padL + (i / (n - 1)) * (W - padL - padR);
    const py = v => padT + (1 - (v - min) / range) * (H - padT - padB);
    let pts = items.map((it, i) => `${px(i).toFixed(1)},${py(it.value).toFixed(1)}`).join(" ");
    let area = `${padL},${H - padB} ${pts} ${(W - padR).toFixed(1)},${H - padB}`;
    let dots = items.map((it, i) =>
      `<circle cx="${px(i).toFixed(1)}" cy="${py(it.value).toFixed(1)}" r="3" fill="#16a34a"/>`
    ).join("");
    let labels = items.map((it, i) =>
      `<text x="${px(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8.5" fill="${chartCol("--muted","#6b7280")}">${it.label}</text>`
    ).join("");
    let values = items.map((it, i) =>
      `<text x="${px(i).toFixed(1)}" y="${(py(it.value) - 6).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="${chartCol("--text","#4b5563")}">${fmtNum(it.value)}</text>`
    ).join("");
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">
      <polygon points="${area}" fill="#16a34a" opacity="0.12"/>
      <polyline points="${pts}" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${values}${labels}</svg>`;
  }
};
