/* สคริปต์ดึงข้อมูลราคาตลาดทั้งหมดจาก kasetpoomjai.com */
const fs = require("fs");
const path = require("path");

const IN = process.argv[2] || path.join(__dirname, "..", "tmp", "kasetpoomjai.html");
const OUT = process.argv[3] || path.join(__dirname, "..", "tmp", "kasetpoomjai-all.json");

const html = fs.readFileSync(IN, "utf8");

// หา product cards ที่มี data attributes
const cardRegex = /<div[^>]*data-price-id="(\d+)"[^>]*data-market="([^"]*)"[^>]*data-product="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;
const products = [];
let match;

while ((match = cardRegex.exec(html)) !== null) {
  const [_, id, market, product, cardHtml] = match;
  
  // หารูปภาพ
  const imgMatch = cardHtml.match(/<img[^>]*src="([^"]+)"/i);
  const img = imgMatch ? imgMatch[1] : null;
  
  // หาราคา (min - max / unit)
  const priceMatch = cardHtml.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\/\s*([^\s<]+)/);
  const min = priceMatch ? parseFloat(priceMatch[1]) : 0;
  const max = priceMatch ? parseFloat(priceMatch[2]) : 0;
  const unit = priceMatch ? priceMatch[3] : "";
  
  // หาการเปลี่ยนแปลงราคา
  const changeMatch = cardHtml.match(/(?:class="[^"]*(?:up|down|change)[^"]*"[^>]*>[\s\S]*?)?(\d+(?:\.\d+)?)/);
  const change = changeMatch ? parseFloat(changeMatch[1]) : 0;
  
  // หาวันที่
  const dateMatch = cardHtml.match(/(\d{1,2})\s+(?:ส\.ค\.|ก\.ค\.|มิ\.ย\.|พ\.ค\.|เม\.ย\.|มี\.ค\.|ก\.พ\.|ม\.ค\.|ธ\.ค\.|พ\.ย\.|ต\.ค\.|ก\.ย\.)\s+(\d{4})/);
  const date = dateMatch ? dateMatch[0] : "";
  
  products.push({ id: parseInt(id), market, product, img, min, max, unit, change, date });
}

console.log(`Found ${products.length} products`);

// นับจำนวนต่อตลาด
const marketCounts = {};
products.forEach(p => { marketCounts[p.market] = (marketCounts[p.market] || 0) + 1; });
console.log("Markets:", marketCounts);

// นับจำนวนต่อหมวด (ถ้ามี)
const productNames = [...new Set(products.map(p => p.product))];
console.log("Unique products:", productNames.length);

// บันทึกผลลัพธ์
fs.writeFileSync(OUT, JSON.stringify({ 
  fetchedAt: new Date().toISOString(),
  source: "kasetpoomjai.com",
  totalProducts: products.length,
  markets: marketCounts,
  products 
}, null, 2), "utf8");

console.log("Output written to:", OUT);
