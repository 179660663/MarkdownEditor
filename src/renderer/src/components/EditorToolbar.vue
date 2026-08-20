<template>
  <Teleport to="body">
    <div
      v-show="visible"
      class="editor-toolbar"
      :style="toolbarStyle"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <div class="toolbar-group">
        <button class="tb-btn" :title="'加粗 (Ctrl+B)'" @click="action('bold')">
          <span class="tb-icon"><b>B</b></span>
        </button>
        <button class="tb-btn" :title="'斜体 (Ctrl+I)'" @click="action('italic')">
          <span class="tb-icon"><i>I</i></span>
        </button>
        <button class="tb-btn" :title="'行内代码 (Ctrl+K)'" @click="action('inlineCode')">
          <span class="tb-icon">{ }</span>
        </button>
        <button class="tb-btn" :title="'公式 (Ctrl+E)'" @click="action('math')">
          <span class="tb-icon">∑</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <select class="tb-select" @change="onHeadingChange($event)">
          <option value="">段落</option>
          <option value="h1">标题 1</option>
          <option value="h2">标题 2</option>
          <option value="h3">标题 3</option>
          <option value="h4">标题 4</option>
          <option value="h5">标题 5</option>
          <option value="h6">标题 6</option>
        </select>
        <button class="tb-btn" title="引用" @click="action('quote')">
          <span class="tb-icon">❝</span>
        </button>
        <button class="tb-btn" title="代码块" @click="action('codeBlock')">
          <span class="tb-icon">```</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="tb-btn" title="无序列表" @click="action('ul')">
          <span class="tb-icon">•</span>
        </button>
        <button class="tb-btn" title="有序列表" @click="action('ol')">
          <span class="tb-icon">1.</span>
        </button>
        <button class="tb-btn" title="任务列表" @click="action('taskList')">
          <span class="tb-icon">☐</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="tb-btn" title="链接" @click="action('link')">
          <span class="tb-icon">🔗</span>
        </button>
        <button class="tb-btn" title="图片" @click="insertImage">
          <span class="tb-icon">🖼</span>
        </button>
        <button class="tb-btn" title="表格" @click="showTableDialog = true">
          <span class="tb-icon">⊞</span>
        </button>
        <button class="tb-btn" title="分割线" @click="action('hr')">
          <span class="tb-icon">—</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class="tb-btn"
          title="切换编辑/预览模式 (Ctrl+Shift+E)"
          @click="toggleEditMode"
        >
          <span class="tb-icon">🔄</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <div class="export-dropdown">
          <button class="tb-btn" title="导出">
            <span class="tb-icon">📤</span>
          </button>
          <div class="export-menu">
            <button class="export-item" @click="onExportHtml">导出 HTML</button>
            <button class="export-item" @click="onExportPdf">导出 PDF</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="showTableDialog"
      class="table-dialog-overlay"
      @click.self="showTableDialog = false"
    >
      <div class="table-dialog">
        <h4>插入表格</h4>
        <div class="table-size">
          <label>行数：<input type="number" v-model="tableRows" min="1" max="20" /></label>
          <label>列数：<input type="number" v-model="tableCols" min="1" max="10" /></label>
        </div>
        <div class="table-preview">
          <div
            v-for="r in tableRows"
            :key="'r' + r"
            class="table-preview-row"
          >
            <div
              v-for="c in tableCols"
              :key="'c' + c"
              class="table-preview-cell"
            ></div>
          </div>
        </div>
        <div class="table-actions">
          <button @click="showTableDialog = false">取消</button>
          <button class="primary" @click="insertTable">确定</button>
        </div>
      </div>
    </div>
  </Teleport>

  <input
    ref="fileInputRef"
    type="file"
    accept="image/*"
    multiple
    style="display: none"
    @change="handleImageFile"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useEditorStore } from '../stores/editor'
import { exportToHtml, exportToPdf } from '../utils/exporter'

const props = defineProps<{
  editorRef: any
}>()

const store = useEditorStore()

const visible = ref(false)
const isHovered = ref(false)
const showTableDialog = ref(false)
const tableRows = ref(3)
const tableCols = ref(3)
const fileInputRef = ref<HTMLInputElement | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | null = null
const EDITOR_TOP_THRESHOLD = 60
const AUTO_HIDE_DELAY = 2*1000 // 单位：毫秒

const toolbarStyle = computed(() => {
  if (!props.editorRef?.value) return {}
  const container = props.editorRef.value.$el
  if (!container) return {}
  const rect = container.getBoundingClientRect()
  return {
    position: 'fixed' as const,
    top: `${rect.top + 8}px`,
    left: `${rect.left + 24}px`,
    zIndex: 1000
  }
})

function getEditorEl(): HTMLElement | null {
  if (!props.editorRef?.value) return null
  return props.editorRef.value.$el as HTMLElement
}

function handleMouseMove(e: MouseEvent) {
  const el = getEditorEl()
  if (!el) return

  const rect = el.getBoundingClientRect()
  const withinEditor =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom

  if (withinEditor && e.clientY - rect.top < EDITOR_TOP_THRESHOLD) {
    cancelHideTimer()
    if (!visible.value) {
      visible.value = true
    }
  } else if (!withinEditor && visible.value && !isHovered.value) {
    startHideTimer()
  }
}

function startHideTimer() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!isHovered.value) {
      visible.value = false
    }
  }, AUTO_HIDE_DELAY)
}

function cancelHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function getEditorAPI() {
  if (!props.editorRef?.value) return null
  return props.editorRef.value
}

function ensureEditMode() {
  const api = getEditorAPI()
  if (!api) return null
  if (api.getMode && api.getMode() === 'preview') {
    api.setMode('edit')
  }
  return api
}

function toggleEditMode() {
  const api = getEditorAPI()
  if (!api) return
  if (api.toggleMode) {
    api.toggleMode()
  }
}

function action(type: string) {
  const api = ensureEditMode()
  if (!api) return

  switch (type) {
    case 'bold':
      api.wrapSelection('**', '**', '粗体文本')
      break
    case 'italic':
      api.wrapSelection('*', '*', '斜体文本')
      break
    case 'inlineCode':
      api.wrapSelection('`', '`', '代码')
      break
    case 'math':
      api.wrapSelection('$$', '$$', '公式')
      break
    case 'quote':
      wrapBlock('> ', '引用内容')
      break
    case 'codeBlock':
      wrapBlock('```\n', '\n```', '代码块')
      break
    case 'ul':
      makeList('- ')
      break
    case 'ol':
      makeList('1. ')
      break
    case 'taskList':
      makeList('- [ ] ')
      break
    case 'link':
      insertLink()
      break
    case 'hr':
      api.insertAtCursor('\n\n---\n\n')
      break
  }
}

function wrapBlock(prefix: string, placeholder: string, suffix?: string) {
  const api = ensureEditMode()
  if (!api) return
  const ta = api.getTextarea()
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end) || placeholder

  if (suffix !== undefined) {
    api.wrapSelection(prefix, suffix, placeholder)
  } else {
    const lines = selected
      .split('\n')
      .map((line: string) => prefix + line)
      .join('\n')
    ta.value = ta.value.substring(0, start) + lines + ta.value.substring(end)
    ta.focus()
    ta.selectionStart = start
    ta.selectionEnd = start + lines.length
    api.syncFromTextarea()
  }
}

function makeList(prefix: string) {
  const api = ensureEditMode()
  if (!api) return
  const ta = api.getTextarea()
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end) || '列表项'
  const lines = selected
    .split('\n')
    .map((line: string) => prefix + line)
    .join('\n')
  const insertion = `\n${lines}\n`
  ta.value = ta.value.substring(0, start) + insertion + ta.value.substring(end)
  ta.focus()
  ta.selectionStart = ta.selectionEnd = start + insertion.length
  api.syncFromTextarea()
}

function insertLink() {
  const api = ensureEditMode()
  if (!api) return
  const ta = api.getTextarea()
  if (!ta) return

  const url = window.prompt('请输入链接 URL:', 'https://')
  if (url === null) return
  const text = window.prompt('请输入链接文本 (可选):', '') || url
  api.insertAtCursor(`[${text}](${url})`)
}

function onHeadingChange(e: Event) {
  const target = e.target as HTMLSelectElement
  const value = target.value
  target.value = ''
  if (!value) return

  const api = ensureEditMode()
  if (!api) return
  const ta = api.getTextarea()
  if (!ta) return

  const start = ta.selectionStart
  const val = ta.value
  const lineStart = val.lastIndexOf('\n', start - 1) + 1
  const lineEnd = val.indexOf('\n', start)
  const actualLineEnd = lineEnd === -1 ? val.length : lineEnd
  const currentLine = val.substring(lineStart, actualLineEnd)
  const match = currentLine.match(/^(#{1,6})\s?(.*)$/)
  const lineContent = match ? match[2] : currentLine

  let prefix = ''
  if (value === 'h1') prefix = '# '
  else if (value === 'h2') prefix = '## '
  else if (value === 'h3') prefix = '### '
  else if (value === 'h4') prefix = '#### '
  else if (value === 'h5') prefix = '##### '
  else if (value === 'h6') prefix = '###### '

  const newLine = prefix + lineContent
  ta.value = val.substring(0, lineStart) + newLine + val.substring(actualLineEnd)
  ta.focus()
  api.syncFromTextarea()
}

function insertImage() {
  fileInputRef.value?.click()
}

async function handleImageFile(e: Event) {
  const api = ensureEditMode()
  if (!api) return
  const target = e.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  const imagesMarkdown: string[] = []

  for (const file of Array.from(files)) {
    const base64 = await readFileAsBase64(file)
    imagesMarkdown.push(`\n![${file.name}](${base64})\n`)
  }

  api.insertAtCursor(imagesMarkdown.join(''))
  target.value = ''
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function insertTable() {
  const api = ensureEditMode()
  if (!api) return

  const rows = Math.max(1, tableRows.value)
  const cols = Math.max(1, tableCols.value)

  let table = '\n'
  const headerCells: string[] = []
  const separatorCells: string[] = []
  const bodyCells: string[][] = []

  for (let j = 0; j < cols; j++) {
    headerCells.push(' ')
    separatorCells.push('---')
  }

  for (let i = 0; i < rows - 1; i++) {
    const row: string[] = []
    for (let j = 0; j < cols; j++) {
      row.push(' ')
    }
    bodyCells.push(row)
  }

  table += `| ${headerCells.join(' | ')} |\n`
  table += `| ${separatorCells.join(' | ')} |\n`
  for (const row of bodyCells) {
    table += `| ${row.join(' | ')} |\n`
  }

  api.insertAtCursor(table)
  showTableDialog.value = false
}

async function onExportHtml() {
  if (!store.activeTabId) return
  const doc = store.getDocument(store.activeTabId)
  if (!doc) return
  const success = await exportToHtml(doc.content)
  if (!success) {
    console.error('Export HTML failed')
  }
}

async function onExportPdf() {
  if (!store.activeTabId) return
  const doc = store.getDocument(store.activeTabId)
  if (!doc) return
  const success = await exportToPdf(doc.content)
  if (!success) {
    console.error('Export PDF failed')
  }
}

watch(isHovered, (hovered) => {
  if (hovered) {
    cancelHideTimer()
  } else {
    const el = getEditorEl()
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mouseY = lastMouseY
    if (mouseY !== undefined && (mouseY < rect.top || mouseY > rect.bottom)) {
      startHideTimer()
    }
  }
})

let lastMouseY = 0

onMounted(() => {
  window.addEventListener('mousemove', (e) => {
    lastMouseY = e.clientY
    handleMouseMove(e)
  })
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  opacity: 0;
  animation: toolbar-fade-in 0.2s ease forwards;
}

@keyframes toolbar-fade-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
  margin: 0 4px;
}

.tb-btn {
  background: transparent;
  color: var(--text-primary);
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  min-width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.tb-btn:hover {
  background: var(--bg-tertiary);
  color: var(--accent);
}

.tb-btn.active {
  background: var(--accent);
  color: #fff;
}

.tb-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
}

.tb-select {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  cursor: pointer;
  height: 30px;
  outline: none;
}

.tb-select:hover {
  border-color: var(--accent);
}

.table-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.table-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.table-dialog h4 {
  margin-bottom: 16px;
  font-size: 15px;
}

.table-size {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.table-size label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.table-size input {
  width: 60px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.table-size input:focus {
  border-color: var(--accent);
}

.table-preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 16px;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow-x: auto;
}

.table-preview-row {
  display: flex;
  gap: 2px;
}

.table-preview-cell {
  width: 40px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--bg-primary);
}

.table-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.table-actions button {
  padding: 6px 16px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.table-actions button:hover {
  background: var(--bg-primary);
}

.table-actions button.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.table-actions button.primary:hover {
  filter: brightness(1.1);
}

.export-dropdown {
  position: relative;
  display: flex;
}

.export-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  min-width: 120px;
  z-index: 1100;
  display: none;
}

.export-dropdown:hover .export-menu {
  display: block;
}

.export-item {
  display: block;
  width: 100%;
  padding: 6px 14px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.export-item:hover {
  background: var(--bg-tertiary);
  color: var(--accent);
}
</style>