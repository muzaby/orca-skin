import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 개발용 별도 진입점. Electron/production renderer 번들에는 포함하지 않는다.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  define: { __APP_VERSION__: JSON.stringify('UI fixture') },
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] }
  }
})
