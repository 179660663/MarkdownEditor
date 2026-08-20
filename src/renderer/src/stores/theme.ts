import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeName = 'dark' | 'light' | 'obsidian'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<ThemeName>('dark')

  function applyTheme(theme: ThemeName) {
    document.documentElement.setAttribute('data-theme', theme)
  }

  function setTheme(theme: ThemeName) {
    currentTheme.value = theme
    applyTheme(theme)
  }

  async function initTheme() {
    try {
      const config = await window.electronAPI.getConfig()
      const savedTheme = config.theme as ThemeName | undefined
      if (savedTheme && ['dark', 'light', 'obsidian'].includes(savedTheme)) {
        currentTheme.value = savedTheme
      }
      applyTheme(currentTheme.value)
    } catch {
      applyTheme(currentTheme.value)
    }
  }

  watch(currentTheme, async (newTheme) => {
    applyTheme(newTheme)
    await window.electronAPI.setConfig('theme', newTheme)
  })

  return {
    currentTheme,
    setTheme,
    initTheme
  }
})