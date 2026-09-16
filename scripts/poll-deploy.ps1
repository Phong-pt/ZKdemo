# Kiểm tra deploy đã lên chưa bằng NỘI DUNG bundle, không dựa vào tên file.
#
# Lý do: tên file bundle là hash theo nội dung JS. Nếu chỉ sửa index.html (ví dụ <title>)
# hoặc sửa file không vào bundle, hash KHÔNG đổi -> so tên file sẽ kết luận sai là "chưa deploy".
# Ngược lại bundle cũ vẫn nằm trong CDN/cache nên thấy tên lạ cũng chưa chắc là bản mới.
# Cách đúng: tìm chuỗi chỉ có ở bản mới (expect) và chuỗi chỉ có ở bản cũ (forbid).
#
# Dùng:
#   pwsh scripts/poll-deploy.ps1
#   pwsh scripts/poll-deploy.ps1 -Expect 'NX Cred','Chấp nhận' -Forbid 'Anh Tran','Vaulta' -Timeout 600

param(
  [string]   $BaseUrl = 'https://zkp-demo.onrender.com',
  [string[]] $Expect  = @('NX Cred'),   # phải CÓ ở bản mới
  [string[]] $Forbid  = @('Vaulta'),    # phải KHÔNG còn ở bản mới
  [int]      $Timeout = 600,            # tổng thời gian chờ (giây)
  [int]      $Every   = 15              # khoảng giữa hai lần poll (giây)
)

$ErrorActionPreference = 'Stop'
$noCache = @{ 'Cache-Control' = 'no-cache'; 'Pragma' = 'no-cache' }

# Khi gọi qua `powershell -File`, mảng truyền vào có thể bị gộp thành một chuỗi "a,b" -> tách lại.
$Expect = @($Expect | ForEach-Object { $_ -split ',' } | Where-Object { $_ -ne '' })
$Forbid = @($Forbid | ForEach-Object { $_ -split ',' } | Where-Object { $_ -ne '' })

function Get-DeployedText {
  param([string]$Base)
  # cache-buster để không ăn phải index.html cũ trong cache trung gian
  $bust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $html = (Invoke-WebRequest -Uri "$Base/?_=$bust" -UseBasicParsing -Headers $noCache).Content
  $text = $html
  foreach ($m in [regex]::Matches($html, '(?:src|href)="(/assets/[^"]+\.(?:js|css))"')) {
    $asset = $m.Groups[1].Value
    $text += "`n" + (Invoke-WebRequest -Uri "$Base$asset" -UseBasicParsing -Headers $noCache).Content
  }
  [pscustomobject]@{ Html = $html; Text = $text }
}

$deadline = (Get-Date).AddSeconds($Timeout)
while ($true) {
  $stamp = (Get-Date).ToString('HH:mm:ss')
  try {
    $r    = Get-DeployedText -Base $BaseUrl
    $hits = @{}
    $ok   = $true
    foreach ($s in $Expect) {
      $n = [regex]::Matches($r.Text, [regex]::Escape($s)).Count
      $hits[$s] = $n
      if ($n -lt 1) { $ok = $false }
    }
    foreach ($s in $Forbid) {
      $n = [regex]::Matches($r.Text, [regex]::Escape($s)).Count
      $hits["!$s"] = $n
      if ($n -gt 0) { $ok = $false }
    }
    $report = ($hits.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '  '
    $bundle = ([regex]::Match($r.Html, '/assets/index-[^"]+\.js')).Value
    Write-Host "[$stamp] $report   (bundle: $bundle)"
    if ($ok) { Write-Host "[$stamp] NEW BUILD IS LIVE." -ForegroundColor Green; exit 0 }
  } catch {
    Write-Host "[$stamp] fetch failed: $($_.Exception.Message)"
  }
  if ((Get-Date) -ge $deadline) { Write-Host "[$stamp] TIMEOUT - still the old build." -ForegroundColor Yellow; exit 1 }
  Start-Sleep -Seconds $Every
}
