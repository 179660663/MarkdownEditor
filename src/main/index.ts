import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, relative, basename, extname, resolve } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import Store from 'electron-store'

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
      sandbox: false
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

app.whenReady().then(() => {
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
  const content = readFileSync(filePath, 'utf-8')
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

ipcMain.handle('add-to-recent-files', (_event, path: string, title: string) => {
  if (!store) return false
  const recentFiles = store.get('recentFiles', []) as RecentFile[]
  const filtered = recentFiles.filter((f) => f.path !== path)
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
  const content = readFileSync(filePath, 'utf-8')
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