#!/usr/bin/env node
/* Batch upload product images to R2 bucket via wrangler CLI
   Usage: node tools/batch_upload_r2.js
   Requires: wrangler CLI authenticated, bucket farmultimate-photos exists
   Stores images under img/products/ prefix, generates mapping JSON
*/
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const IMAGES_DIR = path.join(__dirname, "..", "images", "products");
const OUTPUT_JSON = path.join(__dirname, "..", "images", "product_urls.json");
const BUCKET = "farmultimate-photos";
const PREFIX = "img/products";
const ORIGIN = "https://farmbackup.carfork123.workers.dev";

// Supported extensions
const EXT_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function main() {
  // Read all image files
  const files = fs.readdirSync(IMAGES_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return EXT_MAP[ext];
  });

  console.log(`Found ${files.length} images to upload\n`);

  const mapping = {};
  let success = 0;
  let fail = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = path.extname(file).toLowerCase();
    const key = `${PREFIX}/${file}`;
    const filePath = path.join(IMAGES_DIR, file);
    const fileSize = fs.statSync(filePath).size;

    // Generate URL
    const url = `${ORIGIN}/photo/${encodeURIComponent(key)}`;

    process.stdout.write(`[${i + 1}/${files.length}] ${file} (${(fileSize / 1024).toFixed(0)}KB) ... `);

    try {
      // Upload via wrangler r2 object put
      const cmd = `npx wrangler r2 object put "${BUCKET}/${key}" --file "${filePath}" --content-type "${EXT_MAP[ext]}" --remote`;
      execSync(cmd, {
        cwd: path.join(__dirname, "..", "worker"),
        stdio: "pipe",
        timeout: 30000,
      });
      mapping[file] = { key, url, size: fileSize };
      success++;
      console.log("✅");
    } catch (err) {
      fail++;
      console.log("❌ " + (err.message || "").slice(0, 80));
    }
  }

  // Save mapping
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(mapping, null, 2));
  console.log(`\n=== DONE ===`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${fail}`);
  console.log(`📁 Mapping saved to: ${OUTPUT_JSON}`);
}

main();
