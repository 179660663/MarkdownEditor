import { contextBridge, ipcRenderer } from 'electron'

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    setConfig: (key: string, value: unknown) =>
      ipcRenderer.invoke('set-config', key, value),
    newFile: () => ipcRenderer.invoke('new-file'),
    openFile: () => ipcRenderer.invoke('open-file'),
    openFolder: () => ipcRenderer.invoke('open-folder'),
    listFolder: (path: string) => ipcRenderer.invoke('list-folder', path),
    saveFile: (path: string, content: string) =>
      ipcRenderer.invoke('save-file', path, content),
    saveFileAs: (content: string) => ipcRenderer.invoke('save-file-as', content),
    getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
    addToRecentFiles: (path: string, title: string) =>
      ipcRenderer.invoke('add-to-recent-files', path, title),
    clearRecentFiles: () => ipcRenderer.invoke('clear-recent-files'),
    readFile: (path: string) => ipcRenderer.invoke('read-file', path),
    exportHtml: (content: string, filePath?: string) =>
      ipcRenderer.invoke('export-html', content, filePath),
    exportPdf: (content: string, filePath?: string) =>
      ipcRenderer.invoke('export-pdf', content, filePath),
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    showItemInFolder: (basePath: string, relPath: string) => ipcRenderer.invoke('show-item-in-folder', basePath, relPath),
    saveFolders: (folders: { path: string; name: string; collapsed: boolean }[]) =>
      ipcRenderer.invoke('save-folders', folders),
    loadFolders: () => ipcRenderer.invoke('load-folders'),
    showSaveConfirmDialog: (fileName: string) => ipcRenderer.invoke('show-save-confirm-dialog', fileName),
    saveImage: (args: {
      docPath?: string
      fileName: string
      data: ArrayBuffer
      mode: 'assets' | 'filename-assets' | 'custom'
      customPath?: string
    }) => ipcRenderer.invoke('save-image', args)
  })
  console.log('[Preload] electronAPI exposed successfully')
} catch (err) {
  console.error('[Preload] Failed to expose electronAPI:', err)
}