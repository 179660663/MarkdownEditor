function showFatalError(msg: string) {
  const loading = document.getElementById('initial-loading')
  if (loading) {
    loading.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <h2 style="color:#f44747;margin-bottom:16px;">加载失败</h2>
        <p style="color:#d4d4d4;margin-bottom:20px;font-size:13px;font-family:monospace;word-break:break-all;">${msg}</p>
        <button onclick="location.reload()" style="background:#569cd6;color:white;border:none;padding:8px 24px;border-radius:4px;cursor:pointer;font-size:14px;">重新加载</button>
      </div>
    `
  }
  console.error('[Fatal]', msg)
}

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message)
  if (event.error?.message?.includes?.('Failed to fetch') || 
      event.error?.message?.includes?.('load') ||
      event.error?.stack?.includes?.('main.ts')) {
    showFatalError(event.message || '脚本加载失败')
  }
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
})

setTimeout(() => {
  const appEl = document.getElementById('app')
  const loading = document.getElementById('initial-loading')
  if (appEl && appEl.children.length === 0 && loading) {
    showFatalError('应用初始化超时。可能是开发服务器未就绪或渲染进程加载失败。')
  }
}, 10000)

console.log('[Renderer] Starting... electronAPI available:', !!window.electronAPI)

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue ErrorHandler]', err, info)
}

const pinia = createPinia()

try {
  app.use(pinia)
  app.mount('#app')
  console.log('[Renderer] Vue mounted successfully')
} catch (err) {
  console.error('[Renderer] Failed to mount Vue:', err)
  showFatalError(err instanceof Error ? err.message : String(err))
}