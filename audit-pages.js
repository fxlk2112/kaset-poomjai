const fs = require("fs");
const s = fs.readFileSync("D:/folk/WebFarm/css/style.css", "utf8");
const lines = s.split("\n");
const pats = [/\.plot-card/, /\.cycle-card/, /\.tabs/, /\.stock-row/, /\.stock-list/, /\.stock-picker/, /\.sp-pick/, /\.meta-box/, /\.actions-row/, /\.plot-top/, /\.calc-result/, /\.analytics/, /\.chip \./, /\.stock-tabs/];
const out = [];
lines.forEach((l, i) => {
  if (pats.some(p => p.test(l)) && !l.trim().startsWith("/*")) out.push((i + 1) + ": " + l.trim().slice(0, 120));
});
fs.writeFileSync("C:/Users/USER/AppData/Local/Temp/opencode/webfarm-test/pages-audit.txt", out.join("\n"), "utf8");
console.log("found", out.length);
