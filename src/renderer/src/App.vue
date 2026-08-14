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
      <div class="file-actions">
        <button class="action-btn" @click="handleNew">新建</button>
        <button class="action-btn" @click="handleOpen">打开</button>
        <button class="action-btn" @click="handleSave">保存</button>
        <button class="action-btn" @click="handleSaveAs">另存为</button>
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
          @click="window.electronAPI.windowMinimize()"
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
          @click="window.electronAPI.windowClose()"
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
      <aside class="sidebar" :class="{ collapsed: !showSidebar }">
        <div v-if="!showSidebar" class="sidebar-toggle" @click="showSidebar = true" title="展开侧边栏">
          ⟩
        </div>
        <div v-else class="sidebar-content">
          <div class="sidebar-header">
            <button class="icon-btn" title="收起侧边栏" @click="showSidebar = false">⟨</button>
          </div>
          <button class="new-btn" @click="handleNew">新建文档</button>

          <div class="recent-section">
            <div class="section-header">
              <span>最近文件</span>
              <button
                v-if="store.recentFiles.length > 0"
                class="clear-btn"
                @click="store.clearRecentFilesAction()"
              >
                清空
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
            <div class="empty-hint" v-else>暂无最近文件</div>
          </div>

          <div class="doc-list">
            <div class="section-header">
              <span>文档列表</span>
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

      <section class="editor-main">
        <div class="editor-area">
          <TyporaEditor
            v-if="store.activeTabId"
            ref="editorRef"
            v-model="currentDoc.content"
            @save-requested="handleSave"
            @save-as-requested="handleSaveAs"
          />
          <EditorToolbar
            v-if="store.activeTabId"
            :editor-ref="editorRef"
          />
          <div v-else class="empty-editor">
            <p>选择或创建一个文档开始编辑</p>
          </div>
        </div>

        <OutlineSidebar
          v-if="showOutline"
          ref="outlineRef"
          :content="currentDoc.content"
          @jump-to-heading="handleJumpToHeading"
          @close="showOutline = false"
        />
        <button
          v-if="!showOutline && store.activeTabId"
          class="outline-toggle"
          title="显示大纲"
          @click="showOutline = true"
        >
          大纲
        </button>
      </section>
    </main>

    <StatusBar
      :content="currentDoc.content"
      :file-name="statusFileName"
      :is-dirty="store.isDirty"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useEditorStore } from './stores/editor'
import { useThemeStore } from './stores/theme'
import TyporaEditor from './components/TyporaEditor.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import EditorToolbar from './components/EditorToolbar.vue'
import TabBar from './components/TabBar.vue'
import OutlineSidebar from './components/OutlineSidebar.vue'
import StatusBar from './components/StatusBar.vue'

const store = useEditorStore()
const themeStore = useThemeStore()

const editorRef = ref<InstanceType<typeof TyporaEditor> | null>(null)
const outlineRef = ref<InstanceType<typeof OutlineSidebar> | null>(null)
const showOutline = ref(true)
const showSidebar = ref(true)
const isMaximized = ref(false)
const isLoading = ref(true)
const appError = ref<string | null>(null)

const documents = computed(() => store.documents)

const currentDoc = computed(() => {
  if (!store.activeTabId) return { title: '', content: '' }
  return store.getDocument(store.activeTabId) || { title: '', content: '' }
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
    store.loadRecentFiles().catch((e) => console.warn('[App] Recent files init failed:', e))
  ]).then(() => {
    if (documents.value.length === 0) {
      handleNew()
    } else {
      const firstDoc = documents.value[0]
      store.addTab(firstDoc.id, firstDoc.title)
      store.setActiveTab(firstDoc.id)
    }
  })
}

async function toggleMaximize() {
  await window.electronAPI.windowMaximize()
  isMaximized.value = !isMaximized.value
}

function handleNew() {
  const id = store.addDocument('无标题文档', '')
  store.addTab(id, '无标题文档')
  store.setActiveTab(id)
  // 新建文档没有文件路径
  store.currentFilePath = null
}

function handleSelect(id: string) {
  store.setActiveTab(id)
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
    const id = store.addDocument(title, result.content, result.path)
    store.addTab(id, title)
    store.setActiveTab(id)
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
    const id = store.addDocument(title, result.content, result.path)
    store.addTab(id, title)
    store.setActiveTab(id)
  }
}

function handleJumpToHeading(heading: { line: number }) {
  if (!editorRef.value) return

  // 先切换到编辑模式
  editorRef.value.setMode('edit')

  nextTick(() => {
    const ta = editorRef.value?.getTextarea()
    if (!ta) return

    const lines = ta.value.split('\n')
    let charIndex = 0
    for (let i = 0; i < heading.line && i < lines.length; i++) {
      charIndex += lines[i].length + 1
    }

    const lineHeight = 25
    ta.focus()
    ta.selectionStart = ta.selectionEnd = charIndex
    ta.scrollTop = heading.line * lineHeight
  })
}

onMounted(() => {
  initApp()
})

onUnmounted(() => {
  removeInitialLoading()
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

.file-actions {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.action-btn {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.action-btn:hover {
  background: var(--bg-tertiary);
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
  width: 240px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.sidebar.collapsed {
  width: 32px;
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

.recent-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.clear-btn {
  background: transparent;
  color: var(--text-muted);
  border: none;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}

.clear-btn:hover {
  color: var(--text-primary);
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

.outline-toggle:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
</style>