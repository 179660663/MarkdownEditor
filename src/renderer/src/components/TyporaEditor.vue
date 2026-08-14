<template>
  <div
    class="typora-editor"
    ref="editorContainer"
    @click.self="onContainerClick"
  >
    <!-- 预览层（渲染后的 HTML） -->
    <div
      v-show="mode === 'preview'"
      class="editor-overlay"
      ref="overlay"
      v-html="renderedContent"
      @click="onPreviewClick"
    ></div>

    <!-- 源码编辑层（带格式化样式的 Markdown 文本） -->
    <textarea
      v-show="mode === 'edit'"
      ref="textarea"
      class="editor-textarea"
      :value="content"
      spellcheck="false"
      @input="handleInput"
      @scroll="handleTextareaScroll"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @drop="handleDrop"
      @dragover.prevent
      @focus="onTextareaFocus"
      @blur="onTextareaBlur"
    ></textarea>

    <!-- 滚动同步用的隐藏 overlay（仅在编辑模式存在但不可见，用于同步滚动位置） -->
    <div
      v-show="mode === 'edit'"
      class="editor-overlay editor-overlay--sync"
      ref="syncOverlay"
      v-html="renderedContent"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { renderMarkdown } from '../utils/markdown'
import { useToolbar } from '../composables/useToolbar'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'save-requested'): void
  (e: 'save-as-requested'): void
  (e: 'focus-toolbar'): void
  (e: 'blur-toolbar'): void
  (e: 'mode-change', mode: 'edit' | 'preview'): void
}>()

const { wrapSelectionInTextarea, insertAtCursorInTextarea } = useToolbar()

const editorContainer = ref<HTMLElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const syncOverlay = ref<HTMLElement | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)

const content = ref(props.modelValue)
const renderedContent = ref('')

// 编辑模式：edit(显示 Markdown 源码) / preview(显示渲染预览)
const mode = ref<'edit' | 'preview'>('preview')

let renderTimer: ReturnType<typeof setTimeout> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let isRapidTyping = false
let typingTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)

  if (isRapidTyping) {
    // 快速输入时使用较长延迟，减少渲染频率
    renderTimer = setTimeout(() => {
      renderedContent.value = renderMarkdown(content.value)
    }, 300)
  } else {
    // 停顿后立即渲染
    renderedContent.value = renderMarkdown(content.value)
  }

  if (typingTimer) clearTimeout(typingTimer)
  isRapidTyping = true
  typingTimer = setTimeout(() => {
    isRapidTyping = false
    renderedContent.value = renderMarkdown(content.value)
  }, 200)
}

function enterEditMode() {
  if (mode.value === 'edit') return
  mode.value = 'edit'
  emit('mode-change', 'edit')
  nextTick(() => {
    if (textarea.value) {
      textarea.value.focus()
    }
  })
}

function enterPreviewMode() {
  if (mode.value === 'preview') return
  mode.value = 'preview'
  emit('mode-change', 'preview')
  nextTick(() => {
    if (overlay.value && textarea.value) {
      overlay.value.scrollTop = textarea.value.scrollTop
    }
  })
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    // 停止输入 800ms 后切换回预览模式
    if (!isTextareaFocused) {
      enterPreviewMode()
    }
  }, 800)
}

let isTextareaFocused = false

function onTextareaFocus() {
  isTextareaFocused = true
  emit('focus-toolbar')
}

function onTextareaBlur() {
  isTextareaFocused = false
  emit('blur-toolbar')
}

function onContainerClick() {
  enterEditMode()
}

function onPreviewClick(e: MouseEvent) {
  e.stopPropagation()
  enterEditMode()
}

function handleInput() {
  if (!textarea.value) return
  content.value = textarea.value.value
  emit('update:modelValue', content.value)
  // 输入时切到编辑模式
  mode.value = 'edit'
  emit('mode-change', 'edit')
  scheduleRender()
  resetIdleTimer()
}

function handleTextareaScroll() {
  // 同步隐藏 overlay 的滚动位置（用于大纲定位等）
  if (syncOverlay.value && textarea.value) {
    syncOverlay.value.scrollTop = textarea.value.scrollTop
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!textarea.value) return
  // 任何按键都重置空闲计时器
  resetIdleTimer()

  const ta = textarea.value

  if (e.key === 'Tab') {
    e.preventDefault()
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = ta.value

    if (e.shiftKey) {
      if (start !== end) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const before = value.substring(0, lineStart)
        const selection = value.substring(lineStart, end)
        const after = value.substring(end)
        const newSelection = selection.replace(/^( {1,4}|\t)/gm, '')
        ta.value = before + newSelection + after
        ta.selectionStart = lineStart
        ta.selectionEnd = lineStart + newSelection.length
      } else {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const before = value.substring(0, lineStart)
        const after = value.substring(end)
        const lineContent = value.substring(lineStart, end)
        const newLineContent = lineContent.replace(/^( {1,4}|\t)/, '')
        ta.value = before + newLineContent + after
        ta.selectionStart = lineStart
        ta.selectionEnd = lineStart + newLineContent.length
      }
    } else {
      const insertion = '  '
      ta.value = value.substring(0, start) + insertion + value.substring(end)
      ta.selectionStart = ta.selectionEnd = start + insertion.length
    }

    content.value = ta.value
    emit('update:modelValue', content.value)
    scheduleRender()
    return
  }

  if (e.key === 'Enter') {
    const start = ta.selectionStart
    const value = ta.value
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const currentLine = value.substring(lineStart, start)

    const taskMatch = currentLine.match(/^(\s*)([-*])\s+\[[ xX]\]\s/)
    if (taskMatch) {
      e.preventDefault()
      const indent = taskMatch[1]
      const marker = taskMatch[2]
      const newLine = `\n${indent}${marker} [ ] `
      ta.value = value.substring(0, start) + newLine + value.substring(ta.selectionEnd)
      const newPos = start + newLine.length
      ta.selectionStart = ta.selectionEnd = newPos
      content.value = ta.value
      emit('update:modelValue', content.value)
      scheduleRender()
      return
    }

    const listMatch = currentLine.match(/^(\s*)([-*+>])\s/)
    if (listMatch) {
      e.preventDefault()
      const indent = listMatch[1]
      const marker = listMatch[2]
      if (currentLine.trim() === marker) {
        const lineEnd = value.indexOf('\n', start)
        const endPos = lineEnd === -1 ? value.length : lineEnd
        ta.value = value.substring(0, lineStart) + value.substring(endPos + 1)
        ta.selectionStart = ta.selectionEnd = lineStart
      } else {
        const newLine = `\n${indent}${marker} `
        ta.value = value.substring(0, start) + newLine + value.substring(ta.selectionEnd)
        const newPos = start + newLine.length
        ta.selectionStart = ta.selectionEnd = newPos
      }
      content.value = ta.value
      emit('update:modelValue', content.value)
      scheduleRender()
      return
    }
  }

  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const key = e.key.toLowerCase()
    if (key === 'b' || key === 'i' || key === 'k' || key === 'e') {
      e.preventDefault()
      wrapSelection(ta, key)
      return
    }
    if (key === 's') {
      e.preventDefault()
      emit('save-requested')
      return
    }
    if (key === 'd') {
      e.preventDefault()
      selectNextOccurrence(ta)
      return
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
    const key = e.key.toLowerCase()
    if (key === 's') {
      e.preventDefault()
      emit('save-as-requested')
      return
    }
    if (key === 'v') {
      e.preventDefault()
      const text = ta.value.substring(ta.selectionStart, ta.selectionEnd)
      navigator.clipboard.readText().then((clipText) => {
        insertAtCursor(ta, clipText)
      })
      return
    }
  }

  if (e.altKey && !e.ctrlKey && !e.shiftKey) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveLine(ta, -1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveLine(ta, 1)
      return
    }
  }

  if (e.key === 'Home' && !e.shiftKey) {
    e.preventDefault()
    const start = ta.selectionStart
    const value = ta.value
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    ta.selectionStart = ta.selectionEnd = lineStart
    return
  }

  if (e.key === 'End' && !e.shiftKey) {
    e.preventDefault()
    const start = ta.selectionStart
    const value = ta.value
    const lineEnd = value.indexOf('\n', start)
    const endPos = lineEnd === -1 ? value.length : lineEnd
    ta.selectionStart = ta.selectionEnd = endPos
    return
  }
}

function selectNextOccurrence(ta: HTMLTextAreaElement) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = ta.value
  const selected = value.substring(start, end)

  if (!selected) {
    const wordStart = value.lastIndexOf(' ', start - 1) + 1
    const wordEnd = value.indexOf(' ', start)
    const word = value.substring(wordStart, wordEnd === -1 ? value.length : wordEnd)
    if (word) {
      const nextIndex = value.indexOf(word, end)
      if (nextIndex !== -1) {
        ta.focus()
        ta.selectionStart = nextIndex
        ta.selectionEnd = nextIndex + word.length
        return
      }
    }
    return
  }

  const nextIndex = value.indexOf(selected, end)
  if (nextIndex !== -1) {
    ta.focus()
    ta.selectionStart = nextIndex
    ta.selectionEnd = nextIndex + selected.length
  }
}

function moveLine(ta: HTMLTextAreaElement, direction: number) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = ta.value

  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = value.indexOf('\n', end)
  const actualLineEnd = lineEnd === -1 ? value.length : lineEnd
  const currentLine = value.substring(lineStart, actualLineEnd)

  if (direction < 0 && lineStart === 0) return
  if (direction > 0 && actualLineEnd >= value.length) return

  const targetLineStart = direction < 0
    ? value.lastIndexOf('\n', lineStart - 2) + 1
    : actualLineEnd + 1
  const targetLineEnd = direction < 0
    ? lineStart - 1
    : value.indexOf('\n', actualLineEnd + 1)
  const actualTargetLineEnd = targetLineEnd === -1 ? value.length : targetLineEnd

  const targetLine = value.substring(targetLineStart, actualTargetLineEnd)

  const before = value.substring(0, Math.min(targetLineStart, lineStart))
  const after = value.substring(Math.max(actualLineEnd, actualTargetLineEnd) + (direction < 0 ? 1 : 0))

  let newContent: string
  let cursorOffset: number

  if (direction < 0) {
    newContent = before + currentLine + '\n' + targetLine + after
    cursorOffset = targetLineStart
  } else {
    newContent = before + targetLine + '\n' + currentLine + after
    cursorOffset = targetLineStart + targetLine.length + 1
  }

  ta.value = newContent
  ta.focus()
  ta.selectionStart = cursorOffset
  ta.selectionEnd = cursorOffset + (end - start)
  content.value = ta.value
  emit('update:modelValue', content.value)
  scheduleRender()
}

function wrapSelection(ta: HTMLTextAreaElement, key: string) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = ta.value
  const selected = value.substring(start, end)

  let before = ''
  let after = ''
  let placeholder = ''

  switch (key) {
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

  const text = selected || placeholder
  ta.value = value.substring(0, start) + before + text + after + value.substring(end)
  const newStart = start + before.length
  const newEnd = newStart + text.length
  ta.focus()
  ta.selectionStart = newStart
  ta.selectionEnd = newEnd

  content.value = ta.value
  emit('update:modelValue', content.value)
  scheduleRender()
}

function handlePaste(e: ClipboardEvent) {
  if (!textarea.value) return

  const items = e.clipboardData?.items
  if (!items) return

  const imageFiles: File[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        imageFiles.push(file)
      }
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault()
    insertImages(imageFiles)
    return
  }

  const text = e.clipboardData?.getData('text/plain')
  if (text !== undefined) {
    e.preventDefault()
    insertAtCursor(textarea.value, text)
  }
}

async function insertImages(files: File[]) {
  const imagesMarkdown: string[] = []

  for (const file of files) {
    const base64 = await readFileAsBase64(file)
    imagesMarkdown.push(`\n![${file.name || 'image'}](${base64})\n`)
  }

  if (textarea.value) {
    insertAtCursor(textarea.value, imagesMarkdown.join(''))
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function handleDrop(e: DragEvent) {
  if (!textarea.value) return
  e.preventDefault()

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const imageFiles: File[] = []

  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      imageFiles.push(file)
    } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type === 'text/markdown') {
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        insertAtCursor(textarea.value!, text)
      }
      reader.readAsText(file)
    }
  }

  if (imageFiles.length > 0) {
    insertImages(imageFiles)
  }
}

function insertAtCursor(ta: HTMLTextAreaElement, text: string) {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  ta.value = ta.value.substring(0, start) + text + ta.value.substring(end)
  ta.selectionStart = ta.selectionEnd = start + text.length
  content.value = ta.value
  emit('update:modelValue', content.value)
  scheduleRender()
}

function focusTextarea() {
  enterEditMode()
}

watch(
  () => props.modelValue,
  (val) => {
    if (val !== content.value) {
      content.value = val
      scheduleRender()
    }
  }
)

onMounted(() => {
  renderedContent.value = renderMarkdown(content.value)
  // 初始显示预览模式
  mode.value = 'preview'
})

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
  if (idleTimer) clearTimeout(idleTimer)
  if (typingTimer) clearTimeout(typingTimer)
})

defineExpose({
  focusTextarea,
  getContent: () => content.value,
  getTextarea: () => textarea.value,
  getSelectedText: () => {
    if (!textarea.value) return ''
    const ta = textarea.value
    return ta.value.substring(ta.selectionStart, ta.selectionEnd)
  },
  wrapSelection: (before: string, after: string, placeholder: string) => {
    if (!textarea.value) return
    const ta = textarea.value
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = ta.value
    const selected = value.substring(start, end)
    const text = selected || placeholder
    ta.value = value.substring(0, start) + before + text + after + value.substring(end)
    const newStart = start + before.length
    const newEnd = newStart + text.length
    ta.focus()
    ta.selectionStart = newStart
    ta.selectionEnd = newEnd
    content.value = ta.value
    emit('update:modelValue', content.value)
    scheduleRender()
  },
  insertAtCursor: (text: string) => {
    if (!textarea.value) return
    insertAtCursor(textarea.value, text)
  },
  insertImages,
  getMode: () => mode.value,
  setMode: (m: 'edit' | 'preview') => {
    mode.value = m
    emit('mode-change', m)
  },
  syncFromTextarea: () => {
    if (!textarea.value) return
    content.value = textarea.value.value
    emit('update:modelValue', content.value)
    scheduleRender()
  }
})
</script>

<style scoped>
.typora-editor {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: text;
}

.editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24px;
  overflow-y: auto;
  pointer-events: auto;
  font-family: 'Segoe UI', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: var(--editor-text);
  background: transparent;
  white-space: pre-wrap;
  word-wrap: break-word;
  cursor: text;
}

.editor-overlay--sync {
  visibility: hidden;
  pointer-events: none;
  z-index: 0;
}

.editor-overlay :deep(h1),
.editor-overlay :deep(h2),
.editor-overlay :deep(h3),
.editor-overlay :deep(h4),
.editor-overlay :deep(h5),
.editor-overlay :deep(h6) {
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

.editor-overlay :deep(h1) { font-size: 2em; border-bottom: 1px solid var(--editor-h1-border); padding-bottom: 0.3em; }
.editor-overlay :deep(h2) { font-size: 1.5em; border-bottom: 1px solid var(--editor-h2-border); padding-bottom: 0.3em; }
.editor-overlay :deep(h3) { font-size: 1.25em; }
.editor-overlay :deep(h4) { font-size: 1em; }
.editor-overlay :deep(h5) { font-size: 0.9em; }
.editor-overlay :deep(h6) { font-size: 0.85em; color: var(--editor-h6); }

.editor-overlay :deep(p) {
  margin: 0.8em 0;
}

.editor-overlay :deep(a) {
  color: var(--editor-link);
  text-decoration: none;
}

.editor-overlay :deep(a:hover) {
  text-decoration: underline;
}

.editor-overlay :deep(ul),
.editor-overlay :deep(ol) {
  padding-left: 2em;
  margin: 0.8em 0;
}

.editor-overlay :deep(li) {
  margin: 0.3em 0;
}

.editor-overlay :deep(li input[type='checkbox']) {
  margin-right: 0.4em;
}

.editor-overlay :deep(blockquote) {
  border-left: 4px solid var(--quote-border);
  padding: 0.5em 1em;
  margin: 1em 0;
  color: var(--editor-quote-text);
  background: var(--editor-quote-bg);
  border-radius: 0 4px 4px 0;
}

.editor-overlay :deep(code) {
  background: var(--editor-code-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.9em;
  color: var(--editor-code-text);
}

.editor-overlay :deep(pre) {
  background: var(--editor-pre-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 1em 0;
  line-height: 1.5;
}

.editor-overlay :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.9em;
  color: var(--editor-text);
}

.editor-overlay :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.editor-overlay :deep(th),
.editor-overlay :deep(td) {
  border: 1px solid var(--editor-border);
  padding: 8px 12px;
  text-align: left;
}

.editor-overlay :deep(th) {
  background: var(--editor-table-header);
}

.editor-overlay :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

.editor-overlay :deep(hr) {
  border: none;
  border-top: 1px solid var(--editor-hr);
  margin: 2em 0;
}

.editor-overlay :deep(.custom-container) {
  padding: 1em 1.5em;
  margin: 1em 0;
  border-radius: 4px;
  border-left: 4px solid;
}

.editor-overlay :deep(.custom-container .container-title) {
  font-weight: 600;
  margin-bottom: 0.5em;
}

.editor-overlay :deep(.custom-container.warning) {
  background: rgba(255, 193, 7, 0.1);
  border-left-color: #ffc107;
  color: #d4a017;
}

.editor-overlay :deep(.custom-container.tip) {
  background: rgba(40, 167, 69, 0.1);
  border-left-color: #28a745;
  color: #3cb371;
}

.editor-overlay :deep(.custom-container.info) {
  background: rgba(14, 99, 156, 0.1);
  border-left-color: #0e639c;
  color: #569cd6;
}

.editor-overlay :deep(.custom-container.danger) {
  background: rgba(220, 53, 69, 0.1);
  border-left-color: #dc3545;
  color: #f44747;
}

.editor-overlay :deep(.footnote-ref) {
  font-size: 0.85em;
  vertical-align: super;
}

.editor-overlay :deep(.footnotes) {
  font-size: 0.9em;
  color: var(--text-muted);
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid var(--border);
}

.editor-overlay :deep(.katex-display) {
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5em 0;
}

.editor-textarea {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24px;
  background: transparent;
  color: var(--editor-text);
  caret-color: var(--caret);
  border: none;
  outline: none;
  resize: none;
  font-family: 'Cascadia Code', 'Consolas', 'Segoe UI', 'Microsoft YaHei', monospace;
  font-size: 15px;
  line-height: 1.7;
  tab-size: 2;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-y: auto;
  pointer-events: auto;
  z-index: 2;
}

.editor-textarea::selection {
  background: var(--selection);
}
</style>
