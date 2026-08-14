<template>
  <aside v-show="visible" class="outline-sidebar">
    <div class="outline-header">
      <span class="outline-title">大纲</span>
      <div class="outline-actions">
        <button
          class="outline-btn"
          :title="allCollapsed ? '全部展开' : '全部折叠'"
          @click="toggleAll"
        >
          {{ allCollapsed ? '⊞' : '⊟' }}
        </button>
        <button class="outline-btn" title="隐藏侧边栏" @click="close">⟨</button>
      </div>
    </div>

    <div class="outline-content">
      <div v-if="headings.length === 0" class="outline-empty">
        暂无标题
      </div>
      <div
        v-for="(heading, index) in headings"
        :key="index"
        class="outline-item"
        :class="[`level-${heading.level}`, { active: activeIndex === index }]"
      >
        <div
          class="outline-entry"
          @click="jumpTo(heading)"
        >
          <button
            v-if="hasChildren(index)"
            class="outline-toggle"
            @click.stop="toggleItem(index)"
          >
            {{ collapsedIndices.has(index) ? '▸' : '▾' }}
          </button>
          <span v-else class="outline-toggle-placeholder"></span>
          <span class="outline-text" :title="heading.text">{{ heading.text }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MarkdownIt from 'markdown-it'

interface Heading {
  level: number
  text: string
  line: number
  index: number
}

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'jump-to-heading', heading: Heading): void
}>()

const visible = ref(true)
const collapsedIndices = ref<Set<number>>(new Set())
const activeIndex = ref(-1)

const md = new MarkdownIt()

const headings = computed<Heading[]>(() => {
  const tokens = md.parse(props.content, {})
  const result: Heading[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'heading_open' && /^h[1-6]$/.test(token.tag)) {
      const level = parseInt(token.tag.charAt(1))
      const inlineToken = tokens[i + 1]
      if (inlineToken && inlineToken.type === 'inline') {
        let text = ''
        for (const child of inlineToken.children || []) {
          if (child.type === 'text' || child.type === 'image') {
            text += child.content || child.meta?.alt || ''
          }
        }
        result.push({
          level,
          text: text || '无标题',
          line: token.map ? token.map[0] : 0,
          index: result.length
        })
      }
    }
  }

  return result
})

const allCollapsed = computed(() => {
  return headings.value.length > 0 && collapsedIndices.value.size >= headings.value.length
})

function hasChildren(index: number): boolean {
  const current = headings.value[index]
  if (!current) return false
  const next = headings.value[index + 1]
  return next !== undefined && next.level > current.level
}

function toggleItem(index: number) {
  if (collapsedIndices.value.has(index)) {
    collapsedIndices.value.delete(index)
  } else {
    collapsedIndices.value.add(index)
  }
}

function toggleAll() {
  if (allCollapsed.value) {
    collapsedIndices.value.clear()
  } else {
    collapsedIndices.value = new Set(headings.value.map((_, i) => i))
  }
}

function jumpTo(heading: Heading) {
  activeIndex.value = headings.value.findIndex((h) => h.line === heading.line)
  emit('jump-to-heading', heading)
}

function close() {
  visible.value = false
  emit('close')
}

function setActiveByLine(line: number) {
  let closestIdx = -1
  for (let i = 0; i < headings.value.length; i++) {
    if (headings.value[i].line <= line) {
      closestIdx = i
    } else {
      break
    }
  }
  if (closestIdx !== -1) {
    activeIndex.value = closestIdx
  }
}

watch(
  () => props.content,
  () => {
    activeIndex.value = -1
  }
)

defineExpose({
  setActiveByLine,
  visible
})
</script>

<style scoped>
.outline-sidebar {
  width: 220px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.outline-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.outline-actions {
  display: flex;
  gap: 4px;
}

.outline-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
}

.outline-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.outline-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.outline-empty {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.outline-item {
  font-size: 12px;
}

.outline-item.level-1 .outline-entry { padding-left: 12px; font-weight: 600; }
.outline-item.level-2 .outline-entry { padding-left: 20px; }
.outline-item.level-3 .outline-entry { padding-left: 28px; }
.outline-item.level-4 .outline-entry { padding-left: 36px; color: var(--text-muted); }
.outline-item.level-5 .outline-entry { padding-left: 44px; color: var(--text-muted); }
.outline-item.level-6 .outline-entry { padding-left: 52px; color: var(--text-muted); }

.outline-entry {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid transparent;
}

.outline-entry:hover {
  background: var(--bg-tertiary);
}

.outline-item.active .outline-entry {
  background: var(--bg-tertiary);
  border-left-color: var(--accent);
  color: var(--accent);
}

.outline-toggle {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 9px;
  padding: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.outline-toggle-placeholder {
  width: 14px;
  flex-shrink: 0;
}

.outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
</style>