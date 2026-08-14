@echo off
REM 禁用代码签名自动发现，避免符号链接权限问题
set CSC_IDENTITY_AUTO_DISCOVERY=false
REM 设置本地缓存目录，避免全局缓存权限问题
set ELECTRON_BUILDER_CACHE=%~dp0.cache\electron-builder
if not exist "%ELECTRON_BUILDER_CACHE%" mkdir "%ELECTRON_BUILDER_CACHE%"
REM 使用国内镜像加速下载
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run make:win