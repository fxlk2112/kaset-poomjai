/* ============================================================
   เกษตรภูมิใจ v51 — lightweight SVG charts (no dependencies)
   ============================================================ */
"use strict";

const Charts = {

  /* Bar chart. items: [{label, value, color?}] */
  bars(container, items, opts) {
    opts = opts || {};
    const W = 320, H = 190, padL = 6, padR = 6, padT = 22, padB = 26;
    const n = items.length;
    const max = Math.max(1, ...items.map(i => Math.abs(i.value)));
    const slot = (W - padL - padR) / n;
    const bw = Math.min(34, slot * 0.58);
    let bars = "";
    items.forEach((it, i) => {
      const h = (Math.abs(it.value) / max) * (H - padT - padB);
      const x = padL + slot * i + (slot - bw) / 2;
      const y = H - padB - h;
      const color = it.color || (it.value >= 0 ? "#16a34a" : "#dc2626");
      bars += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 1.5)}" rx="4" fill="${color}" opacity="0.9"/>`;
      bars += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">${fmtNum(it.value)}</text>`;
      bars += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#6b7280">${it.label}</text>`;
    });
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img"><rect x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}" fill="none"/>${bars}</svg>`;
  },

  /* Donut chart. slices: [{label, value, color}] */
  donut(container, slices, opts) {
    opts = opts || {};
    const total = slices.reduce((a, s) => a + s.value, 0) || 1;
    const W = 220, cx = W / 2, cy = W / 2, r = 78, sw = 30;
    let angle = -90 * Math.PI / 180;
    let paths = "";
    slices.forEach(s => {
      const frac = s.value / total;
      const a2 = angle + frac * 2 * Math.PI;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      if (frac > 0.001) {
        paths += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${s.color}" stroke-width="${sw}"/>`;
      }
      angle = a2;
    });
    const center = opts.centerLabel
      ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" font-weight="800" fill="#111827">${opts.centerLabel}</text>
         <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="8.5" fill="#6b7280">${opts.centerSub || ""}</text>`
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
    const px = i => padL + (i / (n - 1)) * (W - padL - padR);
    const py = v => padT + (1 - (v - min) / range) * (H - padT - padB);
    let pts = items.map((it, i) => `${px(i).toFixed(1)},${py(it.value).toFixed(1)}`).join(" ");
    let area = `${padL},${H - padB} ${pts} ${(W - padR).toFixed(1)},${H - padB}`;
    let dots = items.map((it, i) =>
      `<circle cx="${px(i).toFixed(1)}" cy="${py(it.value).toFixed(1)}" r="3" fill="#16a34a"/>`
    ).join("");
    let labels = items.map((it, i) =>
      `<text x="${px(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8.5" fill="#6b7280">${it.label}</text>`
    ).join("");
    let values = items.map((it, i) =>
      `<text x="${px(i).toFixed(1)}" y="${(py(it.value) - 6).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="#4b5563">${fmtNum(it.value)}</text>`
    ).join("");
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">
      <polygon points="${area}" fill="#16a34a" opacity="0.12"/>
      <polyline points="${pts}" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${values}${labels}</svg>`;
  }
};
