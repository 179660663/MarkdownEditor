import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (key: string, value: unknown) =>
    ipcRenderer.invoke('set-config', key, value),
  newFile: () => ipcRenderer.invoke('new-file'),
  openFile: () => ipcRenderer.invoke('open-file'),
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
  windowClose: () => ipcRenderer.invoke('window-close')
})