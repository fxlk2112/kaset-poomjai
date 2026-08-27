/* อ่าน xlsx ที่แตกไว้ใน tmp_xlsx แล้ว dump เป็น TSV ต่อชีต (node tools/dump_xlsx.js [sheetName]) */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "tmp_xlsx");

function decodeXml(s) {
  return s.replace(/&(lt|gt|amp|quot|apos|#x?[0-9a-fA-F]+);/g, (m, g) => {
    if (g === "lt") return "<"; if (g === "gt") return ">"; if (g === "amp") return "&";
    if (g === "quot") return '"'; if (g === "apos") return "'";
    if (/^#x/.test(g)) return String.fromCharCode(parseInt(g.slice(2), 16));
    return String.fromCharCode(parseInt(g.slice(1), 10));
  });
}

/* sharedStrings */
const ssPath = path.join(ROOT, "xl", "sharedStrings.xml");
const shared = [];
if (fs.existsSync(ssPath)) {
  const xml = fs.readFileSync(ssPath, "utf8");
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    let text = "";
    const tre = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = tre.exec(m[1]))) text += decodeXml(t[1]);
    shared.push(text);
  }
}

/* workbook: sheet name -> file */
const wbXml = fs.readFileSync(path.join(ROOT, "xl", "workbook.xml"), "utf8");
const relXml = fs.readFileSync(path.join(ROOT, "xl", "_rels", "workbook.xml.rels"), "utf8");
const rels = {};
for (const m of relXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels[m[1]] = m[2];
const sheets = [];  for (const m of wbXml.matchAll(/<sheet[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
  sheets.push({ name: decodeXml(m[1]), file: rels[m[2]] });
}

function colToNum(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheet(s) {
  const xml = fs.readFileSync(path.join(ROOT, "xl", s.file.replace(/^\//, "").replace(/^worksheets\//, "worksheets/")), "utf8");
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>|<row[^>]*r="(\d+)"[^>]*\/>/g)) {
    const rowIdx = parseInt(rm[1] || rm[3], 10) - 1;
    const cells = [];
    if (rm[2]) {
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>(?:[\s\S]*?<\/c>)?|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
        const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
        const inner = cm[2] || "";
        if (!ref) continue;
        let val = "";
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        const isM = inner.match(/<is>([\s\S]*?)<\/is>/);
        if (type === "s" && vm) val = shared[parseInt(vm[1], 10)] ?? "";
        else if (type === "inlineStr" && isM) {
          let text = "";
          for (const t of isM[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += decodeXml(t[1]);
          val = text;
        } else if (vm) val = decodeXml(vm[1]);
        cells[colToNum(ref)] = val;
      }
    }
    rows[rowIdx] = cells;
  }
  /* fill gaps */
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

const onlyName = process.argv[2];
let out = "";
for (const s of sheets) {
  if (onlyName && s.name !== onlyName) continue;
  out += `\n===== SHEET: ${s.name} =====\n`;
  const rows = readSheet(s);
  rows.forEach((cells, i) => {
    const line = cells.map(c => (c == null ? "" : c).replace(/[\t\r\n]+/g, " ")).join("\t").replace(/\t+$/, "");
    if (line.trim()) out += `${i + 1}\t${line}\n`;
  });
}
console.log(out);
