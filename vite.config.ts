import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/better-diagram-as-code-to-image/', // 指定為 GitHub Pages 的專案名稱路徑
})
