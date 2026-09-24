# =====================================================================
# 🎮 游戏大厅本地服务引擎 (Game Hub Server Engine)
# 支持智能动态端口探测 (Auto Port Hunting)，彻底杜绝端口冲突
# =====================================================================

$root = (Get-Item -Path $PSScriptRoot).Parent.FullName
$basePort = 8080
$maxPort = 8099
$listener = $null
$boundPort = 0

Write-Host "=====================================================================" -ForegroundColor DarkCyan
Write-Host "  🎮 综合游戏大厅 (Game Hub Arcade) · 本地服务启动中..." -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor DarkCyan
Write-Host ""

# 智能端口探测：从 8080 开始依次尝试，遇到冲突自动顺延
for ($p = $basePort; $p -le $maxPort; $p++) {
    try {
        $temp = New-Object System.Net.HttpListener
        $temp.Prefixes.Add("http://localhost:$p/")
        $temp.Start()
        $listener = $temp
        $boundPort = $p
        break
    } catch {
        if ($temp) {
            try { $temp.Close() } catch {}
        }
    }
}

# 极端情况降级容错
if (-not $listener) {
    Write-Host "[!] 端口 8080-8099 均被占用或系统受限，正在自动降级以文件模式启动大厅..." -ForegroundColor Yellow
    $indexPath = Join-Path $root "index.html"
    Start-Process $indexPath
    exit
}

if ($boundPort -ne $basePort) {
    Write-Host "[提示] 默认端口 $basePort 已被其他软件占用，已自动规避冲突并切换至可用端口: $boundPort" -ForegroundColor Yellow
}

Write-Host "[√] 本地 Web 服务已就绪: http://localhost:$boundPort/" -ForegroundColor Green
Write-Host "[√] 正在自动为您呼出系统默认浏览器..." -ForegroundColor Green
Write-Host "[提示] 保持此窗口开启即可畅玩；关闭此窗口服务即退出。`n" -ForegroundColor DarkGray

# 启动默认浏览器打开大厅
Start-Process "http://localhost:$boundPort/index.html"

# 处理静态资源请求
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        
        $path = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($path)) {
            $path = 'index.html'
        }
        
        $cleanPath = [System.Uri]::UnescapeDataString($path).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $localPath = [System.IO.Path]::Combine($root, $cleanPath)

        if ([System.IO.File]::Exists($localPath)) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $mime = switch ($ext) {
                '.html' {'text/html; charset=utf-8'}
                '.js'   {'application/javascript; charset=utf-8'}
                '.css'  {'text/css; charset=utf-8'}
                '.json' {'application/json; charset=utf-8'}
                '.png'  {'image/png'}
                '.jpg'  {'image/jpeg'}
                '.jpeg' {'image/jpeg'}
                '.gif'  {'image/gif'}
                '.svg'  {'image/svg+xml'}
                '.ico'  {'image/x-icon'}
                '.wav'  {'audio/wav'}
                '.mp3'  {'audio/mpeg'}
                default {'application/octet-stream'}
            }
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $res.OutputStream.Write($msg, 0, $msg.Length)
        }
        $res.Close()
    } catch {}
}
