import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

interface Doc {
  id: string
  title: string
  content: string
  updatedAt: number
  filePath?: string
  mode: 'edit' | 'preview'
}

interface RecentFile {
  path: string
  title: string
}

interface Tab {
  id: string
  title: string
  isDirty: boolean
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

interface FolderEntry {
  id: string
  path: string
  name: string
  tree: FileNode[]
  expanded: Set<string>
  collapsed: boolean
}

export const useEditorStore = defineStore('editor', () => {
  const documents = ref<Doc[]>([])
  const currentFilePath = ref<string | null>(null)
  const recentFiles = ref<RecentFile[]>([])
  const isDirty = ref(false)
  const isLoading = ref(false)

  const folders = ref<FolderEntry[]>([])
  const activeFolderId = ref<string | null>(null)

  const currentFolder = computed(() => {
    const active = folders.value.find((f) => f.id === activeFolderId.value)
    return active ? active.path : null
  })

  const folderTree = computed<FileNode[]>(() => {
    const active = folders.value.find((f) => f.id === activeFolderId.value)
    return active ? active.tree : []
  })

  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  function getFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || filePath
  }

  function addDocument(title: string, content: string, filePath?: string, mode: 'edit' | 'preview' = 'edit'): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    documents.value.push({
      id,
      title,
      content,
      updatedAt: Date.now(),
      filePath,
      mode
    })
    return id
  }

  function getDocumentByPath(filePath: string): Doc | undefined {
    return documents.value.find((d) => d.filePath === filePath)
  }

  function getDocument(id: string): Doc | undefined {
    return documents.value.find((d) => d.id === id)
  }

  function updateDocument(id: string, content: string) {
    const doc = documents.value.find((d) => d.id === id)
    if (doc) {
      doc.content = content
      doc.updatedAt = Date.now()
      if (!doc.filePath && content.trim()) {
        doc.title = content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 50) || '无标题文档'
      }
      if (!isLoading.value) {
        if (doc.filePath) {
          isDirty.value = true
          updateTabDirty(id, true)
          updateTabTitle(id, doc.title)
        }
      }
    }
  }

  function deleteDocument(id: string) {
    const index = documents.value.findIndex((d) => d.id === id)
    if (index !== -1) {
      documents.value.splice(index, 1)
    }
  }

  function addTab(docId: string, title: string) {
    const existing = tabs.value.find((t) => t.id === docId)
    if (existing) {
      existing.title = title
      return
    }
    tabs.value.push({ id: docId, title, isDirty: false })
    if (!activeTabId.value) {
      activeTabId.value = docId
    }
  }

  function closeTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index === -1) return

    tabs.value.splice(index, 1)
    deleteDocument(id)

    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        const nextIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[nextIndex].id
      } else {
        activeTabId.value = null
      }
    }
  }

  function closeOtherTabs(id: string) {
    tabs.value = tabs.value.filter((t) => t.id === id)
    activeTabId.value = id
  }

  function closeAllTabs() {
    for (const tab of [...tabs.value]) {
      deleteDocument(tab.id)
    }
    tabs.value = []
    activeTabId.value = null
    currentFilePath.value = null
    isDirty.value = false
  }

  function setActiveTab(id: string) {
    isLoading.value = true
    activeTabId.value = id
    const doc = getDocument(id)
    if (doc) {
      currentFilePath.value = doc.filePath || null
      if (!doc.filePath) {
        isDirty.value = true
        updateTabDirty(id, true)
      } else {
        isDirty.value = false
        updateTabDirty(id, false)
      }
    }
    setTimeout(() => {
      isLoading.value = false
    }, 300)
  }

  function moveTab(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= tabs.value.length) return
    if (toIndex < 0 || toIndex >= tabs.value.length) return
    const [removed] = tabs.value.splice(fromIndex, 1)
    tabs.value.splice(toIndex, 0, removed)
  }

  function updateTabTitle(id: string, title: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.title = title
    }
  }

  function updateTabDirty(id: string, dirty: boolean) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      tab.isDirty = dirty
    }
  }

  function setDocMode(id: string, mode: 'edit' | 'preview') {
    const doc = documents.value.find((d) => d.id === id)
    if (doc) {
      doc.mode = mode
    }
  }

  function markTabClean(id: string) {
    updateTabDirty(id, false)
    const doc = getDocument(id)
    if (doc) {
      updateTabTitle(id, doc.title)
    }
  }

  async function openFileDialog(): Promise<{ path: string; content: string } | null> {
    const result = await window.electronAPI.openFile()
    if (result) {
      isLoading.value = true
      currentFilePath.value = result.path
      isDirty.value = false
      const fileName = getFileName(result.path)
      await addRecentFile(result.path, fileName)
      setTimeout(() => {
        isLoading.value = false
      }, 300)
    }
    return result
  }

  async function openFilePath(path: string): Promise<{ path: string; content: string } | null> {
    const result = await window.electronAPI.readFile(path)
    if (result) {
      isLoading.value = true
      currentFilePath.value = result.path
      isDirty.value = false
      const fileName = getFileName(result.path)
      await addRecentFile(result.path, fileName)
      setTimeout(() => {
        isLoading.value = false
      }, 300)
    }
    return result
  }

  async function saveFileAction(content: string): Promise<boolean> {
    if (currentFilePath.value) {
      const ok = await window.electronAPI.saveFile(currentFilePath.value, content)
      if (ok) {
        isDirty.value = false
        if (activeTabId.value) {
          // 更新文档的文件路径
          const doc = documents.value.find((d) => d.id === activeTabId.value)
          if (doc) {
            doc.filePath = currentFilePath.value
          }
          markTabClean(activeTabId.value)
        }
      }
      return ok
    }
    return saveFileAsAction(content)
  }

  async function saveFileAsAction(content: string): Promise<boolean> {
    const path = await window.electronAPI.saveFileAs(content)
    if (path) {
      currentFilePath.value = path
      isDirty.value = false
      if (activeTabId.value) {
        // 更新文档的文件路径
        const doc = documents.value.find((d) => d.id === activeTabId.value)
        if (doc) {
          doc.filePath = path
        }
        markTabClean(activeTabId.value)
      }
      await addRecentFile(path, getFileName(path))
      return true
    }
    return false
  }

  function newDocument() {
    currentFilePath.value = null
    isDirty.value = false
  }

  async function loadRecentFiles() {
    const files = await window.electronAPI.getRecentFiles()
    recentFiles.value = files as RecentFile[]
  }

  async function addRecentFile(path: string, title: string) {
    await window.electronAPI.addToRecentFiles(path, title)
    await loadRecentFiles()
  }

  async function clearRecentFilesAction() {
    await window.electronAPI.clearRecentFiles()
    recentFiles.value = []
  }

  async function openFolderDialog(): Promise<string | null> {
    const result = await window.electronAPI.openFolder()
    if (result) {
      return await addFolder(result)
    }
    return null
  }

  async function addFolder(folderPath: string): Promise<string | null> {
    const existing = folders.value.find((f) => f.path === folderPath)
    if (existing) {
      activeFolderId.value = existing.id
      return existing.path
    }
    const tree = await window.electronAPI.listFolder(folderPath)
    const id = 'folder-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const name = getFileName(folderPath)
    folders.value.push({
      id,
      path: folderPath,
      name,
      tree,
      expanded: new Set(),
      collapsed: false
    })
    activeFolderId.value = id
    persistFolders()
    return folderPath
  }

  function setActiveFolder(id: string) {
    activeFolderId.value = id
  }

  function removeFolder(id: string) {
    const index = folders.value.findIndex((f) => f.id === id)
    if (index === -1) return
    folders.value.splice(index, 1)
    if (activeFolderId.value === id) {
      activeFolderId.value = folders.value.length > 0 ? folders.value[0].id : null
    }
    persistFolders()
  }

  function setFolderCollapsed(folderId: string, collapsed: boolean) {
    const idx = folders.value.findIndex((f) => f.id === folderId)
    if (idx === -1) return
    const current = folders.value[idx]
    const updated: FolderEntry = { ...current, collapsed }
    folders.value.splice(idx, 1, updated)
    persistFolders()
  }

  function toggleFolderNode(folderId: string, path: string) {
    const idx = folders.value.findIndex((f) => f.id === folderId)
    if (idx === -1) return
    const folder = folders.value[idx]
    const newSet = new Set(folder.expanded)
    if (newSet.has(path)) {
      newSet.delete(path)
    } else {
      newSet.add(path)
    }
    const updated: FolderEntry = { ...folder, expanded: newSet }
    folders.value.splice(idx, 1, updated)
  }

  function collectAllDirPaths(nodes: FileNode[]): string[] {
    const paths: string[] = []
    for (const node of nodes) {
      if (node.isDirectory) {
        paths.push(node.path)
        if (node.children) {
          paths.push(...collectAllDirPaths(node.children))
        }
      }
    }
    return paths
  }

  function expandAllFolderNodes(folderId: string) {
    const idx = folders.value.findIndex((f) => f.id === folderId)
    if (idx === -1) return
    const folder = folders.value[idx]
    const allPaths = collectAllDirPaths(folder.tree)
    const updated: FolderEntry = { ...folder, expanded: new Set(allPaths) }
    folders.value.splice(idx, 1, updated)
  }

  function collapseAllFolderNodes(folderId: string) {
    const idx = folders.value.findIndex((f) => f.id === folderId)
    if (idx === -1) return
    const folder = folders.value[idx]
    const updated: FolderEntry = { ...folder, expanded: new Set() }
    folders.value.splice(idx, 1, updated)
  }

  function getFolderExpanded(folderId: string): Set<string> {
    const folder = folders.value.find((f) => f.id === folderId)
    return folder ? folder.expanded : new Set()
  }

  function getFolderById(id: string): FolderEntry | undefined {
    return folders.value.find((f) => f.id === id)
  }

  function listFolderContents() {
    // kept for backward compat, now a no-op since tree is built on add
  }

  function clearFolder() {
    if (activeFolderId.value) {
      removeFolder(activeFolderId.value)
    }
  }

  function clearAllFolders() {
    folders.value = []
    activeFolderId.value = null
    persistFolders()
  }

  async function restoreFolders(): Promise<void> {
    try {
      const saved = await window.electronAPI.loadFolders()
      if (!saved || saved.length === 0) return
      for (const savedFolder of saved) {
        if (!savedFolder.path) continue
        try {
          const tree = await window.electronAPI.listFolder(savedFolder.path)
          const id = 'folder-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
          folders.value.push({
            id,
            path: savedFolder.path,
            name: savedFolder.name || getFileName(savedFolder.path),
            tree,
            expanded: new Set(),
            collapsed: savedFolder.collapsed || false
          })
        } catch (err) {
          console.warn('[Store] Failed to restore folder:', savedFolder.path, err)
        }
      }
      if (folders.value.length > 0) {
        activeFolderId.value = folders.value[0].id
      }
    } catch (err) {
      console.error('[Store] Failed to restore folders:', err)
    }
  }

  function persistFolders() {
    const data = folders.value.map((f) => ({
      path: f.path,
      name: f.name,
      collapsed: f.collapsed
    }))
    window.electronAPI.saveFolders(data).catch((err) => {
      console.error('[Store] Failed to persist folders:', err)
    })
  }

  function getFullPath(relPath: string, folderId?: string): string {
    const fid = folderId || activeFolderId.value
    const folder = folders.value.find((f) => f.id === fid)
    if (!folder) return relPath
    const basePath = folder.path.replace(/[\\/]+$/, '')
    const file = relPath.replace(/^[\\/]+/, '')
    return basePath + '/' + file
  }

  return {
    documents,
    currentFilePath,
    recentFiles,
    isDirty,
    tabs,
    activeTabId,
    folders,
    activeFolderId,
    currentFolder,
    folderTree,
    addDocument,
    getDocument,
    getDocumentByPath,
    updateDocument,
    deleteDocument,
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTab,
    moveTab,
    updateTabTitle,
    updateTabDirty,
    setDocMode,
    markTabClean,
    openFileDialog,
    openFilePath,
    saveFileAction,
    saveFileAsAction,
    newDocument,
    loadRecentFiles,
    addRecentFile,
    clearRecentFilesAction,
    openFolderDialog,
    addFolder,
    setActiveFolder,
    removeFolder,
    toggleFolderNode,
    expandAllFolderNodes,
    collapseAllFolderNodes,
    getFolderExpanded,
    getFolderById,
    listFolderContents,
    clearFolder,
    clearAllFolders,
    restoreFolders,
    setFolderCollapsed,
    getFullPath
  }
})