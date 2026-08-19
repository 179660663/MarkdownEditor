<template>
  <div v-if="appError" class="error-boundary">
    <div class="error-box">
      <h2>应用程序出错了</h2>
      <p class="error-message">{{ appError }}</p>
      <button class="error-retry-btn" @click="retryApp">重新加载</button>
    </div>
  </div>
  <div v-else-if="isLoading" class="app-loading">
    <div class="loading-spinner"></div>
    <div class="loading-text">正在初始化编辑器...</div>
  </div>
  <div v-else class="app-container">
    <header class="titlebar">
      <span class="title">📝 Markdown Editor</span>
      <div class="menu-bar">
        <div
          class="menu-item"
          @mouseenter="openMenu('file')"
          @mouseleave="closeMenu"
          @click="toggleMenu('file')"
        >
          文件
          <span class="menu-arrow">▾</span>
        </div>
        <div
          v-if="activeMenu === 'file'"
          class="dropdown-menu"
          @mouseenter="openMenu('file')"
          @mouseleave="closeMenu"
        >
          <div class="dropdown-item" @click="handleNew(); closeMenu()">
            <span class="dropdown-icon">📄</span> 新建文档
            <span class="shortcut">Ctrl+N</span>
          </div>
          <div class="dropdown-item" @click="handleOpen(); closeMenu()">
            <span class="dropdown-icon">📃</span> 打开文件
            <span class="shortcut">Ctrl+O</span>
          </div>
          <div class="dropdown-item" @click="handleOpenFolder(); closeMenu()">
            <span class="dropdown-icon">📁</span> 打开文件夹
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" @click="handleSave(); closeMenu()">
            <span class="dropdown-icon">💾</span> 保存
            <span class="shortcut">Ctrl+S</span>
          </div>
          <div class="dropdown-item" @click="handleSaveAs(); closeMenu()">
            <span class="dropdown-icon">📋</span> 另存为
            <span class="shortcut">Ctrl+Shift+S</span>
          </div>
        </div>
      </div>
      <span class="file-path" v-if="store.currentFilePath">
        {{ store.currentFilePath }}
      </span>
      <span class="dirty-indicator" v-if="store.isDirty">●</span>
      <div class="titlebar-right">
        <ThemeSwitcher />
        <button
          class="win-btn"
          title="最小化"
          @click="handleMinimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect y="4.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          class="win-btn"
          title="最大化"
          @click="toggleMaximize"
        >
          <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" fill="none" />
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <rect x="2" y="0.5" width="7.5" height="7.5" stroke="currentColor" fill="none" />
            <rect x="0.5" y="2" width="7.5" height="7.5" stroke="currentColor" fill="var(--bg-secondary)" />
          </svg>
        </button>
        <button
          class="win-btn close"
          title="关闭"
          @click="handleClose"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.2" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
      </div>
    </header>

    <TabBar
      v-if="store.tabs.length > 0"
      :tabs="store.tabs"
      :active-id="store.activeTabId"
      @update:active-id="handleTabSwitch"
      @close-tab="handleTabClose"
      @new-tab="handleNew"
      @close-other-tabs="handleCloseOtherTabs"
      @close-all-tabs="handleCloseAllTabs"
      @move-tab="handleMoveTab"
    />

    <main class="editor-container">
      <aside
        class="sidebar"
        :class="{ collapsed: !showSidebar }"
        :style="showSidebar ? { width: sidebarWidth + 'px' } : {}"
      >
        <div v-if="!showSidebar" class="sidebar-toggle" @click="showSidebar = true" title="展开侧边栏">
          ⟩
        </div>
        <div v-else class="sidebar-content">
          <div class="sidebar-header">
            <button class="icon-btn" title="收起侧边栏" @click="showSidebar = false">⟨</button>
          </div>
          <button class="new-btn" @click="handleNew">新建文档</button>

          <div class="folder-section">
            <div class="section-header">
              <span>文件浏览</span>
              <div class="section-actions">
                <button class="icon-action-btn" title="展开全部" @click="handleExpandAll">⊞</button>
                <button class="icon-action-btn" title="折叠全部" @click="handleCollapseAll">⊟</button>
                <button class="icon-action-btn" title="添加文件夹" @click="handleOpenFolder">📁</button>
                <button
                  v-if="store.folders.length > 0"
                  class="icon-action-btn"
                  title="全部关闭"
                  @click="handleCloseAllFolders"
                >
                  ✕
                </button>
              </div>
            </div>
            <div v-if="store.folders.length === 0" class="empty-hint">
              <button class="folder-open-btn" @click="handleOpenFolder">📁 打开文件夹</button>
            </div>
            <div v-else class="folder-list">
              <div
                v-for="folder in store.folders"
                :key="folder.id"
                class="folder-item"
                :class="{ active: folder.id === store.activeFolderId }"
              >
                <div class="folder-item-header" @click="store.setActiveFolder(folder.id)" @contextmenu.prevent="handleFolderContextMenu($event, folder)">
                  <button
                    class="folder-item-toggle"
                    @click.stop="toggleFolderCollapsed(folder.id)"
                  >
                    {{ folder.collapsed ? '▸' : '▾' }}
                  </button>
                  <span
                    class="folder-item-name"
                    :title="folder.path"
                  >
                    📁 {{ folder.name }}
                  </span>
                  <span class="folder-item-path" :title="folder.path">{{ folder.path }}</span>
                  <button
                    class="folder-item-close"
                    title="移除此文件夹"
                    @click.stop="handleRemoveFolder(folder.id)"
                  >
                    ✕
                  </button>
                </div>
                <div
                  v-if="!folder.collapsed"
                  class="folder-item-body"
                >
                  <FolderTree
                    :nodes="folder.tree"
                    :expanded="folder.expanded"
                    :active-path="activeFolderPath"
                    :base-path="folder.path"
                    @select="(node) => handleFolderFileSelect(node, folder.id)"
                    @toggle="(path) => store.toggleFolderNode(folder.id, path)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="recent-section">
            <div class="section-header">
              <span>最近文件</span>
              <button
                v-if="store.recentFiles.length > 0"
                class="icon-action-btn"
                title="清空最近文件"
                @click="store.clearRecentFilesAction()"
              >
                🗑
              </button>
            </div>
            <div class="recent-list" v-if="store.recentFiles.length > 0">
              <div
                v-for="file in store.recentFiles"
                :key="file.path"
                class="recent-item"
                @click="handleOpenRecent(file.path)"
                :title="file.path"
              >
                <span class="recent-title">{{ file.title }}</span>
              </div>
            </div>
            <!-- <div class="empty-hint" v-else>暂无最近文件</div> -->
          </div>

          <div class="doc-list">
            <div class="section-header">
              <span>文档列表</span>
              <button
                v-if="documents.length > 0"
                class="icon-action-btn"
                title="关闭全部文档"
                @click="handleCloseAllDocuments"
              >
                ✕
              </button>
            </div>
            <div
              v-for="doc in documents"
              :key="doc.id"
              class="doc-item"
              :class="{ active: doc.id === store.activeTabId }"
              @click="handleSelect(doc.id)"
            >
              {{ doc.title }}
            </div>
          </div>
        </div>
      </aside>

      <div
        v-if="showSidebar"
        class="resize-handle resize-handle-right"
        @mousedown="startResize('sidebar', $event)"
      ></div>

      <section class="editor-main" :class="{ 'outline-left': outlinePosition === 'left' }">
        <div
          class="editor-area"
          :style="outlinePosition === 'left' ? 'order: 3' : 'order: 1'"
        >
          <TyporaEditor
            v-if="store.activeTabId"
            ref="editorRef"
            v-model="currentDoc.content"
            :editor-mode="currentTabMode"
            :file-path="currentDocFilePath"
            @save-requested="handleSave"
            @save-as-requested="handleSaveAs"
            @mode-change="handleModeChange"
            @scroll-line-change="handleScrollLineChange"
          />
          <EditorToolbar
            v-if="store.activeTabId"
            :editor-ref="editorRef"
          />
          <div v-else class="empty-editor">
            <p>选择或创建一个文档开始编辑</p>
          </div>
        </div>

        <div
          v-if="showOutline"
          class="resize-handle resize-handle-vertical"
          :style="outlinePosition === 'left' ? 'order: 2' : 'order: 2'"
          @mousedown="startResize('outline', $event)"
        ></div>

        <OutlineSidebar
          v-if="showOutline"
          ref="outlineRef"
          class="outline-sidebar"
          :class="{ 'outline-sidebar-left': outlinePosition === 'left' }"
          :style="`width: ${outlineWidth}px`"
          :content="currentDoc.content"
          :position="outlinePosition"
          @jump-to-heading="handleJumpToHeading"
          @close="showOutline = false"
        />
        <button
          v-if="!showOutline && store.activeTabId"
          class="outline-toggle"
          :class="{ 'outline-toggle-left': outlinePosition === 'left' }"
          title="显示大纲"
          @click="showOutline = true"
        >
          大纲
        </button>
        <button
          v-if="store.activeTabId"
          class="outline-position-toggle"
          :title="outlinePosition === 'left' ? '切换大纲到右侧' : '切换大纲到左侧'"
          @click="toggleOutlinePosition"
        >
          {{ outlinePosition === 'left' ? '→' : '←' }}
        </button>
      </section>
    </main>

    <StatusBar
      :content="currentDoc.content"
      :file-name="statusFileName"
      :is-dirty="store.isDirty"
    />

    <teleport to="body">
      <div
        v-if="folderContextMenu.visible"
        class="context-menu"
        :style="{ left: folderContextMenu.x + 'px', top: folderContextMenu.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="openFolderLocation">
          <span class="context-menu-icon">📂</span>
          <span>打开文件位置</span>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useEditorStore } from './stores/editor'
import { useThemeStore } from './stores/theme'
import TyporaEditor from './components/TyporaEditor.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import EditorToolbar from './components/EditorToolbar.vue'
import TabBar from './components/TabBar.vue'
import OutlineSidebar from './components/OutlineSidebar.vue'
import StatusBar from './components/StatusBar.vue'
import FolderTree from './components/FolderTree.vue'

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

const store = useEditorStore()
const themeStore = useThemeStore()

const editorRef = ref<InstanceType<typeof TyporaEditor> | null>(null)
const outlineRef = ref<InstanceType<typeof OutlineSidebar> | null>(null)
const showOutline = ref(true)
const showSidebar = ref(true)
const isMaximized = ref(false)
const isLoading = ref(true)
const appError = ref<string | null>(null)
const outlinePosition = ref<'left' | 'right'>('right')

const sidebarWidth = ref(240)
const outlineWidth = ref(220)

type DragTarget = 'sidebar' | 'outline' | null
const dragState = reactive<{ target: DragTarget; startX: number; startWidth: number }>({
  target: null,
  startX: 0,
  startWidth: 0
})

function startResize(target: DragTarget, e: MouseEvent) {
  e.preventDefault()
  dragState.target = target
  dragState.startX = e.clientX
  dragState.startWidth = target === 'sidebar' ? sidebarWidth.value : outlineWidth.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = target === 'sidebar' ? 'col-resize' : 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResize(e: MouseEvent) {
  if (!dragState.target) return
  const delta = e.clientX - dragState.startX
  if (dragState.target === 'sidebar') {
    const newWidth = Math.min(500, Math.max(180, dragState.startWidth + delta))
    sidebarWidth.value = newWidth
  } else if (dragState.target === 'outline') {
    let newWidth: number
    if (outlinePosition.value === 'right') {
      newWidth = Math.min(500, Math.max(150, dragState.startWidth - delta))
    } else {
      newWidth = Math.min(500, Math.max(150, dragState.startWidth + delta))
    }
    outlineWidth.value = newWidth
  }
}

function stopResize() {
  dragState.target = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

const activeFolderPath = ref<string | null>(null)

const activeMenu = ref<string | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | null = null

function openMenu(menu: string) {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (activeMenu.value !== menu) {
    activeMenu.value = menu
  }
}

function toggleMenu(menu: string) {
  if (activeMenu.value === menu) {
    activeMenu.value = null
  } else {
    activeMenu.value = menu
  }
}

function closeMenu() {
  if (closeTimer) {
    clearTimeout(closeTimer)
  }
  closeTimer = setTimeout(() => {
    activeMenu.value = null
    closeTimer = null
  }, 150)
}

const documents = computed(() => store.documents)

const currentDoc = computed(() => {
  if (!store.activeTabId) return { title: '', content: '', filePath: undefined }
  return store.getDocument(store.activeTabId) || { title: '', content: '', filePath: undefined }
})

const currentDocFilePath = computed(() => {
  return currentDoc.value.filePath
})

const currentTabMode = computed<'edit' | 'preview'>(() => {
  if (!store.activeTabId) return 'edit'
  const doc = store.getDocument(store.activeTabId)
  return doc ? doc.mode : 'preview'
})

const statusFileName = computed(() => {
  if (store.currentFilePath) {
    const parts = store.currentFilePath.split(/[\\/]/)
    return parts[parts.length - 1]
  }
  return currentDoc.value.title || '无标题文档'
})

watch(
  () => currentDoc.value.content,
  (val) => {
    if (store.activeTabId) {
      store.updateDocument(store.activeTabId, val)
    }
  }
)

function removeInitialLoading() {
  const el = document.getElementById('initial-loading')
  if (el) {
    el.classList.add('fade-out')
    setTimeout(() => el.remove(), 400)
  }
}

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  appError.value = message
  console.error('[App Error]', error)
}

function retryApp() {
  appError.value = null
  isLoading.value = true
  initApp()
}

async function initApp() {
  // 立即结束 loading，显示 UI
  isLoading.value = false
  removeInitialLoading()

  // 后台异步初始化（不阻塞 UI）
  Promise.allSettled([
    themeStore.initTheme().catch((e) => console.warn('[App] Theme init failed:', e)),
    store.loadRecentFiles().catch((e) => console.warn('[App] Recent files init failed:', e)),
    store.restoreFolders().catch((e) => console.warn('[App] Restore folders failed:', e)),
    loadOutlinePosition()
  ]).then(() => {
    if (documents.value.length > 0) {
      const firstDoc = documents.value[0]
      store.addTab(firstDoc.id, firstDoc.title)
      store.setActiveTab(firstDoc.id)
    }
    // 没有文档时不自动创建无标题文档，显示空状态提示
  })
}

async function toggleMaximize() {
  try {
    await window.electronAPI.windowMaximize()
    isMaximized.value = !isMaximized.value
  } catch (e) {
    console.error('[Window] Maximize failed:', e)
  }
}

async function handleMinimize() {
  try {
    await window.electronAPI.windowMinimize()
  } catch (e) {
    console.error('[Window] Minimize failed:', e)
  }
}

async function handleClose() {
  try {
    await window.electronAPI.windowClose()
  } catch (e) {
    console.error('[Window] Close failed:', e)
  }
}

function handleNew() {
  const id = store.addDocument('无标题文档', '', undefined, 'edit')
  store.addTab(id, '无标题文档')
  store.setActiveTab(id)
  setTimeout(() => {
    if (store.activeTabId === id) {
      store.isDirty = true
      store.updateTabDirty(id, true)
    }
  }, 50)
}

function handleSelect(id: string) {
  store.setActiveTab(id)
}

function handleModeChange(mode: 'edit' | 'preview') {
  if (store.activeTabId) {
    store.setDocMode(store.activeTabId, mode)
  }
}

function handleTabSwitch(id: string) {
  store.setActiveTab(id)
}

function handleTabClose(id: string) {
  store.closeTab(id)
}

function handleCloseOtherTabs(id: string) {
  store.closeOtherTabs(id)
}

function handleCloseAllTabs() {
  store.closeAllTabs()
}

function handleMoveTab(from: number, to: number) {
  store.moveTab(from, to)
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath
}

async function handleOpen() {
  const result = await store.openFileDialog()
  if (result) {
    // 检查文件是否已打开
    const existingDoc = store.getDocumentByPath(result.path)
    if (existingDoc) {
      store.setActiveTab(existingDoc.id)
      return
    }
    // 使用文件名作为标题
    const title = getFileName(result.path)
    const id = store.addDocument(title, result.content, result.path, 'preview')
    store.addTab(id, title)
    store.setActiveTab(id)
  }
}

async function handleOpenFolder() {
  try {
    const result = await store.openFolderDialog()
    if (result) {
      activeFolderPath.value = null
    }
  } catch (err) {
    console.error('[Renderer] Failed to open folder:', err)
    alert('打开文件夹失败: ' + (err instanceof Error ? err.message : String(err)))
  }
}

async function handleFolderFileSelect(node: FileNode, folderId: string) {
  const fullPath = store.getFullPath(node.path, folderId)
  activeFolderPath.value = node.path

  const existingDoc = store.getDocumentByPath(fullPath)
  if (existingDoc) {
    store.setActiveTab(existingDoc.id)
    return
  }

  const result = await store.openFilePath(fullPath)
  if (result) {
    const title = getFileName(result.path)
    const id = store.addDocument(title, result.content, result.path, 'preview')
    store.addTab(id, title)
    store.setActiveTab(id)
  }
}

function toggleFolderCollapsed(folderId: string) {
  const folder = store.getFolderById(folderId)
  if (folder) {
    store.setFolderCollapsed(folderId, !folder.collapsed)
  }
}

function handleRemoveFolder(folderId: string) {
  store.removeFolder(folderId)
  if (activeFolderPath.value && !store.getFolderById(folderId)) {
    activeFolderPath.value = null
  }
}

function handleCloseAllFolders() {
  store.clearAllFolders()
  activeFolderPath.value = null
}

function handleExpandAll() {
  for (const folder of store.folders) {
    store.expandAllFolderNodes(folder.id)
  }
}

function handleCollapseAll() {
  for (const folder of store.folders) {
    store.collapseAllFolderNodes(folder.id)
  }
}

function handleCloseAllDocuments() {
  store.closeAllTabs()
}

const folderContextMenu = reactive<{
  visible: boolean
  x: number
  y: number
  folderId: string | null
}>({
  visible: false,
  x: 0,
  y: 0,
  folderId: null
})

function handleFolderContextMenu(event: MouseEvent, folder: { id: string; path: string }) {
  folderContextMenu.visible = true
  folderContextMenu.x = event.clientX
  folderContextMenu.y = event.clientY
  folderContextMenu.folderId = folder.id
}

function closeFolderContextMenu() {
  folderContextMenu.visible = false
  folderContextMenu.folderId = null
}

function openFolderLocation() {
  const folder = store.folders.find((f) => f.id === folderContextMenu.folderId)
  if (folder) {
    window.electronAPI.showItemInFolder(folder.path, '')
  }
  closeFolderContextMenu()
}

function onContextMenuClickOutside() {
  closeFolderContextMenu()
}

function onContextMenuKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeFolderContextMenu()
  }
}

// 全局文件菜单快捷键处理
function handleGlobalKeyDown(e: KeyboardEvent) {
  const isTextInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

  // 以下快捷键在输入框中不处理
  if (isTextInput) {
    return
  }

  // Ctrl/Cmd + N: 新建文档
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
    e.preventDefault()
    handleNew()
    return
  }

  // Ctrl/Cmd + O: 打开文件
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
    e.preventDefault()
    handleOpen()
    return
  }

  // Ctrl/Cmd + W: 关闭当前标签
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
    e.preventDefault()
    if (store.activeTabId) {
      store.closeTab(store.activeTabId)
    }
    return
  }
}

async function handleSave() {
  if (store.activeTabId) {
    await store.saveFileAction(currentDoc.value.content)
  }
}

async function handleSaveAs() {
  if (store.activeTabId) {
    await store.saveFileAsAction(currentDoc.value.content)
  }
}

async function handleOpenRecent(path: string) {
  // 检查文件是否已打开
  const existingDoc = store.getDocumentByPath(path)
  if (existingDoc) {
    store.setActiveTab(existingDoc.id)
    return
  }
  const result = await store.openFilePath(path)
  if (result) {
    // 使用文件名作为标题
    const title = getFileName(result.path)
    const id = store.addDocument(title, result.content, result.path, 'preview')
    store.addTab(id, title)
    store.setActiveTab(id)
  }
}

function handleJumpToHeading(heading: { line: number; index: number }) {
  if (!editorRef.value) return
  // 预览模式使用 heading index 跳转，编辑模式使用行号
  editorRef.value.jumpToLine(heading.line, heading.index)
}

function handleScrollLineChange(line: number) {
  if (outlineRef.value) {
    outlineRef.value.setActiveByLine(line)
  }
}

async function loadOutlinePosition() {
  try {
    const config = await window.electronAPI.getConfig()
    const saved = config.outlinePosition as 'left' | 'right' | undefined
    if (saved && (saved === 'left' || saved === 'right')) {
      outlinePosition.value = saved
    }
  } catch {
    // 使用默认值
  }
}

async function toggleOutlinePosition() {
  outlinePosition.value = outlinePosition.value === 'left' ? 'right' : 'left'
  await window.electronAPI.setConfig('outlinePosition', outlinePosition.value)
}

onMounted(() => {
  initApp()
  document.addEventListener('click', onContextMenuClickOutside)
  document.addEventListener('keydown', onContextMenuKeyDown)
  // 添加全局文件菜单快捷键监听（不使用 capture，让编辑器内部优先处理）
  document.addEventListener('keydown', handleGlobalKeyDown)
})

onUnmounted(() => {
  removeInitialLoading()
  document.removeEventListener('click', onContextMenuClickOutside)
  document.removeEventListener('keydown', onContextMenuKeyDown)
  document.removeEventListener('keydown', handleGlobalKeyDown)
})
</script>

<style scoped>
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-primary, #d4d4d4);
  gap: 16px;
}

.app-loading .loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border, #333);
  border-top-color: var(--accent, #569cd6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.app-loading .loading-text {
  font-size: 14px;
  color: var(--text-muted, #888);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary, #1e1e1e);
  color: var(--text-primary, #d4d4d4);
  padding: 20px;
}

.error-box {
  text-align: center;
  max-width: 500px;
  padding: 32px;
  background: var(--bg-secondary, #252526);
  border-radius: 8px;
  border: 1px solid var(--border, #333);
}

.error-box h2 {
  margin-bottom: 16px;
  color: #f44747;
}

.error-message {
  margin-bottom: 24px;
  padding: 12px;
  background: var(--bg-tertiary, #2d2d2d);
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
}

.error-retry-btn {
  background: var(--accent, #569cd6);
  color: white;
  border: none;
  padding: 8px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.error-retry-btn:hover {
  filter: brightness(1.1);
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.titlebar {
  height: 40px;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  padding: 0 12px 0 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}

.title {
  font-size: 14px;
  font-weight: 600;
}

.menu-bar {
  position: relative;
  -webkit-app-region: no-drag;
  padding-bottom: 0;
}

.menu-item {
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  transition: background 0.15s;
}

.menu-item:hover,
.menu-bar:has(.dropdown-menu) .menu-item {
  background: var(--bg-tertiary);
}

.menu-arrow {
  font-size: 8px;
  color: var(--text-muted);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  padding: 6px 0;
  z-index: 1000;
  margin-top: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
}

.dropdown-icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.shortcut {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.file-path {
  flex: 1;
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-app-region: no-drag;
}

.dirty-indicator {
  color: #ffcc00;
  font-size: 10px;
  -webkit-app-region: no-drag;
}

.titlebar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.win-btn {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
  -webkit-app-region: no-drag;
}

.win-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.win-btn.close:hover {
  background: #e81123;
  color: #fff;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar.collapsed {
  width: 32px;
}

.resize-handle {
  flex-shrink: 0;
  background: var(--border);
  transition: background 0.15s;
  z-index: 10;
}

.resize-handle:hover,
.resize-handle:active {
  background: var(--accent, #4a9eff);
}

.resize-handle-right {
  width: 3px;
  cursor: col-resize;
  margin-left: -1px;
  margin-right: -1px;
}

.resize-handle-vertical {
  width: 3px;
  cursor: col-resize;
  margin-left: -1px;
  margin-right: -1px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.sidebar-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 14px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
}

.sidebar-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.sidebar-header {
  display: flex;
  justify-content: flex-end;
  padding: 4px 8px;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.new-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.new-btn:hover {
  filter: brightness(1.1);
}

.folder-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.folder-open-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px dashed var(--border);
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  width: 100%;
  text-align: center;
}

.folder-open-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  color: var(--accent);
}

.folder-tree-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.folder-item {
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 8px;
  margin-bottom: 10px;
  background: var(--bg-primary);
  overflow: hidden;
}

.folder-item.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.folder-item-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  font-size: 12px;
  background: var(--bg-tertiary);
  cursor: pointer;
  border-bottom: 1px solid rgba(128, 128, 128, 0.35);
}

.folder-item.active .folder-item-header {
  background: var(--bg-tertiary);
  border-bottom-color: var(--accent);
}

.folder-item-toggle {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 9px;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.folder-item-toggle:hover {
  color: var(--text-primary);
}

.folder-item-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  max-width: 120px;
}

.folder-item-path {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.folder-item-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.folder-item-close:hover {
  background: #e81123;
  color: #fff;
}

.folder-item-body {
  padding: 4px 8px 8px;
  background: var(--bg-primary);
}

.folder-item-placeholder {
  display: none;
}

.folder-path {
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  word-break: break-all;
}

.section-actions {
  display: flex;
  gap: 2px;
}

.icon-action-btn {
  background: transparent;
  color: var(--text-muted);
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}

.icon-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.recent-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recent-item {
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-item:hover {
  background: var(--bg-tertiary);
}

.recent-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 0;
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.doc-item {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-item:hover {
  background: var(--bg-tertiary);
}

.doc-item.active {
  background: var(--bg-tertiary);
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--bg-primary);
  position: relative;
}

.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.empty-editor {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}

.outline-toggle {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-right: none;
  color: var(--text-muted);
  padding: 8px 4px;
  border-radius: 4px 0 0 4px;
  cursor: pointer;
  font-size: 11px;
  writing-mode: vertical-rl;
  z-index: 10;
}

.outline-toggle.outline-toggle-left {
  right: auto;
  left: 0;
  border-right: 1px solid var(--border);
  border-left: none;
  border-radius: 0 4px 4px 0;
}

.outline-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.outline-position-toggle {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s, color 0.15s;
}

.outline-position-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.outline-left .outline-position-toggle {
  right: auto;
  left: 12px;
}
</style>

<style>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  min-width: 160px;
  font-size: 13px;
  color: var(--text-primary);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background 0.1s;
  border-radius: 4px;
  margin: 0 4px;
}

.context-menu-item:hover {
  background: var(--bg-tertiary);
}

.context-menu-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}
</style>