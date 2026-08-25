const fs = require("fs");
const s = fs.readFileSync("D:/folk/WebFarm/js/app.js", "utf8");
// ดึงช่วง renderStock + renderPlots + renderAnalytics
for (const [name, start] of [["renderStock", "function renderStock"], ["renderPlots", "function renderPlots"], ["renderAnalytics", "function renderAnalytics"]]) {
  const i = s.indexOf(start);
  const seg = s.slice(i, i + 6000);
  const hits = [];
  seg.split("\n").forEach((l, idx) => {
    if (/#[0-9a-fA-F]{3,6}/.test(l) && /style|fill/.test(l)) hits.push((idx + 1) + ": " + l.trim().slice(0, 120));
  });
  console.log("=== " + name + " (" + hits.length + " inline hex) ===");
  hits.slice(0, 12).forEach(h => console.log(h));
  console.log("");
}
