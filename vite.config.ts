import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  build: {
    chunkSizeWarningLimit: 1000, // optional (hide warning)

    rollupOptions: {
      output: {
        manualChunks(id) {

          // semua node_modules dipisah
          if (id.includes('node_modules')) {

            // core vue
            if (id.includes('vue')) {
              return 'vendor-vue'
            }

            // router
            if (id.includes('vue-router')) {
              return 'vendor-router'
            }

            // chart (jika ada)
            if (id.includes('chart.js')) {
              return 'vendor-chart'
            }

            // sisanya
            return 'vendor'
          }
        }
      }
    }
  },

  optimizeDeps: {
    include: ['vue', 'vue-router']
  }
})