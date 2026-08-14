declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    getConfig: () => Promise<Record<string, unknown>>
    setConfig: (key: string, value: unknown) => Promise<boolean>
    newFile: () => Promise<void>
    openFile: () => Promise<{ path: string; content: string } | null>
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
  }
}