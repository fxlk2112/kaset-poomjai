/* สคริปต์ดึงข้อมูลราคาตลาดทั้งหมดจาก kasetpoomjai.com (v2 - แก้ไขการ parse) */
const fs = require("fs");
const path = require("path");

const IN = process.argv[2] || path.join(__dirname, "..", "tmp", "kasetpoomjai.html");
const OUT = process.argv[3] || path.join(__dirname, "..", "tmp", "kasetpoomjai-all.json");

const html = fs.readFileSync(IN, "utf8");

// หา table rows ที่มี data attributes
const rowRegex = /<tr[^>]*data-price-id="(\d+)"[^>]*data-market="([^"]*)"[^>]*data-product="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi;
const products = [];
let match;

while ((match = rowRegex.exec(html)) !== null) {
  const [_, id, market, product, rowHtml] = match;
  
  // หารูปภาพ
  const imgMatch = rowHtml.match(/<img[^>]*src="([^"]+)"/i);
  const img = imgMatch ? imgMatch[1] : null;
  
  // หาราคาจาก price-current
  const priceMatch = rowHtml.match(/<td[^>]*data-label="ราคาปัจจุบัน"[^>]*>([\s\S]*?)<\/td>/i);
  let min = 0, max = 0, unit = "";
  if (priceMatch) {
    const priceText = priceMatch[1].replace(/<[^>]+>/g, "").trim();
    const nums = priceText.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (nums) {
      min = parseFloat(nums[1]);
      max = parseFloat(nums[2]);
    }
    const unitMatch = priceText.match(/\/\s*(.+)/);
    if (unitMatch) unit = unitMatch[1].trim();
  }
  
  // หาสถานะ (up/down/stable)
  const statusMatch = rowHtml.match(/<td[^>]*data-label="สถานะ"[^>]*>([\s\S]*?)<\/td>/i);
  let change = 0, status = "stable";
  if (statusMatch) {
    const statusHtml = statusMatch[1];
    if (statusHtml.includes("price-status up")) status = "up";
    else if (statusHtml.includes("price-status down")) status = "down";
    
    const changeMatch = statusHtml.match(/<span[^>]*class="change"[^>]*>([\s\S]*?)<\/span>/i);
    if (changeMatch) change = parseFloat(changeMatch[1]) || 0;
  }
  
  // หาวันที่
  const dateMatch = rowHtml.match(/<td[^>]*data-label="อัปเดต"[^>]*>([\s\S]*?)<\/td>/i);
  let date = "";
  if (dateMatch) {
    date = dateMatch[1].replace(/<[^>]+>/g, "").trim();
  }
  
  products.push({ id: parseInt(id), market, product, img, min, max, unit, change, status, date });
}

console.log(`Found ${products.length} products`);

// นับจำนวนต่อตลาด
const marketCounts = {};
products.forEach(p => { marketCounts[p.market] = (marketCounts[p.market] || 0) + 1; });
console.log("Markets:", marketCounts);

// นับจำนวนต่อสถานะ
const statusCounts = { up: 0, down: 0, stable: 0 };
products.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
console.log("Status:", statusCounts);

// แสดงตัวอย่าง
console.log("\nSample products:");
products.slice(0, 5).forEach(p => {
  console.log(`  ${p.product} @ ${p.market}: ${p.min}-${p.max} ${p.unit} (${p.status} ${p.change > 0 ? '+' : ''}${p.change}) ${p.date}`);
});

// บันทึกผลลัพธ์
fs.writeFileSync(OUT, JSON.stringify({ 
  fetchedAt: new Date().toISOString(),
  source: "kasetpoomjai.com",
  totalProducts: products.length,
  markets: marketCounts,
  status: statusCounts,
  products 
}, null, 2), "utf8");

console.log("\nOutput written to:", OUT);
