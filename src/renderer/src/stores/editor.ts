import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

interface Doc {
  id: string
  title: string
  content: string
  updatedAt: number
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

export const useEditorStore = defineStore('editor', () => {
  const documents = ref<Doc[]>([])
  const currentFilePath = ref<string | null>(null)
  const recentFiles = ref<RecentFile[]>([])
  const isDirty = ref(false)

  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  function getFileName(filePath: string): string {
    return filePath.split(/[\\/]/).pop() || filePath
  }

  function addDocument(title: string, content: string): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    documents.value.push({
      id,
      title,
      content,
      updatedAt: Date.now()
    })
    return id
  }

  function getDocument(id: string): Doc | undefined {
    return documents.value.find((d) => d.id === id)
  }

  function updateDocument(id: string, content: string) {
    const doc = documents.value.find((d) => d.id === id)
    if (doc) {
      doc.content = content
      doc.updatedAt = Date.now()
      if (content.trim()) {
        doc.title = content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 50) || '无标题文档'
      }
      isDirty.value = true
      updateTabDirty(id, true)
      updateTabTitle(id, doc.title)
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
    activeTabId.value = id
    const doc = getDocument(id)
    if (doc) {
      currentFilePath.value = null
      isDirty.value = false
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
      currentFilePath.value = result.path
      isDirty.value = false
      await addRecentFile(result.path, getFileName(result.path))
    }
    return result
  }

  async function openFilePath(path: string): Promise<{ path: string; content: string } | null> {
    const result = await window.electronAPI.readFile(path)
    if (result) {
      currentFilePath.value = result.path
      isDirty.value = false
      await addRecentFile(result.path, getFileName(result.path))
    }
    return result
  }

  async function saveFileAction(content: string): Promise<boolean> {
    if (currentFilePath.value) {
      const ok = await window.electronAPI.saveFile(currentFilePath.value, content)
      if (ok) {
        isDirty.value = false
        if (activeTabId.value) {
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

  return {
    documents,
    currentFilePath,
    recentFiles,
    isDirty,
    tabs,
    activeTabId,
    addDocument,
    getDocument,
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
    markTabClean,
    openFileDialog,
    openFilePath,
    saveFileAction,
    saveFileAsAction,
    newDocument,
    loadRecentFiles,
    addRecentFile,
    clearRecentFilesAction
  }
})