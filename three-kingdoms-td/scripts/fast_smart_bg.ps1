$code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Collections.Generic;

public class FastFloodRemover {
    public static void Process(string filePath) {
        if (!File.Exists(filePath)) return;
        byte[] bytes = File.ReadAllBytes(filePath);
        using (var ms = new MemoryStream(bytes))
        using (var bmp = new Bitmap(ms)) {
            int w = bmp.Width;
            int h = bmp.Height;

            BitmapData srcData = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            int stride = srcData.Stride;
            byte[] pixelBuffer = new byte[stride * h];
            System.Runtime.InteropServices.Marshal.Copy(srcData.Scan0, pixelBuffer, 0, pixelBuffer.Length);
            bmp.UnlockBits(srcData);

            bool[] isBg = new bool[w * h];
            bool[] visited = new bool[w * h];
            Queue<int> q = new Queue<int>(w * 4);

            Func<int, int, bool> isWhite = (x, y) => {
                int idx = y * stride + x * 4;
                byte b = pixelBuffer[idx];
                byte g = pixelBuffer[idx + 1];
                byte r = pixelBuffer[idx + 2];
                return r >= 232 && g >= 232 && b >= 232;
            };

            for (int x = 0; x < w; x++) {
                if (isWhite(x, 0)) { int p = x; visited[p] = true; isBg[p] = true; q.Enqueue(p); }
                if (isWhite(x, h - 1)) { int p = (h - 1) * w + x; visited[p] = true; isBg[p] = true; q.Enqueue(p); }
            }
            for (int y = 0; y < h; y++) {
                if (isWhite(0, y)) { int p = y * w; if (!visited[p]) { visited[p] = true; isBg[p] = true; q.Enqueue(p); } }
                if (isWhite(w - 1, y)) { int p = y * w + (w - 1); if (!visited[p]) { visited[p] = true; isBg[p] = true; q.Enqueue(p); } }
            }

            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };

            while (q.Count > 0) {
                int curr = q.Dequeue();
                int cx = curr % w;
                int cy = curr / w;

                for (int i = 0; i < 4; i++) {
                    int nx = cx + dx[i];
                    int ny = cy + dy[i];
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        int np = ny * w + nx;
                        if (!visited[np]) {
                            visited[np] = true;
                            if (isWhite(nx, ny)) {
                                isBg[np] = true;
                                q.Enqueue(np);
                            }
                        }
                    }
                }
            }

            // 输出图像，保留眼白
            using (var outBmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                BitmapData outData = outBmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                byte[] outBuffer = new byte[stride * h];

                for (int y = 0; y < h; y++) {
                    for (int x = 0; x < w; x++) {
                        int pos = y * w + x;
                        int idx = y * stride + x * 4;

                        if (isBg[pos]) {
                            // 连通外景，完全透明
                            outBuffer[idx] = 0;
                            outBuffer[idx + 1] = 0;
                            outBuffer[idx + 2] = 0;
                            outBuffer[idx + 3] = 0;
                        } else {
                            // 角色本体内部（包括眼睛眼白、高光、白发等），完好保留！
                            outBuffer[idx] = pixelBuffer[idx];
                            outBuffer[idx + 1] = pixelBuffer[idx + 1];
                            outBuffer[idx + 2] = pixelBuffer[idx + 2];
                            outBuffer[idx + 3] = 255;
                        }
                    }
                }

                System.Runtime.InteropServices.Marshal.Copy(outBuffer, 0, outData.Scan0, outBuffer.Length);
                outBmp.UnlockBits(outData);
                outBmp.Save(filePath, ImageFormat.Png);
            }
        }
        Console.WriteLine("Done: " + Path.GetFileName(filePath));
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$heroDir = 'D:\ai项目\games\three-kingdoms-td\public\assets\heroes'
Get-ChildItem -Path $heroDir -Filter '*.png' | ForEach-Object {
    [FastFloodRemover]::Process($_.FullName)
}

$enemyDir = 'D:\ai项目\games\three-kingdoms-td\public\assets\enemies'
Get-ChildItem -Path $enemyDir -Filter '*.png' | ForEach-Object {
    [FastFloodRemover]::Process($_.FullName)
}

Write-Host "全部图片瞬间处理完毕！" -ForegroundColor Green
