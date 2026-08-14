import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
})

const app = createApp(App)

app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue ErrorHandler]', err, info)
}

const pinia = createPinia()

app.use(pinia)
app.mount('#app')