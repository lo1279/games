@echo off
chcp 65001 >nul
title 综合游戏大厅启动器 (Game Hub Arcade)
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0js\server.ps1"

pause
