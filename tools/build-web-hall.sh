#!/usr/bin/env bash
# ============================================================================
#  build-web-hall.sh — 把网页游戏大厅打包成独立的发布目录
# ============================================================================
#  为什么要这个脚本：
#    仓库根目录 D:\ai项目\games 同时是「微信小程序工程」和「网页游戏大厅」，
#    小程序配置文件（project.config.json / app.json / app.wxss / pages/）会让
#    云端发布工具把整个目录识别成小程序，从而拿不到网页分享链接。
#    所以把网页所需的文件抽到 web-hall/，小程序文件留在根目录互不干扰。
#
#  ⚠️ 关键约束：Vite 产物不能沿用 dist/ 这个目录名
#    云端发布工具会自动排除名为 build output 的目录（dist/build/out 等），
#    首次发布时三个 Vite 游戏全部 404。
#    产物内部引用均为 ./assets/... 相对路径，因此只要把 dist/ 的内容
#    放到任意非保留目录名（如 build/ 同样会被排除，故用 game/）即可正常工作，
#    并同步改写 hall.js 里的 path。源码侧 dist/ 保持不变，本地开发不受影响。
#
#  用法：
#    bash tools/build-web-hall.sh
#    然后对助理说「发布游戏大厅」即可
#
#  只复制网页运行必需的产物：
#    - 纯静态游戏：整个目录（无 node_modules，体积本来就小）
#    - Vite 工程：只取 dist/ 内的产物，重命名到 game/
# ============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/web-hall"

# Vite 工程 → 只发布 dist，映射为「工程名/game」以匹配 hall.js 里的路径
# 注意：产物目录名不能用 dist/build/out 等，会被发布工具排除
DIST_PROJECTS=("life-simulator" "mythology-deckbuilder" "three-kingdoms-td")
# 纯静态游戏 → 整个目录原样发布
STATIC_GAMES=(
  "dice-game" "minesweeper" "tank-battle" "tetris"
  "thunder-fighter" "super-mario" "three-kingdoms-slg"
)

echo "==> 清理旧的发布目录"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> 复制大厅骨架（index.html / css / js）"
cp "$ROOT/index.html" "$OUT/"
cp -r "$ROOT/css" "$OUT/"
cp -r "$ROOT/js" "$OUT/"

echo "==> 复制 Vite 构建产物（dist/ → game/，规避发布工具的产物目录排除）"
for p in "${DIST_PROJECTS[@]}"; do
  if [[ ! -d "$ROOT/$p/dist" ]]; then
    echo "  !! 跳过 $p：未找到 dist/，请先在该目录执行构建"
    continue
  fi
  mkdir -p "$OUT/$p/game"
  # -a 保留目录层级；产物内部引用为 ./assets/... 相对路径，改目录名不影响
  cp -r "$ROOT/$p/dist/." "$OUT/$p/game/"
  echo "  · $p/dist → $p/game"
done

# hall.js 里的三处 Vite 路径 dist/ → game/，仅改发布副本，源码不动
echo "==> 改写发布副本 hall.js 中的 Vite 产物路径"
for p in "${DIST_PROJECTS[@]}"; do
  sed -i "s|${p}/dist/index.html|${p}/game/index.html|g" "$OUT/js/hall.js"
done
# 校验：发布副本里不应再有 dist/ 引用（源码 js/hall.js 保持原样）
if grep -n "dist/index.html" "$OUT/js/hall.js"; then
  echo "  !! 发布副本仍存在 dist/ 引用，请检查"
  exit 1
fi
echo "  · 已全部改写为 game/"

echo "==> 复制纯静态游戏"
for g in "${STATIC_GAMES[@]}"; do
  if [[ ! -d "$ROOT/$g" ]]; then
    echo "  !! 跳过 $g：目录不存在"
    continue
  fi
  cp -r "$ROOT/$g" "$OUT/"
  echo "  · $g"
done

# 发布目录不该带这些，免得平白占体积
rm -rf "$OUT/.git" "$OUT/.idea" "$OUT/.workbuddy"
find "$OUT" -name ".DS_Store" -delete 2>/dev/null || true

echo "==> 完成，发布目录体积："
du -sh "$OUT"