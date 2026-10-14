Add-Type -AssemblyName System.Drawing

$dir = "D:\ai项目\games\three-kingdoms-td\public\assets\enemies"
$files = Get-ChildItem -Path $dir -Filter "*.png"

Write-Host "开始批量去除小兵图片的纯白背景..." -ForegroundColor Cyan

foreach ($file in $files) {
    if ($file.Name.EndsWith(".bak.png")) { continue }
    
    $fullPath = $file.FullName
    Write-Host "正在处理: $($file.Name) ..."
    
    # 读入图像文件流，避免文件被独占锁定
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $bmp = [System.Drawing.Bitmap]::FromStream($ms)
    
    # 备份原文件
    $backupPath = "$fullPath.bak"
    if (-not (Test-Path $backupPath)) {
        Copy-Item -Path $fullPath -Destination $backupPath
    }

    $width = $bmp.Width
    $height = $bmp.Height
    $output = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    for ($x = 0; $x -lt $width; $x++) {
        for ($y = 0; $y -lt $height; $y++) {
            $c = $bmp.GetPixel($x, $y)
            # 颜色判定：如果接近白色或浅灰底色
            if ($c.R -ge 235 -and $c.G -ge 235 -and $c.B -ge 235) {
                # 完全透明
                $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } elseif ($c.R -ge 220 -and $c.G -ge 220 -and $c.B -ge 220) {
                # 边缘半透明羽化过度，避免白边锯齿
                $diff = [Math]::Max($c.R, [Math]::Max($c.G, $c.B))
                $alpha = [int](255 * (255 - $diff) / 35)
                $output.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
            } else {
                $output.SetPixel($x, $y, $c)
            }
        }
    }

    $bmp.Dispose()
    $ms.Dispose()

    # 保存处理好的透明PNG
    $output.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $output.Dispose()
    Write-Host "✓ 完成处理并保存: $($file.Name)" -ForegroundColor Green
}

Write-Host "所有小兵图片白底处理完毕！" -ForegroundColor Cyan
