import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron'
import { join, relative, basename, extname, resolve, dirname, normalize, isAbsolute } from 'node:path'
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import Store from 'electron-store'
import { pathToFileURL, fileURLToPath } from 'node:url'
import * as jschardet from 'jschardet'
import * as iconv from 'iconv-lite'

// 设置控制台代码页为 UTF-8（Windows）
if (process.platform === 'win32') {
  try {
    const { execSync } = require('node:child_process')
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch {
    // 忽略错误
  }
}

interface RecentFile {
  path: string
  title: string
}

let store: Store<{
  windowBounds: { x: number; y: number; width: number; height: number }
  recentFiles: RecentFile[]
  folders: { path: string; name: string; collapsed: boolean }[]
}>

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, 'renderer')

let win: BrowserWindow | null = null

const preload = join(__dirname, '../preload/index.js')
const url = process.env.ELECTRON_RENDERER_URL || ''
const indexHtml = join(process.env.DIST, 'index.html')

// MIME type mapping for images
const mimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.apng': 'image/apng',
  '.avif': 'image/avif'
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

// Register custom protocol for local markdown resources
function registerCustomProtocols() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'md-local',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        allowServiceWorkers: true,
        corsEnabled: true
      }
    }
  ])
}

function setupProtocolHandler() {
  // Use registerBufferProtocol for more reliable handling
  protocol.registerBufferProtocol('md-local', (request, callback) => {
    try {
      const url = new URL(request.url)
      console.log('[md-local] Full URL:', decodeURIComponent(request.url))
      
      // Get path from query parameter (more reliable for Windows paths)
      let filePath = url.searchParams.get('path')
      
      if (!filePath) {
        // Fallback: try to extract from pathname
        filePath = decodeURIComponent(url.pathname)
        if (process.platform === 'win32') {
          filePath = filePath.replace(/^\/([a-zA-Z]:)/, '$1')
          filePath = filePath.replace(/\//g, '\\')
        }
      }
      
      console.log('[md-local] File path:', filePath)
      
      if (!filePath) {
        callback({ statusCode: 400, data: Buffer.from('Missing path parameter') })
        return
      }
      
      // Resolve and normalize the path
      const normalizedPath = resolve(normalize(filePath))
      
      console.log('[md-local] Normalized path:', normalizedPath)
      
      // Check existence
      if (!existsSync(normalizedPath)) {
        console.error('[md-local] File not found:', normalizedPath)
        callback({ statusCode: 404, data: Buffer.from('File not found: ' + normalizedPath) })
        return
      }
      
      const stats = statSync(normalizedPath)
      if (!stats.isFile()) {
        console.error('[md-local] Not a file:', normalizedPath)
        callback({ statusCode: 400, data: Buffer.from('Not a file') })
        return
      }
      
      const mimeType = getMimeType(normalizedPath)
      const fileData = readFileSync(normalizedPath)
      
      console.log('[md-local] Serving:', normalizedPath, 'type:', mimeType, 'size:', fileData.length)
      
      callback({
        mimeType,
        data: fileData,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      })
    } catch (err) {
      console.error('[md-local] Error:', err)
      callback({ statusCode: 500, data: Buffer.from('Internal error: ' + (err instanceof Error ? err.message : String(err))) })
    }
  })
}

function initStore() {
  try {
    store = new Store<{
      windowBounds: { x: number; y: number; width: number; height: number }
      recentFiles: RecentFile[]
      folders: { path: string; name: string; collapsed: boolean }[]
    }>()
    console.log('[Main] electron-store initialized successfully')
  } catch (err) {
    console.error('[Main] Failed to initialize electron-store:', err)
    store = null as any
  }
}

async function createWindow() {
  initStore()
  const savedBounds = store?.get('windowBounds')

  win = new BrowserWindow({
    title: 'Markdown Editor',
    width: savedBounds?.width ?? 1200,
    height: savedBounds?.height ?? 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: true
    }
  })

  if (url) {
    console.log('[Main] Loading dev URL:', url)
    win.loadURL(url).catch((err) => {
      console.error('[Main] Failed to load dev URL:', err)
    })
    win.webContents.openDevTools()
  } else {
    console.log('[Main] Loading local file:', indexHtml)
    win.loadFile(indexHtml)
  }

  win.webContents.on('did-finish-load', () => {
    console.log('[Main] Window finished loading')
  })

  win.webContents.on('will-navigate', (event, navUrl) => {
    if (navUrl.startsWith('http://') || navUrl.startsWith('https://') || navUrl.startsWith('mailto:')) {
      event.preventDefault()
      shell.openExternal(navUrl).catch(() => {})
    }
  })

  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    if (/^https?:\/\//i.test(openUrl) || /^mailto:/i.test(openUrl)) {
      shell.openExternal(openUrl).catch(() => {})
    }
    return { action: 'deny' }
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Main] Page load failed:', errorCode, errorDescription)
  })

  win.webContents.on('console-message', (_event, level, message, sourceId, lineNo) => {
    const levelMap = ['VERBOSE', 'INFO', 'WARNING', 'ERROR']
    const levelStr = levelMap[level] || 'LOG'
    console.log(`[Renderer ${levelStr}] ${message} (${sourceId}:${lineNo})`)
  })

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[Main] Preload script error:', preloadPath, error)
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] Render process gone:', details.reason)
  })

  win.on('closed', () => {
    win = null
  })

  // 窗口关闭前检查是否有未保存的文档
  win.on('close', async (e) => {
    if (!win) return
    
    // 阻止默认关闭行为
    e.preventDefault()
    
    // 向渲染进程询问是否有未保存的文档
    try {
      const hasUnsaved = await win.webContents.executeJavaScript(`
        (function() {
          const store = window.__editorStore__
          if (!store) return { hasUnsaved: false, count: 0 }
          const dirtyDocs = store.getDirtyDocuments()
          return { 
            hasUnsaved: dirtyDocs.length > 0, 
            count: dirtyDocs.length,
            docs: dirtyDocs.map(d => ({ id: d.id, title: d.title }))
          }
        })()
      `)
      
      if (hasUnsaved.hasUnsaved) {
        let shouldClose = true
        
        // 逐个确认未保存的文档
        for (const doc of hasUnsaved.docs) {
          const result = await dialog.showMessageBox(win, {
            type: 'question',
            buttons: ['保存', '不保存', '取消'],
            defaultId: 0,
            cancelId: 2,
            title: '未保存的更改',
            message: `是否保存对 "${doc.title}" 的更改？`,
            detail: '如果不保存，您的更改将丢失。'
          })
          
          if (result.response === 2) { // 取消
            shouldClose = false
            break
          } else if (result.response === 0) { // 保存
            // 通知渲染进程保存该文档
            await win.webContents.executeJavaScript(`
              (async function() {
                const store = window.__editorStore__
                if (store) {
                  store.setActiveTab('${doc.id}')
                  await store.saveFileAction(store.getDocument('${doc.id}')?.content || '')
                }
              })()
            `)
          }
          // result.response === 1 表示不保存，继续下一个
        }
        
        if (shouldClose) {
          win.destroy() // 强制关闭窗口
        }
      } else {
        win.destroy() // 没有未保存的文档，直接关闭
      }
    } catch (err) {
      console.error('[Main] Error checking unsaved documents:', err)
      // 出错时直接关闭窗口
      win.destroy()
    }
  })

  win.on('move', () => {
    if (win && store) store.set('windowBounds', win.getBounds())
  })

  win.on('resize', () => {
    if (win && store) store.set('windowBounds', win.getBounds())
  })
}

process.on('uncaughtException', (error) => {
  console.error('[Main Process] Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main Process] Unhandled rejection:', reason)
})

// Register custom protocols before app is ready
registerCustomProtocols()

app.whenReady().then(() => {
  // Setup protocol handler
  setupProtocolHandler()
  
  createWindow().catch((err) => {
    console.error('[Main Process] Failed to create window:', err)
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('get-config', () => {
  if (!store) return {}
  return store.store
})

ipcMain.handle('set-config', (_event, key: string, value: unknown) => {
  if (!store) return false
  try {
    store.set(key, value)
    return true
  } catch (err) {
    console.error('[Main] set-config failed:', err)
    return false
  }
})

ipcMain.handle('new-file', () => {
  return true
})

ipcMain.handle('open-file', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = readFileWithEncoding(filePath)
  return { path: filePath, content }
})

ipcMain.handle('open-folder', async () => {
  if (!win) return null
  try {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    console.log('[Main] Folder selected:', result.filePaths[0])
    return result.filePaths[0]
  } catch (err) {
    console.error('[Main] Failed to open folder dialog:', err)
    return null
  }
})

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

/**
 * 检测文件编码并读取内容
 * 支持 UTF-8、GBK、GB2312、GB18030、Big5 等中文编码
 */
function readFileWithEncoding(filePath: string): string {
  // 首先以 Buffer 方式读取文件
  const buffer = readFileSync(filePath)

  // 使用 jschardet 检测编码
  const detection = jschardet.detect(buffer)
  const encoding = detection.encoding?.toLowerCase() || 'utf-8'
  const confidence = detection.confidence || 0

  console.log(`[Encoding] Detected encoding for ${filePath}: ${encoding} (confidence: ${confidence})`)

  // 读取内容
  let content: string
  if (encoding === 'utf-8' || encoding === 'ascii') {
    content = buffer.toString('utf-8')
  } else {
    // 对于中文编码，使用 iconv-lite 转换
    const supportedEncodings = ['gbk', 'gb2312', 'gb18030', 'big5', 'shift_jis', 'euc-jp', 'euc-kr', 'windows-1252', 'iso-8859-1']

    if (supportedEncodings.includes(encoding)) {
      try {
        content = iconv.decode(buffer, encoding)
        console.log(`[Encoding] Converted from ${encoding} to UTF-8`)
      } catch (err) {
        console.error(`[Encoding] Failed to convert from ${encoding}, falling back to UTF-8:`, err)
        content = buffer.toString('utf-8')
      }
    } else if (confidence < 0.5) {
      // 编码不确定或置信度低时，尝试用 UTF-8，如果失败则尝试 GBK
      try {
        const utf8Content = buffer.toString('utf-8')
        if (!utf8Content.includes('\uFFFD')) {
          content = utf8Content
        } else {
          content = iconv.decode(buffer, 'gbk')
          console.log(`[Encoding] Fallback to GBK due to low confidence`)
        }
      } catch {
        content = buffer.toString('utf-8')
      }
    } else {
      content = buffer.toString('utf-8')
    }
  }

  // 标准化换行符：\r\n -> \n，\r -> \n
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

async function buildFolderTree(folderPath: string, basePath: string, depth: number = 0): Promise<FileNode[]> {
  if (depth > 10) return []
  const nodes: FileNode[] = []
  try {
    const entries = await readdir(folderPath)
    const entriesWithStats = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(folderPath, entry)
        try {
          const s = await stat(fullPath)
          return { entry, fullPath, isDir: s.isDirectory() }
        } catch {
          return null
        }
      })
    )

    const validEntries = entriesWithStats.filter(Boolean) as { entry: string; fullPath: string; isDir: boolean }[]
    validEntries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.entry.localeCompare(b.entry)
    })

    for (const { entry, fullPath, isDir } of validEntries) {
      const relPath = basePath ? relative(basePath, fullPath) : entry

      if (isDir) {
        nodes.push({
          name: entry,
          path: relPath,
          isDirectory: true,
          children: await buildFolderTree(fullPath, basePath, depth + 1)
        })
      } else {
        const ext = extname(entry).toLowerCase()
        if (ext === '.md' || ext === '.markdown' || ext === '.mdown' || ext === '.mkd' || ext === '.txt') {
          nodes.push({
            name: entry,
            path: relPath,
            isDirectory: false
          })
        }
      }
    }
  } catch (err) {
    console.error('[Main] Failed to read folder:', folderPath, err)
  }
  return nodes
}

ipcMain.handle('list-folder', async (_event, folderPath: string) => {
  if (!folderPath || !existsSync(folderPath)) return []
  return await buildFolderTree(folderPath, folderPath)
})

ipcMain.handle('save-file', (_event, filePath: string, content: string) => {
  if (!filePath) return false
  writeFileSync(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('save-file-as', async (_event, content: string) => {
  if (!win) return null
  const result = await dialog.showSaveDialog(win, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'untitled.md'
  })
  if (result.canceled || !result.filePath) return null
  writeFileSync(result.filePath, content, 'utf-8')
  return result.filePath
})

ipcMain.handle('get-recent-files', () => {
  if (!store) return []
  return store.get('recentFiles', [])
})

function normalizePath(filePath: string): string {
  // 统一路径格式：转换为小写（Windows）并使用正斜杠
  return filePath.toLowerCase().replace(/\\/g, '/')
}

ipcMain.handle('add-to-recent-files', (_event, path: string, title: string) => {
  if (!store) return false
  const recentFiles = store.get('recentFiles', []) as RecentFile[]
  const normalizedTarget = normalizePath(path)
  const filtered = recentFiles.filter((f) => normalizePath(f.path) !== normalizedTarget)
  filtered.unshift({ path, title })
  store.set('recentFiles', filtered.slice(0, 10))
  return true
})

ipcMain.handle('clear-recent-files', () => {
  if (!store) return false
  store.set('recentFiles', [])
  return true
})

ipcMain.handle('read-file', (_event, filePath: string) => {
  if (!filePath || !existsSync(filePath)) return null
  const content = readFileWithEncoding(filePath)
  return { path: filePath, content }
})

const darkThemeStyles = `
  body { font-family: 'Segoe UI', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 15px; line-height: 1.7; color: #d4d4d4; background: #1e1e1e; }
  h1, h2, h3, h4, h5, h6 { font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; line-height: 1.3; margin-top: 1.5em; margin-bottom: 0.5em; color: #d4d4d4; }
  h1 { font-size: 2em; border-bottom: 1px solid #444; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  h5 { font-size: 0.9em; }
  h6 { font-size: 0.85em; color: #888; }
  p { margin: 0.8em 0; }
  a { color: #3794ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { padding-left: 2em; margin: 0.8em 0; }
  li { margin: 0.3em 0; }
  li input[type='checkbox'] { margin-right: 0.4em; }
  blockquote { border-left: 4px solid #0e639c; padding: 0.5em 1em; margin: 1em 0; color: #999; background: rgba(14, 99, 156, 0.1); border-radius: 0 4px 4px 0; }
  code { background: #2d2d2d; padding: 2px 6px; border-radius: 3px; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 0.9em; color: #ce9178; }
  pre { background: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1em 0; line-height: 1.5; }
  pre code { background: transparent; padding: 0; font-size: 0.9em; color: #d4d4d4; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #444; padding: 8px 12px; text-align: left; }
  th { background: #2d2d2d; }
  img { max-width: 100%; border-radius: 4px; }
  hr { border: none; border-top: 1px solid #444; margin: 2em 0; }
  .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name, .hljs-tag { color: #569cd6; }
  .hljs-string, .hljs-title, .hljs-section, .hljs-attribute, .hljs-literal, .hljs-template-tag, .hljs-template-variable, .hljs-type, .hljs-addition { color: #ce9178; }
  .hljs-comment, .hljs-quote, .hljs-deletion { color: #6a9955; }
  .hljs-number, .hljs-symbol, .hljs-bullet, .hljs-link, .hljs-attr, .hljs-variable, .hljs-template-variable, .hljs-class .hljs-title { color: #b5cea8; }
  .hljs-emphasis { font-style: italic; }
  .hljs-function .hljs-title, .hljs-title.function_ { color: #dcdcaa; }
  .hljs-variable, .hljs-template-variable { color: #9cdcfe; }
  .hljs-property, .hljs-built_in { color: #4fc1ff; }
  .custom-container { padding: 1em 1.5em; margin: 1em 0; border-radius: 4px; border-left: 4px solid; }
  .custom-container .container-title { font-weight: 600; margin-bottom: 0.5em; }
  .custom-container.warning { background: rgba(255, 193, 7, 0.1); border-left-color: #ffc107; color: #d4a017; }
  .custom-container.tip { background: rgba(40, 167, 69, 0.1); border-left-color: #28a745; color: #3cb371; }
  .custom-container.info { background: rgba(14, 99, 156, 0.1); border-left-color: #0e639c; color: #569cd6; }
  .custom-container.danger { background: rgba(220, 53, 69, 0.1); border-left-color: #dc3545; color: #f44747; }
  .footnote-ref { font-size: 0.85em; vertical-align: super; }
  .footnotes { font-size: 0.9em; color: #888; margin-top: 2em; padding-top: 1em; border-top: 1px solid #333; }
  .footnote-item p { margin: 0.3em 0; }
  .task-list-item { list-style: none; }
  .task-list-item input[type='checkbox'] { margin-right: 0.5em; }
  .task-list-item.is-checked { color: #888; }
  .task-list-item.is-checked .task-list-item-label { text-decoration: line-through; }
  .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; padding: 0.5em 0; }
`

ipcMain.handle('export-html', async (_event, content: string, filePath?: string) => {
  if (!win) return false
  const renderedHtml = renderMarkdownToHtml(content)
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Export</title>
<style>${darkThemeStyles}</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
</head>
<body>
${renderedHtml}
</body>
</html>`

  let targetPath = filePath
  if (!targetPath) {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'HTML Files', extensions: ['html'] }],
      defaultPath: 'export.html'
    })
    if (result.canceled || !result.filePath) return false
    targetPath = result.filePath
  }

  writeFileSync(targetPath, fullHtml, 'utf-8')
  return true
})

ipcMain.handle('export-pdf', async (_event, content: string, filePath?: string) => {
  if (!win) return false
  const renderedHtml = renderMarkdownToHtml(content)
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Export PDF</title>
<style>${darkThemeStyles}</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
</head>
<body>
${renderedHtml}
</body>
</html>`

  let targetPath = filePath
  if (!targetPath) {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      defaultPath: 'export.pdf'
    })
    if (result.canceled || !result.filePath) return false
    targetPath = result.filePath
  }

  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  pdfWin.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml)
  )

  await new Promise<void>((resolve) => {
    pdfWin.webContents.once('did-finish-load', () => resolve())
  })

  await new Promise<void>((resolve, reject) => {
    pdfWin.webContents.print(
      {
        printBackground: true,
        margin: { marginType: 'default' }
      },
      (success, errorType) => {
        pdfWin.close()
        if (success) {
          resolve()
        } else {
          reject(new Error(`PDF print failed: ${errorType}`))
        }
      }
    )
  })

  return true
})

function renderMarkdownToHtml(content: string): string {
  const MarkdownIt = require('markdown-it')
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true
  })
  return md.render(content)
}

ipcMain.handle('window-minimize', () => {
  if (win) {
    win.minimize()
  }
})

ipcMain.handle('window-maximize', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (win) {
    win.close()
  }
})

ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url)
    return true
  } catch (err) {
    console.error('[Shell] Failed to open external:', url, err)
    return false
  }
})

ipcMain.handle('show-item-in-folder', async (_event, basePath: string, relPath: string) => {
  try {
    const fullPath = resolve(basePath, relPath)
    console.log('[Shell] showItemInFolder:', fullPath)
    shell.showItemInFolder(fullPath)
    return true
  } catch (err) {
    console.error('[Shell] Failed to show item in folder:', basePath, relPath, err)
    return false
  }
})

ipcMain.handle('save-folders', (_event, folders: { path: string; name: string; collapsed: boolean }[]) => {
  if (!store) return false
  try {
    store.set('folders', folders)
    return true
  } catch (err) {
    console.error('[Main] save-folders failed:', err)
    return false
  }
})

ipcMain.handle('load-folders', () => {
  if (!store) return []
  return store.get('folders', [])
})

ipcMain.handle('show-save-confirm-dialog', async (_event, fileName: string) => {
  if (!win) return 'cancel'
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['保存', '不保存', '取消'],
    defaultId: 0,
    cancelId: 2,
    title: '未保存的更改',
    message: `是否保存对 "${fileName}" 的更改？`,
    detail: '如果不保存，您的更改将丢失。'
  })
  // 0 = 保存, 1 = 不保存, 2 = 取消
  const actions = ['save', 'dontSave', 'cancel']
  return actions[result.response]
})

// 图片保存模式：assets（./assets）| filename-assets（./文件名.assets）| custom（指定路径）| base64（不保存文件）
interface SaveImageArgs {
  docPath?: string
  fileName: string
  data: ArrayBuffer
  mode: 'assets' | 'filename-assets' | 'custom'
  customPath?: string
}

// 解析路径中的占位符：${filename}、${date}、${datetime}、${YYYY}、${MM}、${DD}
function resolvePathPlaceholders(inputPath: string, docPath?: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const datetimeStr = `${dateStr} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

  let result = inputPath

  // ${filename} - 当前文档文件名（不含扩展名）
  if (result.includes('${filename}')) {
    let filename = 'untitled'
    if (docPath) {
      filename = basename(docPath, extname(docPath))
    }
    result = result.replace(/\$\{filename\}/g, filename)
  }

  // 日期占位符
  result = result
    .replace(/\$\{YYYY\}/g, String(now.getFullYear()))
    .replace(/\$\{MM\}/g, pad(now.getMonth() + 1))
    .replace(/\$\{DD\}/g, pad(now.getDate()))
    .replace(/\$\{date\}/g, dateStr)
    .replace(/\$\{datetime\}/g, datetimeStr)

  return result
}

ipcMain.handle('save-image', async (_event, args: SaveImageArgs) => {
  try {
    const { docPath, fileName, data, mode, customPath } = args

    // 确定目标目录
    let targetDir: string
    if (mode === 'custom') {
      if (!customPath) return null
      // 解析占位符
      const resolvedCustomPath = resolvePathPlaceholders(customPath, docPath)
      console.log('[Image] Custom path:', customPath)
      console.log('[Image] Resolved path:', resolvedCustomPath)
      if (isAbsolute(resolvedCustomPath)) {
        targetDir = resolvedCustomPath
      } else {
        // 相对路径（如 ./images、../assets）以当前文档目录为起点解析
        if (!docPath) return null
        targetDir = resolve(dirname(docPath), resolvedCustomPath)
      }
      console.log('[Image] Target dir:', targetDir)
    } else {
      // 相对目录模式必须依赖已保存的文档路径
      if (!docPath) return null
      const docDir = dirname(docPath)
      const docName = basename(docPath, extname(docPath))
      const folderName = mode === 'filename-assets' ? `${docName}.assets` : 'assets'
      targetDir = join(docDir, folderName)
    }

    // 确保目录存在
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    // 文件名去重
    const ext = extname(fileName) || '.png'
    const nameBase = basename(fileName, ext)
    let finalName = fileName
    let counter = 1
    while (existsSync(join(targetDir, finalName))) {
      finalName = `${nameBase}-${counter}${ext}`
      counter++
    }

    const fullPath = join(targetDir, finalName)
    writeFileSync(fullPath, Buffer.from(data))
    console.log('[Image] Saved:', fullPath)

    // 计算插入 markdown 的路径
    let insertPath: string
    if (docPath) {
      // 优先使用相对路径
      let rel = relative(dirname(docPath), fullPath).replace(/\\/g, '/')
      if (/^[a-zA-Z]:\//.test(rel)) {
        // 跨盘符，relative 返回绝对路径
        insertPath = rel
      } else {
        if (!rel.startsWith('.')) rel = './' + rel
        insertPath = rel
      }
    } else {
      // 未保存文档 + custom 模式：使用绝对路径
      insertPath = fullPath.replace(/\\/g, '/')
    }

    // 将空格编码为 %20，避免破坏 markdown 图片语法解析
    insertPath = insertPath.replace(/ /g, '%20')

    return { savedPath: fullPath, insertPath }
  } catch (err) {
    console.error('[Image] Failed to save image:', err)
    return null
  }
})