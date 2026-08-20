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
            <div class="pref-nav-item active">🖼 图像</div>
          </aside>
          <section class="pref-content">
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
          </section>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const imageSaveMode = ref<'assets' | 'filename-assets' | 'custom' | 'base64'>('assets')
const imageSavePath = ref('')

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

async function loadConfig() {
  try {
    const config = await window.electronAPI.getConfig()
    const mode = config.imageSaveMode as string | undefined
    if (mode === 'assets' || mode === 'filename-assets' || mode === 'custom' || mode === 'base64') {
      imageSaveMode.value = mode
    }
    imageSavePath.value = (config.imageSavePath as string | undefined) || ''
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

onMounted(() => {
  loadConfig()
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
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
</style>
