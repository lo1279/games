Add-Type -AssemblyName System.Drawing

function Remove-Background-FloodFill($filePath) {
    if (-not (Test-Path $filePath)) { return }
    $fileItem = Get-Item $filePath
    Write-Host "正在进行智能边缘漫水去底: $($fileItem.Name) ..." -ForegroundColor Cyan

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $bmp = [System.Drawing.Bitmap]::FromStream($ms)

    $w = $bmp.Width
    $h = $bmp.Height

    # 创建标记数组，只记录与外界连通的背景像素
    $isBg = New-Object 'bool[,]' $w, $h
    $visited = New-Object 'bool[,]' $w, $h

    # 判定颜色是否属于浅色背景 (RGB均>=230)
    function IsWhitePixel($x, $y) {
        $c = $bmp.GetPixel($x, $y)
        return ($c.R -ge 230 -and $c.G -ge 230 -and $c.B -ge 230)
    }

    # BFS 漫水填充队列
    $queue = New-Object System.Collections.Generic.Queue[System.Drawing.Point]

    # 1. 扫描四周边界，将外部白色像素加入队列
    for ($x = 0; $x -lt $w; $x++) {
        if (IsWhitePixel $x 0) { $queue.Enqueue((New-Object System.Drawing.Point($x, 0))); $visited[$x, 0] = $true; $isBg[$x, 0] = $true }
        if (IsWhitePixel $x ($h - 1)) { $queue.Enqueue((New-Object System.Drawing.Point($x, ($h - 1)))); $visited[$x, ($h - 1)] = $true; $isBg[$x, ($h - 1)] = $true }
    }
    for ($y = 0; $y -lt $h; $y++) {
        if (IsWhitePixel 0 $y) { if (-not $visited[0, $y]) { $queue.Enqueue((New-Object System.Drawing.Point(0, $y))); $visited[0, $y] = $true; $isBg[0, $y] = $true } }
        if (IsWhitePixel ($w - 1) $y) { if (-not $visited[($w - 1), $y]) { $queue.Enqueue((New-Object System.Drawing.Point(($w - 1), $y))); $visited[($w - 1), $y] = $true; $isBg[($w - 1), $y] = $true } }
    }

    # 2. 漫水扩展（四邻域）
    $dirs = @(
        (New-Object System.Drawing.Point(1, 0)),
        (New-Object System.Drawing.Point(-1, 0)),
        (New-Object System.Drawing.Point(0, 1)),
        (New-Object System.Drawing.Point(0, -1))
    )

    while ($queue.Count -gt 0) {
        $p = $queue.Dequeue()
        foreach ($d in $dirs) {
            $nx = $p.X + $d.X
            $ny = $p.Y + $d.Y
            if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h) {
                if (-not $visited[$nx, $ny]) {
                    $visited[$nx, $ny] = $true
                    if (IsWhitePixel $nx $ny) {
                        $isBg[$nx, $ny] = $true
                        $queue.Enqueue((New-Object System.Drawing.Point($nx, $ny)))
                    }
                }
            }
        }
    }

    # 3. 输出图像：仅将连通外界的背景像素设为透明，角色内部所有眼白和反光完全保留
    $out = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($x = 0; $x -lt $w; $x++) {
        for ($y = 0; $y -lt $h; $y++) {
            $pixel = $bmp.GetPixel($x, $y)
            if ($isBg[$x, $y]) {
                # 连通的外部纯背景：完全透明
                $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                # 角色本体（包含眼白、白色衣服、高光）：100% 原始保留！
                $out.SetPixel($x, $y, $pixel)
            }
        }
    }

    $bmp.Dispose()
    $ms.Dispose()

    $out.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
    Write-Host "✓ 保护眼白并去底完成: $($fileItem.Name)" -ForegroundColor Green
}

# 批量处理所有英雄动作图
$heroDir = 'D:\ai项目\games\three-kingdoms-td\public\assets\heroes'
Get-ChildItem -Path $heroDir -Filter '*.png' | ForEach-Object {
    Remove-Background-FloodFill $_.FullName
}

# 批量处理所有小兵与Boss图
$enemyDir = 'D:\ai项目\games\three-kingdoms-td\public\assets\enemies'
Get-ChildItem -Path $enemyDir -Filter '*.png' | ForEach-Object {
    Remove-Background-FloodFill $_.FullName
}

Write-Host "所有图片智能去底完毕，眼白与内部高光已完美保留！" -ForegroundColor Yellow
