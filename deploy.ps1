# Deploy เฉพาะไฟล์เว็บจริงขึ้น Cloudflare Pages (ตัดไฟล์ระบบ/ภายในออกทั้งหมด)
# ใช้: powershell -File deploy.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$stage = Join-Path $env:TEMP "kaset-pages-stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
robocopy $root $stage /E /NFL /NDL /NJH /NJS /NP `
  /XD .git .github .freebuff .wrangler .netlify node_modules worker netlify `
  /XF .gitignore .assetsignore deploy.ps1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }
wrangler pages deploy $stage --project-name=farmultimate-solutions --branch=master --commit-dirty=true
