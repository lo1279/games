#!/usr/bin/env bash
# ============================================================================
#  build.sh — 把网页游戏大厅构建为独立的发布目录 dist/
# ============================================================================
#  源码分层（仓库内）：
#    apps/web-hall/   网页大厅【源码】：index.html + css/ + js/
#    subgames/        子游戏库（10 款）+ _shared/（游戏共用资源）
#  构建产物：
#    dist/            可直接部署的扁平化网页（gitignore，由本脚本生成）
#
#  ⚠️ 关键约束：Vite 产物不能沿用 dist/ 这个目录名
#    云端发布工具会自动排除名为 dist/build/out 的目录，首次发布时三个 Vite
#    游戏会全部 404。因此源码侧 dist/ 保持不动，构建时把其内联为 game/。
#    源码里 hall.js / index.html 用 ../../subgames/<game>/... 表达路径，
#    本脚本在发布副本中将其扁平化为 <game>/...（与旧 build-web-hall.sh 的
#    dist→game sed 机制同源）。
#
#  用法：
#    bash tools/build.sh
#    然后对助理说「发布游戏大厅」即可（部署目录指向 dist/）
#
#  只复制网页运行必需的产物：
#    - 纯静态游戏：整个目录（无 node_modules，体积本来就小）
#    - Vite 工程：只取 dist/ 内的产物，重命名到 game/
#    - _shared/：游戏共用的 mobile-game.css / mobile-controls.js
# ============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist"

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

echo "==> 复制大厅骨架（apps/web-hall: index.html / css / js）"
cp "$ROOT/apps/web-hall/index.html" "$OUT/"
cp -r "$ROOT/apps/web-hall/css" "$OUT/"
cp -r "$ROOT/apps/web-hall/js" "$OUT/"

echo "==> 复制子游戏库（subgames/*，排除 node_modules / 各游戏自带 dist）"
for d in "$ROOT"/subgames/*/; do
  name=$(basename "$d")
  cp -r "$d" "$OUT/$name"
  # 任何游戏都不该把 node_modules / dist 带进发布产物
  rm -rf "$OUT/$name/node_modules" "$OUT/$name/dist"
done

echo "==> 复制 Vite 构建产物（dist/ → game/，规避发布工具的产物目录排除）"
for p in "${DIST_PROJECTS[@]}"; do
  if [[ ! -d "$ROOT/subgames/$p/dist" ]]; then
    echo "  !! 跳过 $p：未找到 subgames/$p/dist，请先在该目录执行 npm run build"
    continue
  fi
  mkdir -p "$OUT/$p/game"
  # -a 保留目录层级；产物内部引用为 ./assets/... 相对路径，改目录名不影响
  cp -r "$ROOT/subgames/$p/dist/." "$OUT/$p/game/"
  echo "  · $p/dist → $p/game"
done

# hall.js / index.html 里的源码态路径 ../../subgames/<game>/... 扁平化为 <game>/...
# 并同步把 Vite 的 dist/ 改写为 game/（仅改发布副本，源码不动）
echo "==> 改写发布副本中的路径"
for p in "${DIST_PROJECTS[@]}"; do
  sed -i "s|../../subgames/${p}/dist/index.html|${p}/game/index.html|g" "$OUT/js/hall.js" "$OUT/index.html"
done
sed -i "s|../../subgames/||g" "$OUT/js/hall.js" "$OUT/index.html"

echo "==> 校验：发布副本不应再含 ../../subgames/ 或 /dist/index.html"
if grep -nE "\.\./\.\./subgames/|/dist/index\.html" "$OUT/js/hall.js" "$OUT/index.html"; then
  echo "  !! 发布副本仍存在未改写路径，请检查"
  exit 1
fi
echo "  · 路径校验通过"

echo "==> 清理无关文件"
rm -rf "$OUT/.git" "$OUT/.idea" "$OUT/.workbuddy"
find "$OUT" -name ".DS_Store" -delete 2>/dev/null || true

echo "==> 完成，发布目录体积："
du -sh "$OUT"
