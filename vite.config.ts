import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import dbApiPlugin from './vite-plugin-db-api'
import { HttpsProxyAgent } from 'https-proxy-agent'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    Components({
      dts: 'src/components.d.ts',
      resolvers: [ElementPlusResolver({ importStyle: 'css' })]
    }),
    dbApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router'],
          spreadsheet: ['xlsx'],
          database: ['sql.js']
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/gemini-api': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gemini-api/, ''),
        configure: (proxy) => {
          const agent = new HttpsProxyAgent('http://127.0.0.1:7897');
          (proxy as any).options.agent = agent;
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[Proxy Request]', req.url)
          })
        }
      }
    }
  },
})
