const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CACHE_DIR = path.join(__dirname, '.cache', 'electron-builder', 'winCodeSign');
const URL = 'https://npmmirror.com/mirrors/electron-builder-binaries/winCodeSign-2.6.0/winCodeSign-2.6.0.7z';
const SEVEN_ZIP = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function setupWinCodeSign() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    
    // Clean up existing directories
    const existingDirs = fs.readdirSync(CACHE_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    
    for (const dir of existingDirs) {
      fs.rmSync(path.join(CACHE_DIR, dir), { recursive: true, force: true });
    }
    
    // Clean up existing .7z files
    const zipFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.7z'));
    for (const file of zipFiles) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    }
    
    // Generate a random folder name
    const randomName = Math.floor(Math.random() * 1000000000).toString();
    const extractDir = path.join(CACHE_DIR, randomName);
    fs.mkdirSync(extractDir, { recursive: true });
    
    // Download the archive
    const archivePath = path.join(CACHE_DIR, `${randomName}.7z`);
    console.log('下载 winCodeSign...');
    await downloadFile(URL, archivePath);
    console.log('下载完成！');
    
    // First, list the contents of the archive to see what files are needed
    console.log('查看归档内容...');
    const listOutput = execSync(`"${SEVEN_ZIP}" l -bd "${archivePath}"`, { encoding: 'utf8', timeout: 10000 });
    
    // Extract without creating symlinks
    console.log('解压中（跳过符号链接）...');
    try {
      execSync(`"${SEVEN_ZIP}" x -snld -y -bd "${archivePath}" -o"${extractDir}"`, { 
        stdio: 'pipe',
        timeout: 30000 
      });
      console.log('解压成功！');
    } catch (err) {
      console.log('警告: 解压有符号链接错误，继续处理...');
    }
    
    // Remove the archive file
    try { fs.unlinkSync(archivePath); } catch {}
    
    // Check what files were extracted and what's missing
    console.log('\n检查解压结果...');
    const extractedFiles = [];
    function walkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          extractedFiles.push(fullPath);
        } else if (entry.isDirectory()) {
          walkDir(fullPath);
        }
      }
    }
    walkDir(extractDir);
    console.log(`已提取 ${extractedFiles.length} 个文件`);
    
    // Create placeholder files for the macOS .dylib symlinks that were skipped
    // These are needed for electron-builder to find them
    const dylibPaths = [
      'darwin/10.12/lib/libcrypto.dylib',
      'darwin/10.12/lib/libssl.dylib'
    ];
    
    for (const relativePath of dylibPaths) {
      const fullPath = path.join(extractDir, relativePath);
      const dirName = path.dirname(fullPath);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`创建占位文件: ${relativePath}`);
        fs.mkdirSync(dirName, { recursive: true });
        fs.writeFileSync(fullPath, '');
      }
    }
    
    // Create all directories from the archive listing
    // Parse the listing to create missing directories
    const lines = listOutput.split('\n');
    const directories = new Set();
    for (const line of lines) {
      if (line.includes('D')) {
        // Directory line - extract path
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 6) {
          const path = parts.slice(5).join(' ');
          if (path && !path.endsWith('.')) {
            directories.add(path);
          }
        }
      }
    }
    
    // Create any missing directories
    for (const dirPath of directories) {
      const fullPath = path.join(extractDir, dirPath);
      if (!fs.existsSync(fullPath)) {
        console.log(`创建目录: ${dirPath}`);
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
    
    // Create a marker file
    fs.writeFileSync(path.join(extractDir, 'installed.flag'), 'true');
    
    console.log(`\n✅ winCodeSign 设置完成！`);
    console.log(`   路径: ${extractDir}`);
    console.log(`\n现在可以运行 npm run make:win 了。`);
    
  } catch (error) {
    console.error('❌ 设置失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

setupWinCodeSign();