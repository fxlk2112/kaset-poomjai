param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$stream = [IO.File]::Open((Resolve-Path -LiteralPath $InputPath).Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
$zip = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Read)
function ReadXml($name) {
  $reader = [IO.StreamReader]::new($zip.GetEntry($name).Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
  $sheet = (ReadXml 'xl/worksheets/sheet1.xml').worksheet
  $styles = (ReadXml 'xl/styles.xml').styleSheet
  $strings = @((ReadXml 'xl/sharedStrings.xml').sst.si | ForEach-Object { $_.InnerText })
  $cols = @(1..10 | ForEach-Object { $i=$_; $col=$sheet.cols.col | Where-Object { [int]$_.min -le $i -and [int]$_.max -ge $i }; [Math]::Floor(([double]$col.width*256+[Math]::Floor(128/7))/256*7) })
  $rows = @($sheet.sheetData.row | Where-Object { [int]$_.r -le 41 } | ForEach-Object { [double]$_.ht*96/72 })
  $cells = @{}
  foreach($row in $sheet.sheetData.row) { foreach($c in $row.c) { if($c.r -match '^([A-J])(\d+)$' -and [int]$Matches[2] -le 41) {
    $value = if($c.t -eq 's'){ $strings[[int]$c.v] } elseif($c.v){ [string]$c.v } else { '' }
    $cells[$c.r] = @{ style=[int]$c.s; value=$value }
  } } }
  $css = @($styles.cellXfs.xf | ForEach-Object {
    $xf=$_; $f=$styles.fonts.font[[int]$xf.fontId]; $fill=$styles.fills.fill[[int]$xf.fillId]; $border=$styles.borders.border[[int]$xf.borderId]
    $color=if($f.color.rgb){ '#'+([string]$f.color.rgb).Substring(2) }else{'#000000'}
    $bg=if($fill.patternFill.fgColor.rgb){ '#'+([string]$fill.patternFill.fgColor.rgb).Substring(2) }else{'transparent'}
    $edges=@{}; foreach($side in @('left','right','top','bottom')) { $b=$border.$side; if($b.style){$weight=switch([string]$b.style){'medium'{2};'thick'{3};default{1}}; $line=if($b.style -eq 'dashed'){'dashed'}else{'solid'}; $bc=if($b.color.rgb){'#'+([string]$b.color.rgb).Substring(2)}else{'#000000'}; $edges[$side]="$weight`px $line $bc"} }
    @{font=[string]$f.name.val;size=[double]$f.sz.val*96/72;bold=($null -ne $f.b);color=$color;fill=$bg;align=[string]$xf.alignment.horizontal;borders=$edges}
  })
  $data=@{cols=$cols;rows=$rows;cells=$cells;styles=$css;merges=@($sheet.mergeCells.mergeCell | ForEach-Object {$_.ref} | Where-Object {$_ -notmatch '42|Q|R'});logo=@{x=625394/9525;y=55749/9525;width=1181072/9525;height=1176891/9525}}
  $json=$data | ConvertTo-Json -Depth 12 -Compress
  # Raw workbooks can contain personal data. Never overwrite a public source file.
  $dir=Join-Path $root 'tools/.wallet-private/extracted-receipt';[IO.Directory]::CreateDirectory($dir)|Out-Null
  [IO.File]::WriteAllText((Join-Path $dir 'template.js'),"'use strict';`nconst WalletReceiptTemplate=$json;`nif(typeof module!=='undefined'&&module.exports)module.exports=WalletReceiptTemplate;`n",[Text.UTF8Encoding]::new($false))
  [IO.Compression.ZipFileExtensions]::ExtractToFile($zip.GetEntry('xl/media/image1.png'),(Join-Path $dir 'logo.png'),$true)
  Write-Output "Extracted source geometry: $($cols.Count) columns, $($rows.Count) rows, $($cells.Count) cells"
} finally { $zip.Dispose(); $stream.Dispose() }
