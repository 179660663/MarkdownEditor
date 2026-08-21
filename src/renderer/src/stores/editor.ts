import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

interface Doc {
  id: string
  title: string
  content: string
  updatedAt: number
  filePath?: string
  mode: 'edit' | 'preview'
  originalContent?: string // 保存时的原始内容，用于判断是否真的修改了
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
    const contentCopy = String(content)
    documents.value.push({
      id,
      title,
      content: contentCopy,
      updatedAt: Date.now(),
      filePath,
      mode,
      originalContent: filePath ? contentCopy.slice() : undefined // 有文件路径的文档，记录原始内容副本
    })
    return id
  }

  function normalizePath(filePath: string): string {
    // 统一路径格式：转换为小写（Windows）并使用正斜杠
    return filePath.toLowerCase().replace(/\\/g, '/')
  }

  function getDocumentByPath(filePath: string): Doc | undefined {
    const normalizedTarget = normalizePath(filePath)
    return documents.value.find((d) => d.filePath && normalizePath(d.filePath) === normalizedTarget)
  }

  function getDocument(id: string): Doc | undefined {
    return documents.value.find((d) => d.id === id)
  }

  function isDocumentDirty(id: string): boolean {
    const tab = tabs.value.find((t) => t.id === id)
    return tab?.isDirty ?? false
  }

  function getDirtyDocuments(): Doc[] {
    const dirtyTabIds = tabs.value.filter((t) => t.isDirty).map((t) => t.id)
    return documents.value.filter((d) => dirtyTabIds.includes(d.id))
  }

  function updateDocument(id: string, content: string) {
    const doc = documents.value.find((d) => d.id === id)
    if (doc) {
      const contentStr = String(content)
      // 检查内容是否真的变化了
      const hasChanged = doc.content !== contentStr
      if (!hasChanged) {
        return
      }
      doc.content = contentStr
      doc.updatedAt = Date.now()
      if (!doc.filePath && contentStr.trim()) {
        doc.title = contentStr.split('\n')[0].replace(/^#+\s*/, '').slice(0, 50) || '无标题文档'
      }
      // 使用 originalContent 判断是否真的修改了（与保存时的内容比较）
      if (doc.filePath) {
        const isActuallyDirty = doc.originalContent !== undefined && doc.originalContent !== contentStr
        const shouldBeDirty = doc.originalContent === undefined || isActuallyDirty
        console.log('[updateDocument] Doc:', doc.title, 'dirty:', shouldBeDirty, 'originalLen:', doc.originalContent?.length, 'currentLen:', contentStr.length)
        isDirty.value = shouldBeDirty
        updateTabDirty(id, shouldBeDirty)
        updateTabTitle(id, doc.title)
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
    console.log('[closeTab] Closing tab:', id, 'index:', index, 'activeTab:', activeTabId.value)
    if (index === -1) return

    tabs.value.splice(index, 1)
    deleteDocument(id)

    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        const nextIndex = Math.min(index, tabs.value.length - 1)
        const nextId = tabs.value[nextIndex].id
        console.log('[closeTab] Auto-switching to tab:', nextId)
        // 使用 setActiveTab 来正确设置状态（包括 isLoading）
        setActiveTab(nextId)
      } else {
        activeTabId.value = null
        currentFilePath.value = null
        isDirty.value = false
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
    activeTabId.value = id
    const doc = getDocument(id)
    if (doc) {
      currentFilePath.value = doc.filePath || null
      // 根据 originalContent 判断 dirty 状态
      if (!doc.filePath) {
        isDirty.value = true
        updateTabDirty(id, true)
      } else {
        const isActuallyDirty = doc.originalContent !== undefined && doc.originalContent !== doc.content
        isDirty.value = isActuallyDirty
        updateTabDirty(id, isActuallyDirty)
      }
    }
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
          // 更新文档的文件路径和原始内容
          const doc = documents.value.find((d) => d.id === activeTabId.value)
          if (doc) {
            doc.filePath = currentFilePath.value
            doc.originalContent = String(content) // 保存后更新原始内容副本
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
        // 更新文档的文件路径和原始内容
        const doc = documents.value.find((d) => d.id === activeTabId.value)
        if (doc) {
          doc.filePath = path
          doc.originalContent = String(content) // 保存后更新原始内容副本
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
    const newFolder: FolderEntry = {
      id,
      path: folderPath,
      name,
      tree,
      expanded: new Set(),
      collapsed: false
    }
    const newList = [...folders.value, newFolder]
    folders.value = newList
    activeFolderId.value = id
    persistFolders()
    return folderPath
  }

  function setActiveFolder(id: string) {
    activeFolderId.value = id
  }

  function removeFolder(id: string) {
    const idx = folders.value.findIndex((f) => f.id === id)
    if (idx === -1) return
    const newList = folders.value.filter((f) => f.id !== id)
    folders.value = newList
    if (activeFolderId.value === id) {
      activeFolderId.value = newList.length > 0 ? newList[0].id : null
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

  function expandFolderNode(folderId: string, path: string) {
    const idx = folders.value.findIndex((f) => f.id === folderId)
    if (idx === -1) return
    const folder = folders.value[idx]
    const newSet = new Set(folder.expanded)
    newSet.add(path)
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
    const updated: FolderEntry = { ...folder, collapsed: false, expanded: new Set(allPaths) }
    folders.value.splice(idx, 1, updated)
  }

  function collapseAllFolderNodes(folderId: string) {
    const idx = folders.value.findIndex((f) => f.id === folderId)
    if (idx === -1) return
    const folder = folders.value[idx]
    const updated: FolderEntry = { ...folder, collapsed: true, expanded: new Set() }
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
      const restored: FolderEntry[] = [...folders.value]
      for (const savedFolder of saved) {
        if (!savedFolder.path) continue
        if (restored.some((f) => f.path === savedFolder.path)) continue
        try {
          const tree = await window.electronAPI.listFolder(savedFolder.path)
          const id = 'folder-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
          restored.push({
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
      folders.value = restored
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

  // 防止文件夹树刷新乱序覆盖（快速来回切换时，旧请求结果可能晚于新请求返回）
  const reloadSeq = new Map<string, number>()

  async function reloadFolderTree(folderId: string) {
    const folder = folders.value.find((f) => f.id === folderId)
    if (!folder) return
    const seq = (reloadSeq.get(folderId) || 0) + 1
    reloadSeq.set(folderId, seq)
    try {
      const tree = await window.electronAPI.listFolder(folder.path)
      // 如果已有更新的刷新请求，则丢弃本次过期结果
      if (reloadSeq.get(folderId) !== seq) return
      const idx = folders.value.findIndex((f) => f.id === folderId)
      if (idx !== -1) {
        const current = folders.value[idx]
        // 保留仍然存在的目录的展开状态
        const allDirPaths = collectAllDirPaths(tree)
        const preservedExpanded = new Set([...current.expanded].filter((p) => allDirPaths.includes(p)))
        const updated: FolderEntry = { ...current, tree, expanded: preservedExpanded }
        folders.value.splice(idx, 1, updated)
      }
    } catch (err) {
      console.error('[Store] Failed to reload folder tree:', folderId, err)
    }
  }

  // 文件或文件夹重命名后，同步更新已打开文档中的路径和标题
  function updateDocPathsAfterRename(oldPath: string, newPath: string) {
    const oldNorm = normalizePath(oldPath)
    const oldPrefix = oldNorm.endsWith('/') ? oldNorm : oldNorm + '/'
    const newBase = newPath.replace(/[\\/]+$/, '')

    for (const doc of documents.value) {
      if (!doc.filePath) continue
      const p = normalizePath(doc.filePath)
      if (p === oldNorm) {
        doc.filePath = newPath
        const newName = getFileName(newPath)
        if (newName !== doc.title) {
          doc.title = newName
          updateTabTitle(doc.id, newName)
        }
      } else if (p.startsWith(oldPrefix)) {
        doc.filePath = newBase + doc.filePath.slice(oldPath.length)
      }
    }

    if (currentFilePath.value) {
      const p = normalizePath(currentFilePath.value)
      if (p === oldNorm) {
        currentFilePath.value = newPath
      } else if (p.startsWith(oldPrefix)) {
        currentFilePath.value = newBase + currentFilePath.value.slice(oldPath.length)
      }
    }
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
    getDocumentByPath,
    getDocument,
    isDocumentDirty,
    getDirtyDocuments,
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
    expandFolderNode,
    expandAllFolderNodes,
    collapseAllFolderNodes,
    getFolderExpanded,
    getFolderById,
    listFolderContents,
    clearFolder,
    clearAllFolders,
    restoreFolders,
    setFolderCollapsed,
    reloadFolderTree,
    updateDocPathsAfterRename,
    getFullPath
  }
})