import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

// electron-vite 의 renderer preset 은 production 빌드에서 `base` 를 `./` 로 강제 설정
// (file:// 로딩 호환용). app:// 커스텀 스킴 + BrowserRouter 조합에서는 deep URL 진입 시
// `./assets/…` 가 `app://renderer/projects/abc/assets/…` 로 해석돼 404 → 화면 white.
// 따라서 preset 이 끝난 뒤(`enforce: 'post'`) `base` 를 절대 경로 `/` 로 되돌린다.
function absoluteRendererBase(): Plugin {
  return {
    name: 'orca:absolute-renderer-base',
    enforce: 'post',
    config(config) {
      config.base = '/'
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss(), absoluteRendererBase()]
  }
})
