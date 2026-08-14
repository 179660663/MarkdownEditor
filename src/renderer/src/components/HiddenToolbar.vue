<template>
  <transition name="fade">
    <div v-show="visible" class="hidden-toolbar" @mouseenter="cancelHideTimer" @mouseleave="startHideTimer">
      <div class="toolbar-group">
        <button @click="wrap('b')" title="加粗 (Ctrl+B)">B</button>
        <button @click="wrap('i')" title="斜体 (Ctrl+I)">I</button>
        <button @click="wrap('k')" title="行内代码 (Ctrl+K)">Code</button>
        <button @click="wrap('e')" title="公式 (Ctrl+E)">∑</button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button @click="insertHeading" title="标题">H</button>
        <button @click="insert('quote', '> ')" title="引用">❝</button>
        <button @click="insertList('ul')" title="无序列表">•</button>
        <button @click="insertList('ol')" title="有序列表">1.</button>
        <button @click="insertTable" title="表格">⊞</button>
        <button @click="insert('hr', '\n---\n')" title="分割线">―</button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button @click="insertLink" title="链接 (Ctrl+Shift+K)">🔗</button>
        <button @click="insertImage" title="图片">🖼</button>
      </div>
    </div>
  </transition>
  <input
    ref="fileInputRef"
    type="file"
    accept="image/*"
    style="display: none"
    @change="handleImageFile"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useToolbar } from '../composables/useToolbar'

const props = defineProps<{
  textareaRef: HTMLTextAreaElement | null
}>()

const emit = defineEmits<{
  (e: 'format', content: string): void
}>()

const {
  wrapSelectionInTextarea,
  insertAtCursorInTextarea,
  insertHeading: headingUtil,
  insertTable: tableUtil,
  insertLink: linkUtil
} = useToolbar()

const visible = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

let hideTimer: ReturnType<typeof setTimeout> | null = null

const TOP_REGION_HEIGHT = 40
const AUTO_HIDE_DELAY = 800 // 单位：毫秒

function handleMouseMove(e: MouseEvent) {
  if (e.clientY <= TOP_REGION_HEIGHT) {
    cancelHideTimer()
    if (!visible.value) {
      visible.value = true
    }
  } else if (visible.value) {
    startHideTimer()
  }
}

function startHideTimer() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    visible.value = false
  }, AUTO_HIDE_DELAY)
}

function cancelHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function getTa(): HTMLTextAreaElement | null {
  return props.textareaRef
}

function wrap(type: string) {
  const ta = getTa()
  if (!ta) return

  let before = ''
  let after = ''
  let placeholder = ''

  switch (type) {
    case 'b':
      before = '**'
      after = '**'
      placeholder = '粗体文本'
      break
    case 'i':
      before = '*'
      after = '*'
      placeholder = '斜体文本'
      break
    case 'k':
      before = '`'
      after = '`'
      placeholder = '代码'
      break
    case 'e':
      before = '$$'
      after = '$$'
      placeholder = '公式'
      break
    default:
      return
  }

  const newContent = wrapSelectionInTextarea(ta, before, after, placeholder)
  emit('format', newContent)
}

function insertHeading() {
  const ta = getTa()
  if (!ta) return
  const newContent = headingUtil(ta)
  emit('format', newContent)
}

function insert(type: string, value: string) {
  const ta = getTa()
  if (!ta) return

  if (type === 'quote') {
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const text = ta.value.substring(start, end) || '引用内容'
    const lines = text
      .split('\n')
      .map((line) => `${value}${line}`)
      .join('\n')
    ta.value = ta.value.substring(0, start) + lines + ta.value.substring(end)
    ta.focus()
    ta.selectionStart = start
    ta.selectionEnd = start + lines.length
    emit('format', ta.value)
  } else {
    const newContent = insertAtCursorInTextarea(ta, value)
    emit('format', newContent)
  }
}

function insertList(type: string) {
  const ta = getTa()
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = ta.value.substring(start, end)
  const prefix = type === 'ul' ? '- ' : '1. '
  const lines = (selected || '列表项')
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
  const insertion = `\n${lines}\n`
  ta.value = ta.value.substring(0, start) + insertion + ta.value.substring(end)
  ta.focus()
  ta.selectionStart = ta.selectionEnd = start + insertion.length
  emit('format', ta.value)
}

function insertTable() {
  const ta = getTa()
  if (!ta) return

  const rowsStr = window.prompt('请输入行数 (不含表头):', '3')
  if (rowsStr === null) return
  const colsStr = window.prompt('请输入列数:', '3')
  if (colsStr === null) return

  const rows = Math.max(1, parseInt(rowsStr, 10) + 1)
  const cols = Math.max(1, parseInt(colsStr, 10))
  const newContent = tableUtil(ta, rows, cols)
  emit('format', newContent)
}

function insertLink() {
  const ta = getTa()
  if (!ta) return

  const url = window.prompt('请输入链接 URL:', 'https://')
  if (url === null) return
  const text = window.prompt('请输入链接文本 (可选):', '')
  const newContent = linkUtil(ta, url, text || undefined)
  emit('format', newContent)
}

function insertImage() {
  fileInputRef.value?.click()
}

function handleImageFile(e: Event) {
  const ta = getTa()
  if (!ta) return

  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const base64 = reader.result as string
    const imgMarkdown = `\n![${file.name}](${base64})\n`
    const newContent = insertAtCursorInTextarea(ta, imgMarkdown)
    emit('format', newContent)
  }
  reader.readAsDataURL(file)
  target.value = ''
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
.hidden-toolbar {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bg-secondary, #2d2d30);
  border: 1px solid var(--border, #3e3e42);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border, #3e3e42);
  margin: 0 4px;
}

.hidden-toolbar button {
  background: transparent;
  color: var(--text-primary, #cccccc);
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  min-width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.hidden-toolbar button:hover {
  background: var(--bg-tertiary, #3e3e42);
  color: var(--accent, #007acc);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>