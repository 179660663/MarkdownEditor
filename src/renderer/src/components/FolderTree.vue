<template>
  <div class="folder-tree">
    <div v-if="nodes.length === 0" class="empty-hint">
      该文件夹下没有 Markdown 文件
    </div>
    <template v-else>
      <div v-for="node in nodes" :key="node.path" class="tree-item">
        <div
          v-if="node.isDirectory"
          class="tree-row directory"
          @click="handleDirectoryClick(node)"
          @contextmenu.prevent="handleContextMenu($event, node)"
        >
          <button
            v-if="hasChildren(node)"
            class="tree-chevron"
            @click.stop="toggleNode(node.path)"
          >
            {{ isExpanded(node.path) ? '▾' : '▸' }}
          </button>
          <span v-else class="tree-chevron-placeholder"></span>
          <span class="tree-icon">{{ isExpanded(node.path) ? '📂' : '📁' }}</span>
          <span class="tree-label" :title="node.name">{{ node.name }}</span>
          <span v-if="hasChildren(node)" class="tree-count">{{ countFiles(node) }}</span>
        </div>
        <div
          v-else
          class="tree-row file"
          :class="{ active: activePath === node.path }"
          @click="$emit('select', node)"
          @contextmenu.prevent="handleContextMenu($event, node)"
        >
          <span class="tree-chevron-placeholder"></span>
          <span class="tree-icon">📄</span>
          <span class="tree-label" :title="node.name">{{ node.name }}</span>
        </div>

        <div
          v-if="node.isDirectory && isExpanded(node.path) && node.children"
          class="tree-children"
        >
          <FolderTree
            :nodes="node.children"
            :level="(level ?? 0) + 1"
            :active-path="activePath"
            :expanded="expanded"
            :base-path="basePath"
            @select="$emit('select', $event)"
            @toggle="$emit('toggle', $event)"
          />
        </div>
      </div>
    </template>

    <teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="openFileLocation">
          <span class="context-menu-icon">📂</span>
          <span>打开文件位置</span>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onBeforeUnmount } from 'vue'

defineOptions({ name: 'FolderTree' })

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

const props = defineProps<{
  nodes: FileNode[]
  level?: number
  activePath?: string | null
  expanded: Set<string>
  basePath: string
}>()

const emit = defineEmits<{
  (e: 'select', node: FileNode): void
  (e: 'toggle', path: string): void
}>()

const contextMenu = reactive<{
  visible: boolean
  x: number
  y: number
  node: FileNode | null
}>({
  visible: false,
  x: 0,
  y: 0,
  node: null
})

function handleContextMenu(event: MouseEvent, node: FileNode) {
  contextMenu.visible = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.node = node
}

function closeContextMenu() {
  contextMenu.visible = false
  contextMenu.node = null
}

function openFileLocation() {
  if (contextMenu.node) {
    window.electronAPI.showItemInFolder(props.basePath, contextMenu.node.path)
  }
  closeContextMenu()
}

function onClickOutside() {
  closeContextMenu()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeyDown)
})

function hasChildren(node: FileNode): boolean {
  return Boolean(node.isDirectory && node.children && node.children.length > 0)
}

function isExpanded(path: string): boolean {
  return props.expanded.has(path)
}

function countFiles(node: FileNode): string {
  if (!node.children) return ''
  let count = 0
  for (const child of node.children) {
    if (!child.isDirectory) count++
  }
  return count > 0 ? `(${count})` : ''
}

function toggleNode(path: string) {
  emit('toggle', path)
}

function handleDirectoryClick(node: FileNode) {
  if (hasChildren(node)) {
    toggleNode(node.path)
  }
}
</script>

<style scoped>
.folder-tree {
  font-size: 12px;
}

.tree-item {
  user-select: none;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 3px;
  margin: 1px 0;
}

.tree-row:hover {
  background: var(--bg-tertiary);
}

.tree-row.directory {
  cursor: pointer;
  font-weight: 500;
}

.tree-row.file.active {
  background: var(--bg-tertiary);
  border-left: 2px solid var(--accent);
  color: var(--accent);
}

.tree-chevron {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 9px;
  padding: 0;
  width: 14px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 2px;
}

.tree-chevron:hover {
  color: var(--accent);
  background: rgba(0, 0, 0, 0.05);
}

.tree-chevron-placeholder {
  width: 14px;
  flex-shrink: 0;
}

.tree-icon {
  font-size: 12px;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.tree-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tree-count {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
  margin-right: 4px;
}

.tree-children {
  margin-left: 18px;
  padding-left: 10px;
  border-left: 1px solid var(--border);
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px;
  text-align: center;
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
