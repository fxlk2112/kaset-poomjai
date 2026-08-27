/* สคริปต์ดึงข้อมูลราคาตลาดจาก kasetpoomjai.com
   ใช้: node tools/scrape_kasetpoomjai.js [input.html] [output.json] */
const fs = require("fs");
const path = require("path");

const IN = process.argv[2] || path.join(__dirname, "..", "tmp", "kasetpoomjai.html");
const OUT = process.argv[3] || path.join(__dirname, "..", "tmp", "kasetpoomjai-prices.json");

const html = fs.readFileSync(IN, "utf8");

/* หาข้อมูลจาก HTML — แต่ละ product card มีรูปแบบ:
   <div class="product-card" ...>
     <img src="..." />
     <div class="product-name">...</div>
     <div class="product-market">...</div>
     <div class="product-price">...</div>
     <div class="product-change">...</div>
     <div class="product-date">...</div>
   </div>
*/

// ลองหาข้อมูลจาก script tags ที่ might contain JSON data
const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
let jsonData = null;
for (const script of scriptMatches) {
  const content = script.replace(/<\/?script[^>]*>/gi, "");
  // หา JSON ที่มี product data
  if (content.includes("product") || content.includes("price") || content.includes("market")) {
    // ลอง parse เป็น JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed && (parsed.products || parsed.prices || parsed.data)) {
        jsonData = parsed;
        break;
      }
    } catch (e) { /* ไม่ใช่ JSON ตรงๆ */ }
    
    // หา JSON array/object ที่ฝังอยู่
    const jsonMatch = content.match(/(?:var|let|const)\s+\w+\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*?\});/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed && typeof parsed === "object") {
          jsonData = parsed;
          break;
        }
      } catch (e) { /* ไม่ใช่ JSON ที่ valid */ }
    }
  }
}

// ถ้าไม่เจอ JSON ตรงๆ ให้ parse HTML
const products = [];

// หา all product items จาก HTML
// ลองหา pattern ของ price cards
const cardRegex = /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
let match;
while ((match = cardRegex.exec(html)) !== null) {
  const card = match[1];
  // ดึงข้อมูลจาก card
  const imgMatch = card.match(/<img[^>]*src="([^"]+)"/i);
  const nameMatch = card.match(/<(?:h[23]|div)[^>]*>([^<]+)<\/(?:h[23]|div)>/i);
  if (imgMatch || nameMatch) {
    products.push({
      html: card.substring(0, 500),
      img: imgMatch ? imgMatch[1] : null,
      name: nameMatch ? nameMatch[1].trim() : null
    });
  }
}

// ถ้ายังไม่เจอ ลองหาจาก img tags ทั้งหมด
const allImgs = [];
const imgRegex = /<img[^>]*src="([^"]*(?:product|vegetable|fruit|.market)[^"]*)"[^>]*>/gi;
while ((match = imgRegex.exec(html)) !== null) {
  allImgs.push(match[1]);
}

// ลองหาจาก table rows
const tableRows = [];
const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
while ((match = trRegex.exec(html)) !== null) {
  const row = match[1];
  const cells = [];
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let tdMatch;
  while ((tdMatch = tdRegex.exec(row)) !== null) {
    cells.push(tdMatch[1].replace(/<[^>]+>/g, "").trim());
  }
  if (cells.length >= 3) {
    tableRows.push(cells);
  }
}

// ลองหาจาก data attributes
const dataAttrRegex = /data-(?:product|price|market|item)[^=]*="([^"]+)"/gi;
const dataAttrs = [];
while ((match = dataAttrRegex.exec(html)) !== null) {
  dataAttrs.push(match[1]);
}

// ลองหา JSON-LD
const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
const jsonLdData = [];
while ((match = jsonLdRegex.exec(html)) !== null) {
  try {
    jsonLdData.push(JSON.parse(match[1]));
  } catch (e) {}
}

console.log("HTML size:", html.length);
console.log("JSON data found:", !!jsonData);
console.log("Product cards found:", products.length);
console.log("Product images found:", allImgs.length);
console.log("Table rows found:", tableRows.length);
console.log("Data attributes found:", dataAttrs.length);
console.log("JSON-LD blocks found:", jsonLdData.length);

// ลองหา WordPress REST API endpoints
const wpApiMatches = html.match(/wp-json\/[^"'\s]+/g) || [];
console.log("WP API URLs found:", [...new Set(wpApiMatches)].slice(0, 10));

// ลองหา AJAX/API calls
const apiMatches = html.match(/(?:fetch|ajax| XMLHttpRequest|axios)\s*\([^)]*\)/gi) || [];
console.log("API calls found:", apiMatches.length);

// บันทึกผลลัพธ์
const result = {
  jsonData,
  products: products.slice(0, 20),
  allImgs: allImgs.slice(0, 20),
  tableRows: tableRows.slice(0, 20),
  dataAttrs: dataAttrs.slice(0, 20),
  jsonLdData,
  wpApiUrls: [...new Set(wpApiMatches)].slice(0, 20)
};

fs.writeFileSync(OUT, JSON.stringify(result, null, 2), "utf8");
console.log("Output written to:", OUT);
