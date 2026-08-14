import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeName = 'dark' | 'light' | 'obsidian'

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref<ThemeName>('dark')
  const focusMode = ref(false)
  const typewriterMode = ref(false)

  function applyTheme(theme: ThemeName) {
    document.documentElement.setAttribute('data-theme', theme)
  }

  function setTheme(theme: ThemeName) {
    currentTheme.value = theme
    applyTheme(theme)
  }

  function toggleFocusMode() {
    focusMode.value = !focusMode.value
    if (focusMode.value) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
  }

  function toggleTypewriterMode() {
    typewriterMode.value = !typewriterMode.value
    if (typewriterMode.value) {
      document.body.classList.add('typewriter-mode')
    } else {
      document.body.classList.remove('typewriter-mode')
    }
  }

  async function initTheme() {
    try {
      const config = await window.electronAPI.getConfig()
      const savedTheme = config.theme as ThemeName | undefined
      if (savedTheme && ['dark', 'light', 'obsidian'].includes(savedTheme)) {
        currentTheme.value = savedTheme
      }
      applyTheme(currentTheme.value)
      if (focusMode.value) document.body.classList.add('focus-mode')
      if (typewriterMode.value) document.body.classList.add('typewriter-mode')
    } catch {
      applyTheme(currentTheme.value)
    }
  }

  watch(currentTheme, async (newTheme) => {
    applyTheme(newTheme)
    await window.electronAPI.setConfig('theme', newTheme)
  })

  watch(focusMode, (val) => {
    if (val) {
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
    }
  })

  watch(typewriterMode, (val) => {
    if (val) {
      document.body.classList.add('typewriter-mode')
    } else {
      document.body.classList.remove('typewriter-mode')
    }
  })

  return {
    currentTheme,
    focusMode,
    typewriterMode,
    setTheme,
    toggleFocusMode,
    toggleTypewriterMode,
    initTheme
  }
})