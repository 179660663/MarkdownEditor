import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
        '@preload': resolve(__dirname, 'src/preload')
      }
    },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        external: ['electron']
      },
      minify: true,
      sourcemap: false
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@preload': resolve(__dirname, 'src/preload')
      }
    },
    build: {
      outDir: 'out/preload',
      minify: true,
      sourcemap: false
    }
  },
  renderer: {
    plugins: [vue()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        external: ['electron'],
        output: {
          manualChunks: {
            vue: ['vue', 'pinia'],
            markdown: ['markdown-it', 'markdown-it-anchor', 'markdown-it-container', 'markdown-it-task-lists', 'markdown-it-footnote', 'highlight.js', 'katex']
          }
        }
      },
      minify: 'esbuild',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      reportCompressedSize: false
    }
  }
})