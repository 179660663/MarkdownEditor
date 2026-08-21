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
REM 发布到 GitHub Releases 需要设置环境变量 GH_TOKEN（GitHub Personal Access Token）
REM 设置后会自动上传安装包与 latest.yml，供软件内自动更新使用
if defined GH_TOKEN (
  call npm run make:win -- --publish always
) else (
  call npm run make:win
)
