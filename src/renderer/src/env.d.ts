declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

interface Window {
  electronAPI: {
    getConfig: () => Promise<Record<string, unknown>>
    setConfig: (key: string, value: unknown) => Promise<boolean>
    newFile: () => Promise<void>
    openFile: () => Promise<{ path: string; content: string } | null>
    openFolder: () => Promise<string | null>
    listFolder: (path: string) => Promise<FileNode[]>
    saveFile: (path: string, content: string) => Promise<boolean>
    saveFileAs: (content: string) => Promise<string | null>
    getRecentFiles: () => Promise<Array<{ path: string; title: string }>>
    addToRecentFiles: (path: string, title: string) => Promise<boolean>
    clearRecentFiles: () => Promise<boolean>
    readFile: (path: string) => Promise<{ path: string; content: string } | null>
    exportHtml: (content: string, filePath?: string) => Promise<boolean>
    exportPdf: (content: string, filePath?: string) => Promise<boolean>
    windowMinimize: () => Promise<void>
    windowMaximize: () => Promise<void>
    windowClose: () => Promise<void>
    showItemInFolder: (basePath: string, relPath: string) => Promise<boolean>
    saveFolders: (folders: { path: string; name: string; collapsed: boolean }[]) => Promise<boolean>
    loadFolders: () => Promise<{ path: string; name: string; collapsed: boolean }[]>
  }
}