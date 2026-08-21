<template>
  <teleport to="body">
    <div class="pref-overlay" @click.self="emit('close')">
      <div class="pref-dialog">
        <div class="pref-header">
          <span class="pref-title">偏好设置</span>
          <button class="pref-close" title="关闭" @click="emit('close')">✕</button>
        </div>
        <div class="pref-body">
          <aside class="pref-sidebar">
            <div
              class="pref-nav-item"
              :class="{ active: activeNav === 'general' }"
              @click="activeNav = 'general'"
            >
              <Setting class="nav-icon" />
              常规
            </div>
            <div
              class="pref-nav-item"
              :class="{ active: activeNav === 'shortcuts' }"
              @click="activeNav = 'shortcuts'"
            >
              <Key class="nav-icon" />
              快捷键
            </div>
            <div
              class="pref-nav-item"
              :class="{ active: activeNav === 'image' }"
              @click="activeNav = 'image'"
            >
              <Picture class="nav-icon" />
              图像
            </div>
            <div
              class="pref-nav-item"
              :class="{ active: activeNav === 'update' }"
              @click="activeNav = 'update'"
            >
              <Refresh class="nav-icon" />
              关于与更新
            </div>
          </aside>
          <section class="pref-content">
            <template v-if="activeNav === 'general'">
              <h3 class="pref-section-title">常规</h3>

              <div class="pref-field">
                <label class="pref-label">文件浏览</label>
                <div class="about-row">
                  <span class="about-hint">显示隐藏文件或文件夹（如 .git、.vscode）</span>
                  <label class="switch">
                    <input type="checkbox" :checked="showHiddenFiles" @change="saveShowHiddenFiles" />
                    <span class="switch-slider"></span>
                  </label>
                </div>
              </div>
            </template>

            <template v-else-if="activeNav === 'shortcuts'">
              <h3 class="pref-section-title">快捷键</h3>
              <div class="shortcut-list">
                <div v-for="item in shortcuts" :key="item.keys" class="shortcut-row">
                  <span class="shortcut-keys">{{ item.keys }}</span>
                  <span class="shortcut-desc">{{ item.desc }}</span>
                </div>
              </div>
            </template>

            <template v-else-if="activeNav === 'image'">
              <h3 class="pref-section-title">图像</h3>

              <div class="pref-field">
                <label class="pref-label">插入图片时...</label>
                <select v-model="imageSaveMode" class="pref-select" @change="saveConfig">
                  <option value="assets">复制图片到 ./assets 文件夹</option>
                  <option value="filename-assets">复制图片到 ./${filename}.assets 文件夹</option>
                  <option value="custom">复制图片到指定路径</option>
                  <option value="base64">嵌入 Base64（不保存文件）</option>
                </select>
              </div>

              <div v-if="imageSaveMode === 'custom'" class="pref-field">
                <label class="pref-label">图片保存位置</label>
                <div class="pref-path-row">
                  <input
                    v-model="imageSavePath"
                    type="text"
                    class="pref-input"
                    placeholder="绝对路径、相对路径或带占位符的路径（如 ./images、./${filename}/assets、./${date}）"
                    @change="saveConfig"
                  />
                  <button class="pref-browse-btn" @click="browseFolder">浏览...</button>
                </div>
              </div>

              <p class="pref-hint" v-html="hintText">
              </p>
            </template>

            <template v-else>
              <h3 class="pref-section-title">关于与更新</h3>

              <div class="pref-field">
                <label class="pref-label">当前版本</label>
                <span class="about-version">v{{ appVersion }}</span>
              </div>

              <div class="pref-field">
                <label class="pref-label">自动检查更新</label>
                <div class="about-row">
                  <span class="about-hint">启动后自动检查新版本</span>
                  <label class="switch">
                    <input type="checkbox" :checked="autoCheckUpdate" @change="saveAutoCheckUpdate" />
                    <span class="switch-slider"></span>
                  </label>
                </div>
              </div>

              <div class="pref-field">
                <button class="pref-browse-btn" @click="checkUpdate" :disabled="isUpdating">
                  {{ isUpdating ? '检查中...' : '检查更新' }}
                </button>
              </div>

              <div v-if="updateStatusText" class="update-status" :class="updateStatusClass">
                {{ updateStatusText }}
              </div>

              <div v-if="updateState === 'downloading'" class="update-progress">
                <div class="update-progress-bar">
                  <div class="update-progress-fill" :style="{ width: downloadPercent + '%' }"></div>
                </div>
                <span class="update-progress-text">{{ downloadPercent }}%</span>
              </div>

              <button v-if="updateState === 'downloaded'" class="pref-restart-btn" @click="restartInstall">
                重启并安装
              </button>

              <p class="pref-hint">更新将从 GitHub Releases 获取最新版本，下载完成后可立即安装，或在下次启动时自动安装。</p>
            </template>
          </section>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { Picture, Refresh, Setting, Key } from '@element-plus/icons-vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '../stores/editor'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useEditorStore()

const activeNav = ref<'general' | 'shortcuts' | 'image' | 'update'>('general')
const showHiddenFiles = ref(false)
const imageSaveMode = ref<'assets' | 'filename-assets' | 'custom' | 'base64'>('assets')
const imageSavePath = ref('')

// 快捷键列表
const shortcuts = [
  { keys: 'Ctrl + N', desc: '新建文件' },
  { keys: 'Ctrl + O', desc: '打开文件' },
  { keys: 'Ctrl + Shift + O', desc: '打开文件夹' },
  { keys: 'Ctrl + Shift + E', desc: '切换预览/编辑模式' },
  { keys: 'Ctrl + Shift + I', desc: '打开 DevTools 调试工具' },
  { keys: 'Ctrl + S', desc: '保存' },
  { keys: 'Ctrl + Shift + S', desc: '另存为' },
  { keys: 'Ctrl + F', desc: '打开搜索框' },
  { keys: 'Ctrl + H', desc: '打开替换框' },
  { keys: 'Ctrl + W', desc: '关闭当前文件' },
  { keys: 'Ctrl + ,', desc: '打开偏好设置' }
]

// 更新相关状态
const appVersion = ref('')
const autoCheckUpdate = ref(true)
const updateState = ref<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle')
const updateStatusText = ref('')
const downloadPercent = ref(0)
const isUpdating = computed(() => updateState.value === 'checking' || updateState.value === 'downloading')
const updateStatusClass = computed(() => {
  if (updateState.value === 'error') return 'error'
  if (updateState.value === 'not-available') return 'ok'
  if (updateState.value === 'downloaded') return 'ok'
  return ''
})

const hintText = computed(() => {
  switch (imageSaveMode.value) {
    case 'assets':
      return '粘贴的图片将保存到文档所在目录下的 assets 文件夹，并以相对路径插入。'
    case 'filename-assets':
      return '粘贴的图片将保存到文档所在目录下的「文档名.assets」文件夹，并以相对路径插入。'
    case 'custom':
      return '粘贴的图片将保存到上方指定的文件夹。可点击「浏览」选择文件夹，也可手动输入路径。<br/>支持占位符：<br/>&emsp;&emsp;${filename}（文档名）<br/>&emsp;&emsp;${date}（YYYY-MM-DD）<br/>&emsp;&emsp;${datetime}（YYYY-MM-DD HH-mm-ss）<br/>&emsp;&emsp;${YYYY}/${MM}/${DD}（年/月/日）<br/>示例：<br/>&emsp;&emsp;./${filename}/assets<br/>&emsp;&emsp;./images/${date}<br/>&emsp;&emsp;D:\\Images\\${YYYY}\\${MM}'
    case 'base64':
      return '粘贴的图片将以 Base64 形式直接嵌入文档，不会生成图片文件。'
    default:
      return ''
  }
})

function handleUpdateStatus(data: { status: string; payload?: unknown }) {
  switch (data.status) {
    case 'checking-for-update':
      updateState.value = 'checking'
      updateStatusText.value = '正在检查更新...'
      break
    case 'update-available':
      updateState.value = 'available'
      updateStatusText.value = '发现新版本，正在下载...'
      break
    case 'update-not-available':
      updateState.value = 'not-available'
      updateStatusText.value = '当前已是最新版本'
      break
    case 'download-progress': {
      const p = data.payload as { percent: number }
      updateState.value = 'downloading'
      downloadPercent.value = Math.round(p.percent)
      updateStatusText.value = '正在下载更新...'
      break
    }
    case 'update-downloaded':
      updateState.value = 'downloaded'
      downloadPercent.value = 100
      updateStatusText.value = '新版本已下载完成'
      break
    case 'error':
      updateState.value = 'error'
      updateStatusText.value = '检查更新失败：' + String(data.payload || '未知错误')
      break
  }
}

async function checkUpdate() {
  updateState.value = 'checking'
  updateStatusText.value = '正在检查更新...'
  const result = await window.electronAPI.checkForUpdates()
  if (!result.ok) {
    updateState.value = 'error'
    updateStatusText.value = '检查更新失败：' + (result.message || '未知错误')
  }
}

async function restartInstall() {
  await window.electronAPI.quitAndInstall()
}

async function saveAutoCheckUpdate(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  autoCheckUpdate.value = checked
  try {
    await window.electronAPI.setConfig('autoCheckUpdate', checked)
  } catch (err) {
    console.warn('[Preferences] Failed to save autoCheckUpdate:', err)
  }
}

async function saveShowHiddenFiles(e: Event) {
  // 直接从事件读取复选框状态，避免 v-model 更新时机导致的滞后
  const checked = (e.target as HTMLInputElement).checked
  showHiddenFiles.value = checked
  try {
    await window.electronAPI.setConfig('showHiddenFiles', checked)
    // 刷新所有已打开文件夹，使隐藏文件设置立即生效
    for (const folder of store.folders) {
      await store.reloadFolderTree(folder.id)
    }
  } catch (err) {
    console.warn('[Preferences] Failed to save showHiddenFiles:', err)
  }
}

async function loadConfig() {
  try {
    const config = await window.electronAPI.getConfig()
    const showHidden = config.showHiddenFiles as boolean | undefined
    if (typeof showHidden === 'boolean') {
      showHiddenFiles.value = showHidden
    }
    const mode = config.imageSaveMode as string | undefined
    if (mode === 'assets' || mode === 'filename-assets' || mode === 'custom' || mode === 'base64') {
      imageSaveMode.value = mode
    }
    imageSavePath.value = (config.imageSavePath as string | undefined) || ''

    const autoUpdate = config.autoCheckUpdate as boolean | undefined
    if (typeof autoUpdate === 'boolean') {
      autoCheckUpdate.value = autoUpdate
    }
    appVersion.value = await window.electronAPI.getAppVersion()
  } catch (err) {
    console.warn('[Preferences] Failed to load config:', err)
  }
}

async function saveConfig() {
  try {
    await window.electronAPI.setConfig('imageSaveMode', imageSaveMode.value)
    await window.electronAPI.setConfig('imageSavePath', imageSavePath.value)
  } catch (err) {
    console.warn('[Preferences] Failed to save config:', err)
  }
}

async function browseFolder() {
  try {
    const path = await window.electronAPI.openFolder()
    if (path) {
      imageSavePath.value = path
      await saveConfig()
    }
  } catch (err) {
    console.error('[Preferences] Failed to browse folder:', err)
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

let removeUpdateListener: (() => void) | null = null

onMounted(() => {
  loadConfig()
  removeUpdateListener = window.electronAPI.onUpdateStatus(handleUpdateStatus)
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  removeUpdateListener?.()
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.pref-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.pref-dialog {
  width: 700px;
  max-width: 90vw;
  height: 520px;
  max-height: 85vh;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pref-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.pref-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.pref-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pref-close:hover {
  background: #e81123;
  color: #fff;
}

.pref-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pref-sidebar {
  width: 150px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
  padding: 12px 8px;
}

.pref-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: 13px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--text-secondary);
}

.pref-nav-item.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 600;
}

.pref-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

.pref-section-title {
  margin: 0 0 18px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.pref-field {
  margin-bottom: 16px;
}

.pref-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.pref-select,
.pref-input {
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 5px;
  outline: none;
  box-sizing: border-box;
}

.pref-select:focus,
.pref-input:focus {
  border-color: var(--accent);
}

.pref-path-row {
  display: flex;
  gap: 8px;
}

.pref-path-row .pref-input {
  flex: 1;
}

.pref-browse-btn {
  padding: 7px 14px;
  font-size: 13px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
}

.pref-browse-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.pref-hint {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
}

.shortcut-keys {
  color: var(--accent, #569cd6);
  font-family: Consolas, 'Cascadia Code', monospace;
  font-size: 12px;
  white-space: nowrap;
}

.shortcut-desc {
  color: var(--text-secondary);
  white-space: nowrap;
}

.about-version {
  font-size: 16px;
  font-weight: 600;
  color: var(--accent, #569cd6);
}

.about-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.about-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* 开关 */
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--bg-tertiary, #2d2d2d);
  border: 1px solid var(--border);
  border-radius: 22px;
  transition: background 0.2s, border-color 0.2s;
}

.switch-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform 0.2s, background 0.2s;
}

.switch input:checked + .switch-slider {
  background: var(--accent, #569cd6);
  border-color: var(--accent, #569cd6);
}

.switch input:checked + .switch-slider::before {
  transform: translateX(18px);
  background: #fff;
}

.pref-browse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.update-status {
  margin: 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.update-status.error {
  color: #f44747;
}

.update-status.ok {
  color: #6a9955;
}

.update-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}

.update-progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary, #2d2d2d);
  border-radius: 4px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: var(--accent, #569cd6);
  border-radius: 4px;
  transition: width 0.3s;
}

.update-progress-text {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: right;
}

.pref-restart-btn {
  margin-top: 8px;
  padding: 8px 18px;
  font-size: 13px;
  background: var(--accent, #569cd6);
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.pref-restart-btn:hover {
  filter: brightness(1.1);
}
</style>

<style>
/* 侧边栏导航图标尺寸（全局样式，确保生效） */
.pref-nav-item .nav-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
