# tools/compress_portraits.py
# 将 Web 版三国志武将立绘(115 张 PNG, 14MB) 压缩为小程序分包可用的 JPEG(<2MB)
import os, sys
from PIL import Image

SRC = r"D:\ai项目\games\subgames\three-kingdoms-slg\assets\generals"
DST = r"D:\ai项目\games\apps\miniprogram\pages\games\three-kingdoms-slg\assets\generals"
MAX_W = 200
QUALITY = 50

os.makedirs(DST, exist_ok=True)
total_in = total_out = 0
count = 0
for fn in sorted(os.listdir(SRC)):
    if not fn.lower().endswith(".png"):
        continue
    base = os.path.splitext(fn)[0]
    out = os.path.join(DST, base + ".jpg")
    im = Image.open(os.path.join(SRC, fn)).convert("RGB")
    if im.width > MAX_W:
        h = max(1, round(im.height * MAX_W / im.width))
        im = im.resize((MAX_W, h), Image.LANCZOS)
    im.save(out, "JPEG", quality=QUALITY, optimize=True)
    sz_in = os.path.getsize(os.path.join(SRC, fn))
    sz_out = os.path.getsize(out)
    total_in += sz_in; total_out += sz_out; count += 1

print(f"处理 {count} 张 | 源 {total_in/1024/1024:.1f}MB -> 产物 {total_out/1024/1024:.2f}MB")
