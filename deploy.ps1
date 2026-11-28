# Deploy เฉพาะไฟล์เว็บจริงขึ้น Cloudflare Pages (ตัดไฟล์ระบบ/ภายในออกทั้งหมด)
# ใช้: powershell -File deploy.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$stage = Join-Path $env:TEMP ("kaset-pages-stage-" + [guid]::NewGuid().ToString("N"))
node (Join-Path $root "scripts/build-pages.mjs") --out $stage
if ($LASTEXITCODE -ne 0) { throw "Pages assembly failed: $LASTEXITCODE" }
node (Join-Path $root "scripts/check-api-health.mjs") https://farmultimate-solutions.pages.dev
if ($LASTEXITCODE -ne 0) { throw "Required backend or binding is not ready" }
wrangler pages deploy $stage --project-name=farmultimate-solutions --branch=master --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "Pages deployment failed: $LASTEXITCODE" }
node (Join-Path $root "scripts/check-api-health.mjs") https://farmultimate-solutions.pages.dev
if ($LASTEXITCODE -ne 0) { throw "Post-release API health failed" }
