# Deploy เฉพาะไฟล์เว็บจริงขึ้น Cloudflare Pages (ตัดไฟล์ระบบ/ภายในออกทั้งหมด)
# ใช้: powershell -File deploy.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$stage = Join-Path $env:TEMP ("kaset-pages-stage-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stage | Out-Null
# Match the site-only allowlist in the GitHub deployment workflow.
foreach ($name in @("index.html", "sw.js", "manifest.json", "logo.jpg", "css", "js", "icons", "images", "_redirects")) {
  Copy-Item -LiteralPath (Join-Path $root $name) -Destination $stage -Recurse
}
wrangler pages deploy $stage --project-name=farmultimate-solutions --branch=master --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "Pages deployment failed: $LASTEXITCODE" }
