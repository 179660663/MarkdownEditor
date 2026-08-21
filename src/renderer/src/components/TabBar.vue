<template>
  <div class="tab-bar">
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: tab.id === activeId, dragging: dragIndex === index }"
      :draggable="true"
      :title="tab.title"
      @click="$emit('update:activeId', tab.id)"
      @contextmenu.prevent="openContextMenu($event, tab.id)"
      @dragstart="onDragStart(index, $event)"
      @dragover.prevent
      @drop="onDrop(index, $event)"
      @dragend="onDragEnd"
    >
      <span class="tab-title">{{ tab.title }}</span>
      <span v-if="tab.isDirty" class="tab-dirty-dot"></span>
      <button
        class="tab-close"
        @click.stop="$emit('close-tab', tab.id)"
      >×</button>
    </div>

    <button class="tab-new" title="新建文件" @click="$emit('new-tab')">+</button>

    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="tab-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-item" @click="handleClose(contextMenu.tabId)">关闭当前</div>
        <div class="context-item" @click="handleCloseOthers(contextMenu.tabId)">关闭其他</div>
        <div class="context-item" @click="handleCloseAll">关闭全部</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

interface Tab {
  id: string
  title: string
  isDirty: boolean
}

const props = defineProps<{
  tabs: Tab[]
  activeId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:activeId', id: string): void
  (e: 'close-tab', id: string): void
  (e: 'new-tab'): void
  (e: 'close-other-tabs', id: string): void
  (e: 'close-all-tabs'): void
  (e: 'move-tab', from: number, to: number): void
}>()

const dragIndex = ref(-1)

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  tabId: ''
})

function openContextMenu(e: MouseEvent, tabId: string) {
  contextMenu.visible = true
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  contextMenu.tabId = tabId
}

function closeContextMenu() {
  contextMenu.visible = false
}

function handleClose(tabId: string) {
  emit('close-tab', tabId)
  closeContextMenu()
}

function handleCloseOthers(tabId: string) {
  emit('close-other-tabs', tabId)
  closeContextMenu()
}

function handleCloseAll() {
  emit('close-all-tabs')
  closeContextMenu()
}

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDrop(toIndex: number, e: DragEvent) {
  e.preventDefault()
  const fromIndex = dragIndex.value
  if (fromIndex !== -1 && fromIndex !== toIndex) {
    emit('move-tab', fromIndex, toIndex)
  }
  dragIndex.value = -1
}

function onDragEnd() {
  dragIndex.value = -1
}

function onClickOutside(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (!el.closest('.tab-context-menu') && contextMenu.visible) {
    closeContextMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
  min-height: 36px;
  overflow-x: auto;
  flex-shrink: 0;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  max-width: 180px;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
  margin-right: 2px;
}

.tab-item:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.tab-item.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  border-bottom-color: var(--bg-primary);
  position: relative;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
}

.tab-item.dragging {
  opacity: 0.5;
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 130px;
}

.tab-dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffcc00;
  flex-shrink: 0;
}

.tab-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 3px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.tab-close:hover {
  background: rgba(255, 80, 80, 0.2);
  color: #ff5050;
}

.tab-new {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 10px;
  border-radius: 4px;
  margin-left: 4px;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.tab-new:hover {
  background: var(--bg-tertiary);
  color: var(--accent);
}

.tab-context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  padding: 3px 0;
  min-width: 100px;
  z-index: 3000;
}

.context-item {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
}

.context-item:hover {
  background: var(--bg-tertiary);
}
</style>