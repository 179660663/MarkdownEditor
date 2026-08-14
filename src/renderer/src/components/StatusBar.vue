<template>
  <footer class="statusbar">
    <div class="statusbar-left">
      <span class="file-name">{{ fileName }}</span>
      <span class="save-status" :class="{ dirty: isDirty }">
        {{ isDirty ? '● 未保存' : '● 已保存' }}
      </span>
    </div>
    <div class="statusbar-center">
      <span class="stat-item">
        <span class="stat-value">{{ chineseChars }}</span> 字
      </span>
      <span class="stat-divider">|</span>
      <span class="stat-item">
        <span class="stat-value">{{ englishWords }}</span> 词
      </span>
    </div>
    <div class="statusbar-right">
      <span class="stat-item">
        共 <span class="stat-value">{{ totalChars }}</span> 字符
      </span>
      <span class="stat-divider">|</span>
      <span class="stat-item">
        阅读约 <span class="stat-value">{{ readingTimeMinutes }}</span> 分钟
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { countWords } from '../utils/exporter'

const props = defineProps<{
  content: string
  fileName: string
  isDirty: boolean
}>()

const stats = computed(() => countWords(props.content))

const chineseChars = computed(() => stats.value.chineseChars)
const englishWords = computed(() => stats.value.englishWords)
const totalChars = computed(() => stats.value.totalChars)
const readingTimeMinutes = computed(() => stats.value.readingTimeMinutes)
</script>

<style scoped>
.statusbar {
  height: 24px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  user-select: none;
}

.statusbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.save-status {
  font-size: 10px;
  color: #6a9955;
}

.save-status.dirty {
  color: #ffcc00;
}

.statusbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.statusbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.stat-value {
  color: var(--text-primary);
  font-weight: 500;
}

.stat-divider {
  color: var(--border);
}
</style>