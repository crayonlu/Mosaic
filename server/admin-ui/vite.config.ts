import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/admin/static/',
  plugins: [vue()],
  build: {
    outDir: '../static/admin',
    emptyOutDir: true,
  },
})
