<template>
  <div class="theme-switcher">
    <button
      class="theme-btn"
      :title="currentTheme === 'dark' ? '深色' : currentTheme === 'light' ? '明亮' : 'Obsidian'"
      @click="toggleDropdown"
    >
      <span class="theme-icon">{{ currentTheme === 'dark' ? '🌙' : currentTheme === 'light' ? '☀️' : '🟣' }}</span>
      <span class="theme-label">{{ themeLabels[currentTheme] }}</span>
      <span class="dropdown-arrow">▾</span>
    </button>
    <div v-if="isOpen" class="theme-dropdown" @click.stop>
      <div
        v-for="theme in themeOptions"
        :key="theme.value"
        class="theme-option"
        :class="{ active: theme.value === currentTheme }"
        @click="handleSelect(theme.value)"
      >
        <span class="option-icon">{{ theme.icon }}</span>
        <span class="option-label">{{ theme.label }}</span>
        <span v-if="theme.value === currentTheme" class="option-check">✓</span>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useThemeStore, type ThemeName } from '../stores/theme'

const store = useThemeStore()

const isOpen = ref(false)

const themeLabels: Record<ThemeName, string> = {
  dark: '深色',
  light: '明亮',
  obsidian: 'Obsidian'
}

const themeOptions: { value: ThemeName; label: string; icon: string }[] = [
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'light', label: '明亮', icon: '☀️' },
  { value: 'obsidian', label: 'Obsidian', icon: '🟣' }
]

const currentTheme = ref<ThemeName>(store.currentTheme)

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function handleSelect(theme: ThemeName) {
  store.setTheme(theme)
  currentTheme.value = theme
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.theme-switcher')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.theme-switcher {
  position: relative;
  -webkit-app-region: no-drag;
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.theme-btn:hover {
  background: var(--bg-tertiary);
}

.theme-icon {
  font-size: 14px;
}

.theme-label {
  font-size: 12px;
}

.dropdown-arrow {
  font-size: 10px;
  opacity: 0.7;
}

.theme-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 6px;
  z-index: 1000;
}

.theme-option,
.theme-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}

.theme-option:hover {
  background: var(--bg-tertiary);
}

.theme-option.active {
  background: var(--bg-tertiary);
  color: var(--accent);
}

.option-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.option-label {
  flex: 1;
}

.option-check {
  color: var(--accent);
  font-size: 12px;
}

.theme-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
</style>