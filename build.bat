@echo off
REM Disable code signing auto-discovery to avoid symlink permission issues
set CSC_IDENTITY_AUTO_DISCOVERY=false
REM Set local cache directory to avoid global cache permission issues
set ELECTRON_BUILDER_CACHE=%~dp0.cache\electron-builder
if not exist "%ELECTRON_BUILDER_CACHE%" mkdir "%ELECTRON_BUILDER_CACHE%"
REM Use Chinese mirrors for faster downloads
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
REM First compile the latest source code, then package
call npm run build
call npm run make:win
