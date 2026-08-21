<template>
  <div class="folder-tree">
    <template v-if="nodes.length > 0">
      <div v-for="node in nodes" :key="node.path" class="tree-item">
        <div
          v-if="node.isDirectory"
          class="tree-row directory"
          @click="handleDirectoryClick(node)"
          @contextmenu.prevent.stop="handleContextMenu($event, node)"
        >
          <button
            v-if="hasChildren(node)"
            class="tree-chevron"
            @click.stop="toggleNode(node.path)"
          >
            {{ isExpanded(node.path) ? '▾' : '▸' }}
          </button>
          <span v-else class="tree-chevron-placeholder"></span>
          <span class="tree-icon">
            <el-icon v-if="isExpanded(node.path)" class="dropdown-icon"><FolderOpened /></el-icon>
            <el-icon v-else class="dropdown-icon"><Folder /></el-icon>
          </span> 
          <span class="tree-label" v-if="renamingPath !== node.path" :title="node.name">{{ node.name }}</span>
          <input
            v-else
            ref="renameInputEl"
            v-model="renameValue"
            class="tree-rename-input"
            autofocus
            @click.stop
            @keydown.enter.prevent="confirmRename(node)"
            @keydown.esc.prevent="cancelRename"
            @blur="confirmRename(node)"
          />
          <span v-if="hasChildren(node)" class="tree-count">{{ countFiles(node) }}</span>
        </div>
        <div
          v-else
          class="tree-row file"
          :class="{ active: activePath === node.path }"
          @click="$emit('select', node)"
          @contextmenu.prevent.stop="handleContextMenu($event, node)"
        >
          <span class="tree-chevron-placeholder"></span>
          <span class="tree-icon">📄</span>
          <span class="tree-label" v-if="renamingPath !== node.path" :title="node.name">{{ node.name }}</span>
          <input
            v-else
            ref="renameInputEl"
            v-model="renameValue"
            class="tree-rename-input"
            autofocus
            @click.stop
            @keydown.enter.prevent="confirmRename(node)"
            @keydown.esc.prevent="cancelRename"
            @blur="confirmRename(node)"
          />
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
            :rename-request="renameRequest"
            @select="$emit('select', $event)"
            @toggle="$emit('toggle', $event)"
            @refresh="$emit('refresh')"
            @renamed="$emit('renamed', $event)"
            @create-file="$emit('createFile', $event)"
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
        <div class="context-menu-item" v-if="contextMenu.node?.isDirectory" @click="createFileInFolder">
          <el-icon class="context-menu-icon">
            <DocumentAdd />
          </el-icon>
          <span>新建文件</span>
        </div>
        <div class="context-menu-item" v-if="contextMenu.node?.isDirectory" @click="createFolderInFolder">
          <el-icon class="context-menu-icon">
            <FolderAdd />
          </el-icon>
          <span>新建文件夹</span>
        </div>
        <div class="context-menu-item" @click="openFileLocation">
          <el-icon class="context-menu-icon">
            <FolderOpened />
          </el-icon>
          <span>打开文件位置</span>
        </div>
        <div class="context-menu-item" @click="startRename(contextMenu.node)">
          <el-icon class="context-menu-icon">
            <EditPen />
          </el-icon>
          <span>重命名</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" @click="deleteNode">
          <el-icon class="context-menu-icon">
            <Delete />
          </el-icon>
          <span>删除</span>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { Folder, FolderOpened, EditPen, DocumentAdd, FolderAdd, Delete } from '@element-plus/icons-vue'

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
  renameRequest?: { path: string; name: string; version: number } | null
}>()

const emit = defineEmits<{
  (e: 'select', node: FileNode): void
  (e: 'toggle', path: string): void
  (e: 'refresh'): void
  (e: 'renamed', payload: { oldPath: string; newPath: string }): void
  (e: 'createFile', dirRelPath: string): void
  (e: 'createFolder', dirRelPath: string): void
  (e: 'delete', payload: { relPath: string; isDirectory: boolean }): void
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

// 在当前文件夹节点下新建文件
function createFileInFolder() {
  if (contextMenu.node) {
    emit('createFile', contextMenu.node.path)
  }
  closeContextMenu()
}

// 在当前文件夹节点下新建文件夹
function createFolderInFolder() {
  if (contextMenu.node) {
    emit('createFolder', contextMenu.node.path)
  }
  closeContextMenu()
}

// 删除当前文件或文件夹
function deleteNode() {
  if (contextMenu.node) {
    emit('delete', { relPath: contextMenu.node.path, isDirectory: contextMenu.node.isDirectory })
  }
  closeContextMenu()
}

const renamingPath = ref<string | null>(null)
const renameValue = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function startRename(node: FileNode | null) {
  if (!node) return
  console.log('[FolderTree] startRename:', node.path)
  renamingPath.value = node.path
  renameValue.value = node.name
  contextMenu.visible = false
  contextMenu.node = null
  const focusRenameInput = () => {
    if (renameInputEl.value) {
      renameInputEl.value.scrollIntoView({ block: 'nearest' })
      renameInputEl.value.focus()
      renameInputEl.value.select()
    }
  }
  nextTick(focusRenameInput)
  // 兜底：延时再次聚焦，确保输入框真正获得焦点（如新建文件等异步流程后）
  setTimeout(() => {
    if (renamingPath.value === node.path) {
      focusRenameInput()
    }
  }, 80)
}

async function confirmRename(node: FileNode) {
  if (renamingPath.value !== node.path) return
  const newName = renameValue.value.trim()
  renamingPath.value = null
  if (!newName || newName === node.name) return
  const result = await window.electronAPI.renameItem(props.basePath, node.path, newName)
  if (result && result.ok) {
    if (result.oldPath && result.newPath) {
      emit('renamed', { oldPath: result.oldPath, newPath: result.newPath })
    }
    emit('refresh')
  } else {
    alert(result?.error || '重命名失败')
  }
}

function cancelRename() {
  renamingPath.value = null
}

// 外部请求进入行内重命名（新建文件后编辑文件名）
// immediate：嵌套目录的 FolderTree 实例可能在请求设置之后才挂载，挂载时需立即处理
watch(
  () => props.renameRequest,
  (req) => {
    if (!req) return
    // 仅当该节点属于当前实例的直接子级时才进入重命名（渲染该节点的实例才会生效）
    const node = props.nodes.find((n) => n.path === req.path)
    console.log('[FolderTree] renameRequest:', req.path, 'directChild:', !!node, 'nodes:', props.nodes.length)
    if (node) {
      startRename(node)
    } else {
      // 树刚刷新，节点可能尚未渲染，下一帧再尝试一次
      nextTick(() => {
        if (!props.renameRequest || props.renameRequest.version !== req.version) return
        const retryNode = props.nodes.find((n) => n.path === req.path)
        console.log('[FolderTree] renameRequest retry:', req.path, 'found:', !!retryNode)
        if (retryNode) startRename(retryNode)
      })
    }
  },
  { immediate: true }
)

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

.tree-rename-input {
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

.context-menu-item.danger {
  color: #e81123;
}

.context-menu-item.danger:hover {
  background: rgba(232, 17, 35, 0.12);
}

.context-menu-separator {
  height: 1px;
  background: var(--border);
  margin: 3px 6px;
}

.context-menu-icon {
  font-size: 13px;
  width: 16px;
  text-align: center;
}
</style>
