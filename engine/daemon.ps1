# TipLab local daemon (Windows Task Scheduler equivalent)
# Runs the full cycle every 30 minutes and keeps the site data fresh.
$repo = "C:\Users\ferna\Claude Relay Workspace\tiplab"
$py   = "C:\Users\ferna\AppData\Local\Programs\Python\Python312\python.exe"

Write-Host "TipLab daemon starting: $repo"
while ($true) {
    try {
        Write-Host "[$(Get-Date -Format u)] running cycle..."
        Set-Location (Join-Path $repo "engine")
        & $py -X utf8 cycle.py 2>&1 | ForEach-Object { Write-Host "  $_" }
    } catch {
        Write-Host "  cycle error: $_"
    }
    Start-Sleep -Seconds (30 * 60)
}
