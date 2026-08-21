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
            <el-icon class="dropdown-icon"><Document /></el-icon>
            <span>新建文件</span>
            <span class="shortcut">Ctrl+N</span>
          </div>
          <div class="dropdown-item" @click="handleOpen(); closeMenu()">
            <el-icon class="dropdown-icon"><DocumentAdd /></el-icon>
            <span>打开文件</span>
            <span class="shortcut">Ctrl+O</span>
          </div>
          <div class="dropdown-item" @click="handleOpenFolder(); closeMenu()">
            <el-icon class="dropdown-icon"><FolderOpened /></el-icon>
            <span>打开文件夹</span>
            <span class="shortcut">Ctrl+Shift+O</span>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" @click="handleSave(); closeMenu()">
            <el-icon class="dropdown-icon"><Download /></el-icon>
            <span>保存</span>
            <span class="shortcut">Ctrl+S</span>
          </div>
          <div class="dropdown-item" @click="handleSaveAs(); closeMenu()">
            <el-icon class="dropdown-icon"><CopyDocument /></el-icon>
            <span>另存为</span>
            <span class="shortcut">Ctrl+Shift+S</span>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" @click="showPreferences = true; closeMenu()">
            <el-icon class="dropdown-icon"><Setting /></el-icon>
            <span>偏好设置</span>
            <span class="shortcut">Ctrl+'</span>
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
        <div v-else class="sidebar-inner">
          <div class="sidebar-main-header">
            <span class="sidebar-title">文件浏览</span>
            <button class="icon-btn" title="收起侧边栏" @click="showSidebar = false">⟨</button>
          </div>
          <div class="sidebar-content">
            <div class="sidebar-actions">
              <button class="new-btn" @click="handleNew">新建文件</button>
              <button class="new-btn" @click="handleOpen">打开文件</button>
              <button class="new-btn" @click="handleOpenFolder">打开文件夹</button>
            </div>
            <div class="folder-section">
            <div class="section-header">
              <span>文件夹浏览</span>
              <div class="section-actions" v-if="store.folders.length > 0">
                <button class="icon-action-btn" title="刷新文件夹" @click="handleRefreshFolders"><el-icon class="dropdown-icon"><Refresh /></el-icon></button>
                <button class="icon-action-btn" title="展开全部" @click="handleExpandAll">⊞</button>
                <button class="icon-action-btn" title="折叠全部" @click="handleCollapseAll">⊟</button>
                <button class="icon-action-btn" title="新建文件" @click="createFileInActiveFolder"><el-icon class="dropdown-icon"><DocumentAdd /></el-icon></button>
                <button class="icon-action-btn" title="新建文件夹" @click="createFolderInActiveFolder"><el-icon class="dropdown-icon"><FolderAdd /></el-icon></button>
                <button class="icon-action-btn" title="删除当前文件夹（从磁盘）" @click="handleDeleteActiveFolder"><el-icon class="dropdown-icon"><Delete /></el-icon></button>
                <button class="icon-action-btn" title="全部关闭" @click="handleCloseAllFolders"><el-icon class="dropdown-icon"><Close /></el-icon></button>
                
              </div>
            </div>
            <!-- 文件夹切换下拉框 -->
            <div v-if="store.folders.length > 0" class="folder-switcher">
              <el-icon class="folder-switcher-icon"><Folder /></el-icon>
              <div class="folder-dropdown" ref="folderDropdownRef">
                <button
                  class="folder-dropdown-trigger"
                  :title="activeFolder ? activeFolder.path : ''"
                  @click="toggleFolderDropdown"
                >
                  <span class="folder-dropdown-name">{{ activeFolder ? activeFolder.name : '' }}</span>
                  <span class="folder-dropdown-arrow">▾</span>
                </button>
              </div>
              <button
                v-if="activeFolder"
                class="folder-switcher-btn"
                title="打开文件位置"
                @click="openFolderLocationFor(activeFolder.path)"
              >
                <el-icon><FolderOpened /></el-icon>
              </button>
              <button
                v-if="activeFolder"
                class="folder-switcher-btn"
                title="移除此文件夹"
                @click="handleRemoveFolder(activeFolder.id)"
              >
                ✕
              </button>
            </div>
            <!-- <div v-else class="folder-empty">暂无已打开文件夹</div> -->

            <!-- 文件夹下拉菜单（Teleport 到 body，避免被侧边栏裁剪） -->
            <Teleport to="body">
              <div
                v-if="folderDropdownOpen && store.folders.length > 0"
                class="folder-dropdown-menu"
                :style="{ left: folderDropdownRect.left + 'px', top: folderDropdownRect.top + 'px', minWidth: folderDropdownRect.width + 'px' }"
              >
                <div
                  v-for="folder in store.folders"
                  :key="folder.id"
                  class="folder-dropdown-item"
                  :class="{ active: folder.id === store.activeFolderId }"
                  :title="folder.path"
                  @click="selectFolder(folder.id)"
                >
                  <span class="folder-dropdown-item-name">{{ folder.name }}</span>
                  <span class="folder-dropdown-item-path">({{ folder.path }})</span>
                </div>
              </div>
            </Teleport>

            <!-- 仅显示活动文件夹的内容 -->
            <div v-if="activeFolder" class="folder-tree-area" @contextmenu.prevent="handleTreeAreaContextMenu">
              <FolderTree
                :nodes="activeFolder.tree"
                :expanded="activeFolder.expanded"
                :active-path="activeFolderPath"
                :base-path="activeFolder.path"
                :rename-request="treeRenameRequest"
                @select="(node) => handleFolderFileSelect(node, activeFolder.id)"
                @toggle="(path) => store.toggleFolderNode(activeFolder.id, path)"
                @refresh="() => store.reloadFolderTree(activeFolder.id)"
                @renamed="handleItemRenamed"
                @create-file="(dirRelPath) => handleCreateFile(activeFolder, dirRelPath)"
                @create-folder="(dirRelPath) => handleCreateFolder(activeFolder, dirRelPath)"
                @delete="(payload) => handleDeleteItem(activeFolder, payload)"
              />
            </div>
          </div>

          <div class="recent-section">
            <div class="section-header">
              <span>最近打开文件</span>
              <button
                v-if="store.recentFiles.length > 0"
                class="icon-action-btn"
                title="清空最近打开文件"
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
                @contextmenu.prevent="handleFolderContextMenu($event, file.path, 'recent', file.title)"
                :title="file.path"
              >
                <span v-if="renamingTarget?.type === 'recent' && renamingTarget.path === file.path" class="rename-inline">
                  <input
                    ref="renameInputEl"
                    v-model="renameValue"
                    class="rename-inline-input"
                    @click.stop
                    @keydown.enter.prevent="confirmSidebarRename()"
                    @keydown.esc.prevent="cancelSidebarRename()"
                    @blur="confirmSidebarRename()"
                  />
                </span>
                <span v-else class="recent-title">{{ file.title }}</span>
              </div>
            </div>
            <!-- <div class="empty-hint" v-else>暂无最近文件</div> -->
          </div>

          <div class="doc-list">
            <div class="section-header">
              <span>已打开文件列表</span>
              <button
                v-if="documents.length > 0"
                class="icon-action-btn"
                title="关闭全部已打开文件"
                @click="handleCloseAllDocuments"
              >
                ✕
              </button>
            </div>
            <div class="doc-list-content">
              <div
                v-for="doc in documents"
                :key="doc.id"
                class="doc-item"
                :class="{ active: doc.id === store.activeTabId }"
                @click="handleSelect(doc.id)"
                @contextmenu.prevent="doc.filePath && handleFolderContextMenu($event, doc.filePath, 'doc', doc.title)"
                :title="doc.filePath || doc.title"
              >
                <span v-if="renamingTarget?.type === 'doc' && renamingTarget.path === doc.filePath" class="rename-inline">
                  <input
                    ref="renameInputEl"
                    v-model="renameValue"
                    class="rename-inline-input"
                    @click.stop
                    @keydown.enter.prevent="confirmSidebarRename()"
                    @keydown.esc.prevent="cancelSidebarRename()"
                    @blur="confirmSidebarRename()"
                  />
                </span>
                <span v-else>{{ doc.title }}</span>
              </div>
            </div>
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
            :model-value="currentDoc.content"
            :editor-mode="currentTabMode"
            :file-path="currentDocFilePath"
            @update:model-value="handleContentUpdate"
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
          v-if="showOutline && store.activeTabId"
          class="resize-handle resize-handle-vertical"
          :style="outlinePosition === 'left' ? 'order: 2' : 'order: 2'"
          @mousedown="startResize('outline', $event)"
        ></div>

        <OutlineSidebar
          v-if="showOutline && store.activeTabId"
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
      v-if="store.activeTabId"
      :content="currentDoc.content"
      :file-name="statusFileName"
      :is-dirty="store.isDirty"
    />

    <PreferencesDialog v-if="showPreferences" @close="showPreferences = false" />

    <teleport to="body">
      <div
        v-if="folderContextMenu.visible"
        class="context-menu"
        :style="{ left: folderContextMenu.x + 'px', top: folderContextMenu.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="openFolderLocation">
          <el-icon class="context-menu-icon">
            <FolderOpened />
          </el-icon>
          <span>打开文件位置</span>
        </div>
        <div v-if="folderContextMenu.type !== 'folder'" class="context-menu-item" @click="startSidebarRename">
          <el-icon class="context-menu-icon">
            <EditPen />
          </el-icon>
          <span>重命名</span>
        </div>
      </div>
    </teleport>

    <!-- 文件夹浏览区空白处右键菜单 -->
    <teleport to="body">
      <div
        v-if="treeAreaMenu.visible"
        class="context-menu"
        :style="{ left: treeAreaMenu.x + 'px', top: treeAreaMenu.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="createFileInActiveFolder">
          <el-icon class="context-menu-icon">
            <DocumentAdd />
          </el-icon>
          <span>新建文件</span>
        </div>
        <div class="context-menu-item" @click="createFolderInActiveFolder">
          <el-icon class="context-menu-icon">
            <FolderAdd />
          </el-icon>
          <span>新建文件夹</span>
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
import { Document, Folder, FolderOpened, Download, CopyDocument, Setting, DocumentAdd, EditPen, Refresh, FolderAdd, Delete, Close } from '@element-plus/icons-vue'
import PreferencesDialog from './components/PreferencesDialog.vue'

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
const showPreferences = ref(false)

const sidebarWidth = ref(280)
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
// 新建文件后，触发文件夹树中的行内重命名（编辑文件名）
const treeRenameRequest = ref<{ path: string; name: string; version: number } | null>(null)
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

const activeFolder = computed(() => store.folders.find((f) => f.id === store.activeFolderId) || null)

// 文件夹下拉框状态
const folderDropdownOpen = ref(false)
const folderDropdownRect = ref({ left: 0, top: 0, width: 0 })
const folderDropdownRef = ref<HTMLElement | null>(null)

function toggleFolderDropdown() {
  folderDropdownOpen.value = !folderDropdownOpen.value
  if (folderDropdownOpen.value) {
    const el = folderDropdownRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      folderDropdownRect.value = { left: rect.left, top: rect.bottom + 4, width: rect.width }
    }
  }
}

function selectFolder(id: string) {
  store.setActiveFolder(id)
  folderDropdownOpen.value = false
}

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

function handleContentUpdate(newContent: string) {
  console.log('[handleContentUpdate] new content length:', newContent?.length)
  if (store.activeTabId) {
    store.updateDocument(store.activeTabId, newContent)
  }
}

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
  const doc = store.getDocument(id)
  if (doc?.filePath) {
    selectFileInTree(doc.filePath)
  }
}

function handleModeChange(mode: 'edit' | 'preview') {
  if (store.activeTabId) {
    store.setDocMode(store.activeTabId, mode)
  }
}

function handleTabSwitch(id: string) {
  store.setActiveTab(id)
}

async function handleTabClose(id: string) {
  const doc = store.getDocument(id)
  if (doc && store.isDocumentDirty(id)) {
    const result = await window.electronAPI.showSaveConfirmDialog(doc.title)
    if (result === 'cancel') {
      return
    }
    if (result === 'save') {
      // 切换到该标签页以便保存
      store.setActiveTab(id)
      await handleSave()
      // 如果保存失败（比如用户取消了保存对话框），则不关闭标签页
      if (store.isDocumentDirty(id)) {
        return
      }
    }
  }
  store.closeTab(id)
}

async function handleCloseOtherTabs(id: string) {
  // 获取除当前标签外的其他未保存文档
  const otherTabs = store.tabs.filter((t) => t.id !== id)
  const dirtyDocs = otherTabs.filter((t) => t.isDirty).map((t) => ({
    id: t.id,
    title: t.title
  }))

  // 如果有未保存的文档，逐个确认
  for (const dirtyDoc of dirtyDocs) {
    const result = await window.electronAPI.showSaveConfirmDialog(dirtyDoc.title)
    if (result === 'cancel') {
      return
    }
    if (result === 'save') {
      store.setActiveTab(dirtyDoc.id)
      await handleSave()
      if (store.isDocumentDirty(dirtyDoc.id)) {
        return
      }
    }
  }
  store.closeOtherTabs(id)
}

async function handleCloseAllTabs() {
  // 获取所有未保存的文档
  const dirtyDocs = store.tabs.filter((t) => t.isDirty).map((t) => ({
    id: t.id,
    title: t.title
  }))

  // 如果有未保存的文档，逐个确认
  for (const dirtyDoc of dirtyDocs) {
    const result = await window.electronAPI.showSaveConfirmDialog(dirtyDoc.title)
    if (result === 'cancel') {
      return
    }
    if (result === 'save') {
      store.setActiveTab(dirtyDoc.id)
      await handleSave()
      if (store.isDocumentDirty(dirtyDoc.id)) {
        return
      }
    }
  }
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
  await openFilePath(fullPath)
}

// 按完整路径打开文件（已打开则切换，否则新建文档）
async function openFilePath(fullPath: string) {
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

// 文件夹右键「新建文件」/ 文件夹空白处右键「新建文件」
async function handleCreateFile(
  folder: { id: string; path: string; name: string; tree: FileNode[]; expanded: Set<string>; collapsed: boolean },
  dirRelPath: string
) {
  const result = await window.electronAPI.createFile(folder.path, dirRelPath)
  if (!result || !result.ok) {
    alert(result?.error || '新建文件失败')
    return
  }
  // 刷新文件夹树
  await store.reloadFolderTree(folder.id)
  // 展开祖先目录，使新文件可见
  if (result.relPath) {
    const parts = result.relPath.split(/[\\/]+/).slice(0, -1)
    let acc = ''
    for (const part of parts) {
      acc = acc ? acc + '\\' + part : part
      store.expandFolderNode(folder.id, acc)
    }
    activeFolderPath.value = result.relPath
  }
  // 打开新文件
  if (result.path) {
    await openFilePath(result.path)
  }
  // 触发文件夹树中新建文件的行内重命名，便于直接编辑文件名
  if (result.relPath && result.name) {
    treeRenameRequest.value = { path: result.relPath, name: result.name, version: Date.now() }
  }
}

// 文件夹浏览区空白处右键菜单
const treeAreaMenu = reactive<{
  visible: boolean
  x: number
  y: number
}>({
  visible: false,
  x: 0,
  y: 0
})

function handleTreeAreaContextMenu(event: MouseEvent) {
  treeAreaMenu.visible = true
  treeAreaMenu.x = event.clientX
  treeAreaMenu.y = event.clientY
}

function closeTreeAreaMenu() {
  treeAreaMenu.visible = false
}

// 在活动文件夹根目录新建文件
function createFileInActiveFolder() {
  closeTreeAreaMenu()
  if (activeFolder.value) {
    handleCreateFile(activeFolder.value, '')
  }
}

// 新建文件夹（文件夹右键 / 头部按钮）
async function handleCreateFolder(
  folder: { id: string; path: string; name: string; tree: FileNode[]; expanded: Set<string>; collapsed: boolean },
  dirRelPath: string
) {
  const result = await window.electronAPI.createDirectory(folder.path, dirRelPath)
  if (!result || !result.ok) {
    alert(result?.error || '新建文件夹失败')
    return
  }
  await store.reloadFolderTree(folder.id)
  if (result.relPath) {
    // 展开新文件夹的祖先目录及新文件夹本身，使其可见
    const parts = result.relPath.split(/[\\/]+/)
    let acc = ''
    for (const part of parts) {
      acc = acc ? acc + '\\' + part : part
      store.expandFolderNode(folder.id, acc)
    }
    activeFolderPath.value = null
  }
  // 触发文件夹树中的行内重命名，便于直接编辑文件夹名
  if (result.relPath && result.name) {
    treeRenameRequest.value = { path: result.relPath, name: result.name, version: Date.now() }
  }
}

// 在活动文件夹根目录新建文件夹（头部按钮）
function createFolderInActiveFolder() {
  if (activeFolder.value) {
    handleCreateFolder(activeFolder.value, '')
  }
}

// 删除树中的文件或文件夹（右键菜单）
async function handleDeleteItem(
  folder: { id: string; path: string; name: string; tree: FileNode[]; expanded: Set<string>; collapsed: boolean },
  payload: { relPath: string; isDirectory: boolean }
) {
  const fullPath = store.getFullPath(payload.relPath, folder.id)
  const label = payload.isDirectory ? '文件夹' : '文件'
  if (!window.confirm(`确定要删除${label}「${payload.relPath}」吗？此操作不可恢复。`)) return
  const result = await window.electronAPI.deleteItem(folder.path, payload.relPath)
  if (!result || !result.ok) {
    alert(result?.error || '删除失败')
    return
  }
  await store.reloadFolderTree(folder.id)
  if (activeFolderPath.value === payload.relPath) {
    activeFolderPath.value = null
  }
  // 关闭已打开的被删文件/文件夹内文档
  store.closeTabsByPathPrefix(fullPath)
  store.loadRecentFiles().catch((e) => console.warn('[App] Reload recent files failed:', e))
}

// 删除当前文件夹（头部按钮，从磁盘删除整个文件夹）
async function handleDeleteActiveFolder() {
  const folder = activeFolder.value
  if (!folder) return
  if (!window.confirm(`确定要删除文件夹「${folder.name}」及其所有内容吗？此操作不可恢复。`)) return
  const result = await window.electronAPI.deleteItem(folder.path, '')
  if (!result || !result.ok) {
    alert(result?.error || '删除失败')
    return
  }
  // 关闭该文件夹下所有已打开的文档
  store.closeTabsByPathPrefix(folder.path)
  // 从列表中移除该文件夹
  store.removeFolder(folder.id)
  store.loadRecentFiles().catch((e) => console.warn('[App] Reload recent files failed:', e))
}

function handleItemRenamed(payload: { oldPath: string; newPath: string }) {
  store.updateDocPathsAfterRename(payload.oldPath, payload.newPath)
  // 主进程已同步更新最近打开文件列表，重新加载
  store.loadRecentFiles().catch((e) => console.warn('[App] Reload recent files failed:', e))
}

// 在文件夹树中选中并展开某个文件（用于从最近打开文件/已打开文件列表跳转）
function selectFileInTree(fullPath: string) {
  const fullNorm = fullPath.toLowerCase()
  for (const folder of store.folders) {
    const base = folder.path.replace(/[\\/]+$/, '')
    const baseNorm = base.toLowerCase()
    if (fullNorm !== baseNorm && !fullNorm.startsWith(baseNorm + '\\') && !fullNorm.startsWith(baseNorm + '/')) {
      continue
    }
    const rel = fullPath.slice(base.length).replace(/^[\\/]+/, '')
    const sep = rel.includes('\\') ? '\\' : '/'
    store.setActiveFolder(folder.id)
    activeFolderPath.value = rel
    if (folder.collapsed) store.setFolderCollapsed(folder.id, false)
    // 展开祖先目录，使文件可见
    const parts = rel.split(/[\\/]+/).slice(0, -1)
    let acc = ''
    for (const part of parts) {
      acc = acc ? acc + sep + part : part
      store.expandFolderNode(folder.id, acc)
    }
    return
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
  if (store.activeFolderId) {
    store.expandAllFolderNodes(store.activeFolderId)
  }
}

async function handleRefreshFolders() {
  if (store.activeFolderId) {
    await store.reloadFolderTree(store.activeFolderId)
  }
}

function handleCollapseAll() {
  if (store.activeFolderId) {
    store.collapseAllFolderNodes(store.activeFolderId)
  }
}

async function handleCloseAllDocuments() {
  await handleCloseAllTabs()
}

const folderContextMenu = reactive<{
  visible: boolean
  x: number
  y: number
  path: string | null
  type: 'folder' | 'recent' | 'doc'
  name: string
}>({
  visible: false,
  x: 0,
  y: 0,
  path: null,
  type: 'folder',
  name: ''
})

function handleFolderContextMenu(event: MouseEvent, path: string, type: 'folder' | 'recent' | 'doc' = 'folder', name = '') {
  folderContextMenu.visible = true
  folderContextMenu.x = event.clientX
  folderContextMenu.y = event.clientY
  folderContextMenu.path = path
  folderContextMenu.type = type
  folderContextMenu.name = name
}

function closeFolderContextMenu() {
  folderContextMenu.visible = false
  folderContextMenu.path = null
}

function openFolderLocation() {
  if (folderContextMenu.path) {
    window.electronAPI.showItemInFolder('', folderContextMenu.path)
  }
  closeFolderContextMenu()
}

function openFolderLocationFor(path: string) {
  window.electronAPI.showItemInFolder('', path)
}

// 侧边栏列表（最近打开文件 / 已打开文件列表）内联重命名
const renamingTarget = ref<{ type: 'recent' | 'doc'; path: string } | null>(null)
const renameValue = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function splitPath(p: string): { dir: string; name: string } {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (idx === -1) return { dir: '', name: p }
  return { dir: p.slice(0, idx), name: p.slice(idx + 1) }
}

function startSidebarRename() {
  if (!folderContextMenu.path) return
  renamingTarget.value = { type: folderContextMenu.type === 'folder' ? 'doc' : folderContextMenu.type, path: folderContextMenu.path }
  renameValue.value = folderContextMenu.name
  folderContextMenu.visible = false
  nextTick(() => {
    renameInputEl.value?.focus()
    renameInputEl.value?.select()
  })
}

async function confirmSidebarRename() {
  const target = renamingTarget.value
  if (!target) return
  const newName = renameValue.value.trim()
  renamingTarget.value = null
  if (!newName || newName === splitPath(target.path).name) return
  const { dir, name } = splitPath(target.path)
  const result = await window.electronAPI.renameItem(dir, name, newName)
  if (result && result.ok) {
    if (result.oldPath && result.newPath) {
      store.updateDocPathsAfterRename(result.oldPath, result.newPath)
    }
    store.loadRecentFiles().catch((e) => console.warn('[App] Reload recent files failed:', e))
  } else {
    alert(result?.error || '重命名失败')
  }
}

function cancelSidebarRename() {
  renamingTarget.value = null
}

function onContextMenuClickOutside(e: MouseEvent) {
  closeFolderContextMenu()
  closeTreeAreaMenu()
  // 点击文件夹下拉框外部时关闭下拉
  const el = folderDropdownRef.value
  if (el && !el.contains(e.target as Node)) {
    folderDropdownOpen.value = false
  }
}

function onContextMenuKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeFolderContextMenu()
    closeTreeAreaMenu()
    folderDropdownOpen.value = false
  }
}

// 全局文件菜单快捷键处理
async function handleGlobalKeyDown(e: KeyboardEvent) {
  // 调试日志：检测快捷键
  if (e.ctrlKey || e.metaKey) {
    console.log('[Shortcut] Key pressed:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey)
  }

  // Ctrl/Cmd + H: 打开替换框（全局可用）
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
    e.preventDefault()
    if (editorRef.value) {
      editorRef.value.openReplaceBox()
    }
    return
  }

  // Ctrl/Cmd + Shift + I: 打开 DevTools 调试工具（全局可用）
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'i') {
    e.preventDefault()
    window.electronAPI.openDevTools()
    return
  }

  // Ctrl/Cmd + F: 打开搜索框（全局可用）
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    if (editorRef.value) {
      editorRef.value.openSearchBox()
    }
    return
  }

  // Ctrl/Cmd + ': 打开偏好设置（全局可用，即使在输入框中）
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "'") {
    e.preventDefault()
    showPreferences.value = true
    return
  }

  const isTextInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

  // 搜索框打开时的导航快捷键（全局处理）
  if (editorRef.value?.getSearchBoxVisible?.()) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        editorRef.value.findPrev()
      } else {
        editorRef.value.findNext()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      editorRef.value.closeSearchBox()
      return
    }
  }

  // 以下快捷键在输入框中不处理
  if (isTextInput) {
    return
  }

  // Ctrl/Cmd + N: 新建文件
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

  // Ctrl/Cmd + Shift + O: 打开文件夹
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
    e.preventDefault()
    handleOpenFolder()
    return
  }

  // Ctrl/Cmd + W: 关闭当前标签
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'w') {
    e.preventDefault()
    if (store.activeTabId) {
      await handleTabClose(store.activeTabId)
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
    selectFileInTree(path)
    return
  }
  const result = await store.openFilePath(path)
  if (result) {
    // 使用文件名作为标题
    const title = getFileName(result.path)
    const id = store.addDocument(title, result.content, result.path, 'preview')
    store.addTab(id, title)
    store.setActiveTab(id)
    selectFileInTree(result.path)
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
  // 将 store 暴露给 window，供主进程在关闭窗口时检查未保存文档
  ;(window as any).__editorStore__ = store
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

.sidebar-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
  flex: 1;
  gap: 12px;
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

.sidebar-main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 38px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  box-sizing: border-box;
}

.sidebar-actions {
  display: flex;
  flex-direction: row;
  gap: 6px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1;
  display: flex;
  align-items: center;
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
  flex: 1;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 5px 4px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  text-align: center;
  transition: background 0.15s, border-color 0.15s;
}

.new-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent);
}

.folder-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 2;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--border);
  padding-top: 10px;
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

.folder-switcher {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-primary);
}

.folder-switcher-icon {
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.folder-dropdown {
  position: relative;
  flex: 1;
  min-width: 0;
}

.folder-dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 12px;
  padding: 2px 4px;
  cursor: pointer;
}

.folder-dropdown-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.folder-dropdown-arrow {
  color: var(--text-muted);
  font-size: 10px;
  flex-shrink: 0;
}

.folder-dropdown-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 3px 0;
  max-height: 280px;
  overflow-y: auto;
  z-index: 9999;
  max-width: 480px;
}

.folder-dropdown-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
}

.folder-dropdown-item:hover {
  background: var(--bg-tertiary);
}

.folder-dropdown-item.active {
  background: var(--bg-tertiary);
}

.folder-dropdown-item-name {
  flex-shrink: 0;
}

.folder-dropdown-item-path {
  font-size: 10px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.folder-switcher-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.folder-switcher-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.folder-tree-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 8px;
  padding: 4px 8px 8px;
}

.folder-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 8px;
  text-align: center;
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
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.icon-action-btn.danger {
  color: #e81123;
}

.icon-action-btn.danger:hover {
  background: rgba(232, 17, 35, 0.15);
  color: #e81123;
}

.recent-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--border);
  padding-top: 10px;
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
  flex-shrink: 0;
  white-space: nowrap;
  gap: 6px;
}

.section-header > span {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.section-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.recent-item {
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.recent-item:hover {
  background: var(--bg-tertiary);
}

.recent-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rename-inline {
  flex: 1;
  min-width: 0;
  display: flex;
}

.rename-inline-input {
  flex: 1;
  min-width: 0;
  background: var(--bg-primary);
  border: 1px solid var(--accent);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
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
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.doc-list-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.doc-item {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
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
  border-radius: 5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  padding: 3px 0;
  min-width: 140px;
  font-size: 11px;
  color: var(--text-primary);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.1s;
  border-radius: 3px;
  margin: 0 3px;
}

.context-menu-item:hover {
  background: var(--bg-tertiary);
}

.context-menu-icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
}
</style>