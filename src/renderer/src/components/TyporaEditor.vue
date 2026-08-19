<template>
  <div
    class="typora-editor"
    ref="editorContainer"
  >
    <!-- 预览层（渲染后的 HTML） -->
    <div
      v-show="mode === 'preview'"
      class="editor-overlay"
      ref="overlay"
      v-html="renderedContent"
      @dblclick="onPreviewClick"
      @click="onPreviewMouseClick"
      @mousedown.prevent="onPreviewMouseDown"
      @scroll="onOverlayScroll"
    ></div>

    <!-- 源码编辑层（带格式化样式的 Markdown 文本） -->
    <div class="textarea-wrapper">
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
      <div
        v-if="flashLineTop >= 0"
        class="jump-line-indicator"
        :style="{ top: flashLineTop + 'px', height: flashLineHeight + 'px' }"
      ></div>
    </div>

    <!-- 滚动同步用的隐藏 overlay（仅在编辑模式存在但不可见，用于同步滚动位置） -->
    <div
      v-show="mode === 'edit'"
      class="editor-overlay editor-overlay--sync"
      ref="syncOverlay"
      v-html="renderedContent"
    ></div>

    <!-- 模式切换按钮 -->
    <div class="mode-switch">
      <button
        class="mode-btn"
        :class="{ active: mode === 'preview' }"
        title="预览模式 (Ctrl+Shift+E)"
        @click.stop="switchToPreview"
      >
        <span class="mode-icon">👁</span>
        <span class="mode-label">预览</span>
      </button>
      <button
        class="mode-btn"
        :class="{ active: mode === 'edit' }"
        title="编辑模式 (Ctrl+Shift+E)"
        @click.stop="switchToEdit"
      >
        <span class="mode-icon">✏️</span>
        <span class="mode-label">编辑</span>
      </button>
      <button
        class="mode-lock-btn"
        :class="{ locked: modeLocked }"
        :title="modeLocked ? '已锁定模式（点击解锁）' : '锁定模式（防止自动切换）'"
        @click.stop="toggleLock"
      >
        <span class="lock-icon">{{ modeLocked ? '🔒' : '🔓' }}</span>
      </button>
    </div>

    <!-- 回到顶部按钮 -->
    <button
      v-show="showBackToTop"
      class="back-to-top-btn"
      title="回到顶部"
      @click="scrollToTop"
    >
      ↑
    </button>

    <!-- 跳转提示 -->
    <Transition name="fade">
      <div v-if="showJumpHint" class="jump-hint">{{ showJumpHint }}</div>
    </Transition>

    <!-- 图片预览模态框 -->
    <Teleport to="body">
      <Transition name="image-preview">
        <div
          v-if="previewImage.show"
          class="image-preview-modal"
          @click="closeImagePreview"
        >
          <div class="image-preview-backdrop"></div>
          <img
            :src="previewImage.src"
            :alt="previewImage.alt"
            class="image-preview-img"
            @click.stop
          />
          <button class="image-preview-close" @click="closeImagePreview">×</button>
          <div class="image-preview-info">{{ previewImage.alt }}</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { renderMarkdown } from '../utils/markdown'
import { useToolbar } from '../composables/useToolbar'

const props = defineProps<{
  modelValue: string
  editorMode: 'edit' | 'preview'
  filePath?: string
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

const showBackToTop = ref(false)

// 图片预览状态
const previewImage = ref({
  show: false,
  src: '',
  alt: ''
})

/**
 * Get the directory of the current file (base path for resolving relative images)
 */
function getBasePath(): string | undefined {
  if (!props.filePath) return undefined
  const parts = props.filePath.split(/[\\/]/)
  parts.pop() // Remove filename
  return parts.join('/')
}

/**
 * Render markdown with image path resolution
 */
function renderMarkdownContent(content: string): string {
  const basePath = getBasePath()
  return renderMarkdown(content, basePath)
}

function checkScrollTop() {
  let scrollTop = 0
  if (mode.value === 'preview' && overlay.value) {
    scrollTop = overlay.value.scrollTop
  } else if (mode.value === 'edit' && textarea.value) {
    scrollTop = textarea.value.scrollTop
  }
  showBackToTop.value = scrollTop > 200
}

function scrollToTop() {
  if (mode.value === 'preview' && overlay.value) {
    overlay.value.scrollTo({ top: 0, behavior: 'smooth' })
  } else if (mode.value === 'edit' && textarea.value) {
    textarea.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function onOverlayScroll() {
  checkScrollTop()
}

const mode = ref<'edit' | 'preview'>(props.editorMode)
// 用户手动锁定模式时，不自动切换
const modeLocked = ref(false)

let renderTimer: ReturnType<typeof setTimeout> | null = null
let isRapidTyping = false
let typingTimer: ReturnType<typeof setTimeout> | null = null

let isJumping = false

watch(() => props.editorMode, (newMode) => {
  mode.value = newMode
  if (newMode === 'edit') {
    nextTick(() => {
      if (textarea.value && !isJumping) {
        textarea.value.focus()
      }
    })
  } else {
    if (textarea.value) textarea.value.blur()
    renderedContent.value = renderMarkdownContent(content.value)
  }
})

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)

  if (isRapidTyping) {
    // 快速输入时使用较长延迟，减少渲染频率
    renderTimer = setTimeout(() => {
      renderedContent.value = renderMarkdownContent(content.value)
    }, 300)
  } else {
    // 停顿后立即渲染
    renderedContent.value = renderMarkdownContent(content.value)
  }

  if (typingTimer) clearTimeout(typingTimer)
  isRapidTyping = true
  typingTimer = setTimeout(() => {
    isRapidTyping = false
    renderedContent.value = renderMarkdownContent(content.value)
  }, 200)
}

function getCurrentSourceLine(): number {
  if (mode.value === 'preview' && overlay.value) {
    const container = overlay.value
    const scrollTop = container.scrollTop
    const elements = container.querySelectorAll('[data-line]')
    let lastLine = 0
    for (const el of Array.from(elements)) {
      const htmlEl = el as HTMLElement
      const elTop = getElementDocTop(htmlEl, container)
      if (elTop <= scrollTop + 3) {
        const line = parseInt(htmlEl.getAttribute('data-line') || '0', 10)
        if (line > lastLine) lastLine = line
      } else {
        break
      }
    }
    return lastLine
  }
  if (textarea.value) {
    const { lineHeight, paddingTop } = getTextareaMetrics()
    return Math.max(0, Math.floor((textarea.value.scrollTop - paddingTop) / lineHeight))
  }
  return 0
}

function getElementDocTop(el: HTMLElement, container: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = el
  while (node && node !== container) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

function scrollToSourceLine(line: number) {
  if (line <= 0) return
  if (mode.value === 'preview' && overlay.value) {
    const container = overlay.value
    const elements = container.querySelectorAll('[data-line]')
    let bestMatchTop = 0
    for (const el of Array.from(elements)) {
      const htmlEl = el as HTMLElement
      const dataLine = parseInt(htmlEl.getAttribute('data-line') || '0', 10)
      if (dataLine <= line) {
        bestMatchTop = getElementDocTop(htmlEl, container)
      } else {
        break
      }
    }
    container.scrollTop = bestMatchTop
  } else if (mode.value === 'edit' && textarea.value) {
    const { lineHeight, paddingTop } = getTextareaMetrics()
    textarea.value.scrollTop = Math.max(0, paddingTop + line * lineHeight)
  }
}

function enterEditMode(silent = false) {
  if (mode.value === 'edit') return
  
  const savedLine = getCurrentSourceLine()
  
  mode.value = 'edit'
  emit('mode-change', 'edit')
  if (!silent) {
    setTimeout(() => {
      scrollToSourceLine(savedLine)
      if (textarea.value) {
        setCursorToLine(savedLine)
        textarea.value.focus()
      }
      checkScrollTop()
    }, 50)
  }
}

function enterPreviewMode() {
  if (mode.value === 'preview') return
  
  const savedLine = getCurrentSourceLine()
  
  mode.value = 'preview'
  emit('mode-change', 'preview')
  if (textarea.value) {
    textarea.value.blur()
  }
  renderedContent.value = renderMarkdownContent(content.value)
  setTimeout(() => {
    scrollToSourceLine(savedLine)
    checkScrollTop()
  }, 50)
}

function toggleMode() {
  if (mode.value === 'edit') {
    enterPreviewMode()
  } else {
    enterEditMode()
  }
}

function switchToPreview() {
  setLockMode(true)
  enterPreviewMode()
}

function switchToEdit() {
  setLockMode(true)
  enterEditMode()
}

function toggleLock() {
  setLockMode(!modeLocked.value)
}

function setLockMode(locked: boolean) {
  modeLocked.value = locked
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

function onPreviewMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target) return

  const anchor = target.closest('a') as HTMLAnchorElement | null
  const href = anchor ? anchor.getAttribute('href') : null

  if (href && href.startsWith('#')) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }

  if (href && isExternalUrl(href)) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
      window.electronAPI.openExternal(href)
      return
    }
  } else if (!anchor) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
}

function isExternalUrl(href: string | null): href is string {
  if (!href) return false
  if (href.startsWith('#')) return false
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^file:\/\//i.test(href)
}

function onPreviewMouseClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target) return

  // 处理图片点击放大
  const img = target.closest('img') as HTMLImageElement | null
  if (img && mode.value === 'preview') {
    e.preventDefault()
    e.stopPropagation()
    openImagePreview(img)
    return
  }

  const anchor = target.closest('a') as HTMLAnchorElement | null
  if (!anchor) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }

  const href = anchor.getAttribute('href')
  if (!href) return

  if (href.startsWith('#')) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
    }
    return
  }

  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) {
    e.preventDefault()
    e.stopPropagation()
    window.electronAPI.openExternal(href)
    return
  }

  if (isExternalUrl(href)) {
    e.preventDefault()
    e.stopPropagation()
    window.electronAPI.openExternal(href)
  }
}

function onPreviewClick(e: MouseEvent) {
  e.stopPropagation()
  
  const target = e.target as HTMLElement
  const previewLayer = overlay.value
  
  if (previewLayer && target) {
    // 优先使用 data-line 属性精确定位
    const clickedElement = target.closest('[data-line]') as HTMLElement | null
    let targetLine = 0
    
    if (clickedElement && clickedElement.hasAttribute('data-line')) {
      // 使用 data-line 属性获取精确行号
      targetLine = parseInt(clickedElement.getAttribute('data-line') || '0', 10)
      
      // 根据点击位置在元素内的相对位置微调行号
      const clickY = e.clientY
      const rect = clickedElement.getBoundingClientRect()
      const elementHeight = rect.height
      const relativeY = elementHeight > 0 ? (clickY - rect.top) / elementHeight : 0
      
      // 如果点击在元素下半部分，可能需要向下偏移
      const contentLines = content.value.split('\n').length
      const elementApproxLines = Math.max(1, Math.ceil(elementHeight / 24))
      const lineOffset = Math.floor(relativeY * elementApproxLines)
      
      targetLine = Math.min(targetLine + lineOffset, contentLines - 1)
    } else {
      // 回退方案：使用位置比例估算
      const clickY = e.clientY
      const previewRect = previewLayer.getBoundingClientRect()
      const scrollTop = previewLayer.scrollTop
      const totalHeight = previewLayer.scrollHeight
      
      const clickRatio = totalHeight > 0 
        ? (clickY - previewRect.top + scrollTop) / totalHeight 
        : 0
      
      const totalLines = content.value.split('\n').length
      targetLine = Math.floor(clickRatio * totalLines)
    }
    
    // 确保行号在有效范围内
    const totalLines = content.value.split('\n').length
    targetLine = Math.max(0, Math.min(targetLine, totalLines - 1))
    
    // 切换到编辑模式
    mode.value = 'edit'
    emit('mode-change', 'edit')
    
    // 使用 setTimeout 确保 DOM 完全渲染后再定位光标
    setTimeout(() => {
      if (textarea.value) {
        positionCursorToLine(targetLine)
      }
    }, 30)
  } else {
    enterEditMode()
  }
}

function setCursorToLine(lineNumber: number) {
  if (!textarea.value) return
  
  const ta = textarea.value
  const lines = ta.value.split('\n')
  
  let charOffset = 0
  let lineEndOffset = 0
  for (let i = 0; i < lineNumber && i < lines.length; i++) {
    charOffset += lines[i].length + 1
  }
  if (lineNumber < lines.length) {
    lineEndOffset = charOffset + lines[lineNumber].length
  } else {
    lineEndOffset = charOffset
  }
  
  ta.focus()
  requestAnimationFrame(() => {
    ta.selectionStart = charOffset
    ta.selectionEnd = lineEndOffset
  })
}

// 用镜像 div 精确测量目标逻辑行的像素偏移（关键：textarea 开启了 pre-wrap，
// 长行会软换行成多个视觉行，"行号 × 行高"的算法必然错位，必须按真实排版测量）
function measureLineTopOffset(ta: HTMLTextAreaElement, lineIndex: number): number {
  if (lineIndex <= 0) return 0
  const computed = getComputedStyle(ta)
  const mirror = document.createElement('div')
  const s = mirror.style
  s.position = 'absolute'
  s.visibility = 'hidden'
  s.top = '0'
  s.left = '-9999px'
  s.boxSizing = 'content-box'
  // 内容区宽度 = clientWidth - 左右 padding（clientWidth 不含滚动条），保证换行点一致
  const pl = parseFloat(computed.paddingLeft) || 0
  const pr = parseFloat(computed.paddingRight) || 0
  s.width = `${ta.clientWidth - pl - pr}px`
  s.padding = '0'
  s.border = 'none'
  s.fontFamily = computed.fontFamily
  s.fontSize = computed.fontSize
  s.fontWeight = computed.fontWeight
  s.fontStyle = computed.fontStyle
  s.letterSpacing = computed.letterSpacing
  s.lineHeight = computed.lineHeight
  s.tabSize = computed.getPropertyValue('tab-size') || '2'
  s.whiteSpace = 'pre-wrap'
  s.wordWrap = 'break-word'
  s.overflowWrap = computed.overflowWrap
  s.wordBreak = computed.wordBreak

  const lines = ta.value.split('\n')
  const before = lines.slice(0, lineIndex).join('\n')
  mirror.textContent = before + '\n'
  // 标记元素落在目标行起点，其 offsetTop 即目标行的真实像素位置
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const offset = marker.offsetTop
  document.body.removeChild(mirror)
  return offset
}

let jumpScrollTop = -1

function positionCursorToLine(lineNumber: number) {
  if (!textarea.value) return

  const ta = textarea.value
  const lines = ta.value.split('\n')

  // lineNumber 是 1-indexed，光标定位到该行开头
  const targetLineIndex = Math.min(Math.max(lineNumber - 1, 0), lines.length - 1)
  let charOffset = 0
  for (let i = 0; i < targetLineIndex; i++) {
    charOffset += lines[i].length + 1
  }

  // 先设置光标（此时未聚焦，不会触发自动滚动）
  ta.selectionStart = charOffset
  ta.selectionEnd = charOffset

  const { lineHeight, paddingTop } = getTextareaMetrics()

  // 测量目标行的真实像素位置
  const lineTop = measureLineTopOffset(ta, targetLineIndex)

  // 聚焦但禁止浏览器自动滚动到光标，避免覆盖手动设置的 scrollTop
  ta.focus({ preventScroll: true })

  // 滚动使标题行位于可视区顶部
  jumpScrollTop = lineTop
  ta.scrollTop = lineTop

  // 高亮条按实际 scrollTop 反算，精确落在标题行
  // （文档末尾 scrollTop 被钳制时，高亮依然和标题同行）
  flashLineHeight.value = lineHeight
  flashLineTop.value = paddingTop + lineTop - ta.scrollTop
  setTimeout(() => {
    flashLineTop.value = -1
  }, 1500)
}

const showJumpHint = ref('')
let jumpHintTimer: ReturnType<typeof setTimeout> | null = null
const flashLineTop = ref(-1)
const flashLineHeight = ref(25.5)

function getTextareaMetrics(): { lineHeight: number; paddingTop: number } {
  const ta = textarea.value
  if (!ta) return { lineHeight: 25.5, paddingTop: 24 }
  const computed = getComputedStyle(ta)
  const fontSize = parseFloat(computed.fontSize) || 15
  const lineHeightVal = computed.lineHeight
  const lineHeight = lineHeightVal === 'normal'
    ? fontSize * 1.2
    : parseFloat(lineHeightVal) || fontSize * 1.7
  const paddingTop = parseFloat(computed.paddingTop) || 0
  return { lineHeight, paddingTop }
}

function getTextareaLineHeight(): number {
  return getTextareaMetrics().lineHeight
}

function highlightHeading(el: HTMLElement, lineNumber: number) {
  const computed = getComputedStyle(document.documentElement)
  const accent = computed.getPropertyValue('--accent').trim() || '#569cd6'
  
  const prevBg = el.style.backgroundColor
  const prevOutline = el.style.outline
  const prevColor = el.style.color
  
  el.style.backgroundColor = accent
  el.style.outline = `3px solid ${accent}`
  el.style.color = '#fff'
  el.style.transition = 'background-color 0.1s, color 0.1s, outline 0.1s'
  
  setTimeout(() => {
    el.style.backgroundColor = prevBg
    el.style.outline = `2px dashed ${accent}`
    el.style.color = prevColor
  }, 150)
  
  setTimeout(() => {
    el.style.backgroundColor = prevBg
    el.style.outline = prevOutline
    el.style.color = prevColor
    el.style.transition = ''
  }, 1200)

  showJumpHint.value = `已跳转到第 ${lineNumber} 行`
  if (jumpHintTimer) clearTimeout(jumpHintTimer)
  jumpHintTimer = setTimeout(() => {
    showJumpHint.value = ''
  }, 2000)
}

function jumpToLine(lineNumber: number, headingIndex?: number) {
  if (mode.value === 'preview') {
    const previewLayer = overlay.value
    if (!previewLayer) return
    
    // 如果有 headingIndex，使用 data-heading-id 查找（最可靠）
    if (headingIndex !== undefined) {
      const targetElement = previewLayer.querySelector(`[data-heading-id="${headingIndex}"]`) as HTMLElement | null
      if (targetElement) {
        // 留出 8px 上边距，让高亮框的 outline 能完整显示
        targetElement.style.scrollMarginTop = '8px'
        targetElement.scrollIntoView({ block: 'start', behavior: 'instant' })
        highlightHeading(targetElement, lineNumber)
        return
      }
    }
    
    // 最后按比例估算
    const totalLines = content.value.split('\n').length
    const ratio = totalLines > 0 ? lineNumber / totalLines : 0
    previewLayer.scrollTop = ratio * previewLayer.scrollHeight
  } else {
    // 编辑模式：定位到对应行
    positionCursorToLine(lineNumber)
  }
  
  showJumpHint.value = `已跳转到第 ${lineNumber} 行`
  if (jumpHintTimer) clearTimeout(jumpHintTimer)
  jumpHintTimer = setTimeout(() => {
    showJumpHint.value = ''
  }, 2000)
}

function handleInput() {
  if (!textarea.value) return
  content.value = textarea.value.value
  emit('update:modelValue', content.value)
  mode.value = 'edit'
  emit('mode-change', 'edit')
  scheduleRender()
}

function handleTextareaScroll() {
  if (syncOverlay.value && textarea.value) {
    syncOverlay.value.scrollTop = textarea.value.scrollTop
  }
  checkScrollTop()
  // 用户手动滚动时才隐藏高亮；程序设置 scrollTop 触发的 scroll 事件不清除
  if (
    flashLineTop.value >= 0 &&
    textarea.value &&
    Math.abs(textarea.value.scrollTop - jumpScrollTop) > 2
  ) {
    flashLineTop.value = -1
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!textarea.value) return

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

// 图片预览功能
function openImagePreview(img: HTMLImageElement) {
  previewImage.value = {
    show: true,
    src: img.src,
    alt: img.alt || '图片'
  }
  document.body.style.overflow = 'hidden'
}

function closeImagePreview() {
  previewImage.value.show = false
  document.body.style.overflow = ''
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

// Watch for filePath changes to re-resolve image paths
watch(
  () => props.filePath,
  () => {
    // Re-render when filePath changes to update image paths
    nextTick(() => {
      renderedContent.value = renderMarkdownContent(content.value)
    })
  }
)

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    toggleMode()
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    toggleLock()
  }
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if (e.shiftKey) {
      emit('save-as-requested')
    } else {
      emit('save-requested')
    }
  }
}

onMounted(() => {
  mode.value = props.editorMode
  renderedContent.value = renderMarkdownContent(content.value)
  if (props.editorMode === 'edit') {
    nextTick(() => {
      if (textarea.value) textarea.value.focus()
    })
  } else {
    if (textarea.value) textarea.value.blur()
  }
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
  if (typingTimer) clearTimeout(typingTimer)
  if (jumpHintTimer) clearTimeout(jumpHintTimer)
  window.removeEventListener('keydown', handleGlobalKeydown)
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
    if (m === 'edit') {
      enterEditMode()
    } else {
      enterPreviewMode()
    }
  },
  jumpToLine,
  toggleMode,
  setLockMode,
  isModeLocked: () => modeLocked.value,
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
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  cursor: zoom-in;
  display: block;
  margin: 1.5em auto;
}

.editor-overlay :deep(img:hover) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
}

.editor-overlay :deep(img.image-loading) {
  background: linear-gradient(90deg, var(--editor-bg) 25%, var(--hover-bg) 50%, var(--editor-bg) 75%);
  background-size: 200% 100%;
  animation: image-loading 1.5s ease-in-out infinite;
  min-height: 120px;
}

@keyframes image-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.editor-overlay :deep(img.image-error) {
  background: var(--editor-bg);
  border: 2px dashed var(--border);
  padding: 20px;
  min-height: 120px;
  position: relative;
}

.editor-overlay :deep(img.image-error)::after {
  content: '图片加载失败';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-muted);
  font-size: 14px;
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

.textarea-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 8px;
  pointer-events: none;
  overflow: hidden;
}

.textarea-wrapper .editor-textarea {
  pointer-events: auto;
}

.jump-line-indicator {
  position: absolute;
  left: 0;
  width: 3px;
  height: 25.5px;
  background: var(--accent, #569cd6);
  animation: indicator-flash 1.5s ease-out forwards;
  pointer-events: none;
  z-index: 10;
}

@keyframes indicator-flash {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
  }
}

/* 模式切换按钮 */
.mode-switch {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.mode-switch:hover {
  opacity: 1;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  background: var(--hover-bg);
  color: var(--editor-text);
}

.mode-btn.active {
  background: var(--accent);
  color: #fff;
}

.mode-icon {
  font-size: 14px;
}

.mode-label {
  font-weight: 500;
}

.mode-lock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-lock-btn:hover {
  background: var(--hover-bg);
}

.mode-lock-btn.locked {
  color: var(--accent);
}

.lock-icon {
  font-size: 14px;
}

.back-to-top-btn {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: var(--bg-tertiary, #4a4a4a);
  color: var(--text-primary, #fff);
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.15s;
}

.back-to-top-btn:hover {
  background: var(--accent, #4a9eff);
  transform: translateY(-2px);
}

.back-to-top-btn:active {
  transform: translateY(0);
}

.jump-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent, #569cd6);
  color: #fff;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 200;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}

/* 图片预览模态框 */
.image-preview-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.image-preview-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
}

.image-preview-img {
  position: relative;
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  cursor: zoom-out;
  z-index: 1;
}

.image-preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.image-preview-info {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  max-width: 80vw;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 2;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
}

/* 图片预览动画 */
.image-preview-enter-active,
.image-preview-leave-active {
  transition: all 0.3s ease;
}

.image-preview-enter-from .image-preview-backdrop,
.image-preview-leave-to .image-preview-backdrop {
  opacity: 0;
}

.image-preview-enter-from .image-preview-img,
.image-preview-leave-to .image-preview-img {
  opacity: 0;
  transform: scale(0.9);
}

.image-preview-enter-active .image-preview-img,
.image-preview-leave-active .image-preview-img {
  transition: all 0.3s ease;
}
</style>
