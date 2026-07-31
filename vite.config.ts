import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: 'src/[name]/index.js',
        chunkFileNames: 'src/[name]/chunks/[name]-[hash].js',
        assetFileNames: 'src/popup/assets/[name]-[hash][extname]',
        // 确保每个扩展入口不重复打包 shared 代码
        // Rollup 会自动处理 shared chunks，Chrome extensions 支持相对路径 import
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
})
