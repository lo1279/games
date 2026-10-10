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
#  用法：
#    bash tools/build-web-hall.sh
#    然后对本会话说「发布游戏大厅」即可
#
#  只复制网页运行必需的产物：
#    - 纯静态游戏：整个目录（无 node_modules，体积本来就小）
#    - Vite 工程：只取 dist/ 构建产物，丢弃 src/ 与 node_modules
# ============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/web-hall"

# Vite 工程 → 只发布 dist，映射为「工程名/dist」以匹配 hall.js 里的路径
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

echo "==> 复制 Vite 构建产物"
for p in "${DIST_PROJECTS[@]}"; do
  if [[ ! -d "$ROOT/$p/dist" ]]; then
    echo "  !! 跳过 $p：未找到 dist/，请先在该目录执行构建"
    continue
  fi
  mkdir -p "$OUT/$p"
  cp -r "$ROOT/$p/dist" "$OUT/$p/"
  echo "  · $p/dist"
done

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