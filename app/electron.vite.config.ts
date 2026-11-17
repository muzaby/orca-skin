import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }
const appVersion = packageJson.version

// electron-vite 의 renderer preset 은 production 빌드에서 `base` 를 `./` 로 강제 설정
// (file:// 로딩 호환용). app:// 커스텀 스킴 + BrowserRouter 조합에서는 deep URL 진입 시
// `./assets/…` 가 `app://renderer/projects/abc/assets/…` 로 해석돼 404 → 화면 white.
// 따라서 preset 이 끝난 뒤(`enforce: 'post'`) `base` 를 절대 경로 `/` 로 되돌린다.
function absoluteRendererBase(): Plugin {
  return {
    name: 'orcinus-orca:absolute-renderer-base',
    enforce: 'post',
    config(config) {
      config.base = '/'
    }
  }
}

export default defineConfig({
  main: {
    build: {
      // SDK는 import 조건만 제공하므로 CommonJS main에서 require하지 않도록 번들에 포함한다.
      externalizeDeps: { exclude: ['@opencode-ai/sdk'] },
      // 셸 하나와 호스트 둘(0324 D-034) — 셸이 `out/main/<kind>-host.js` 를 utility 프로세스로 띄운다.
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'data-host': resolve('src/main/app/data-host/entry.ts'),
          'agent-host': resolve('src/main/app/agent-host/entry.ts')
        }
      }
    }
  },
  preload: {},
  renderer: {
    build: { minify: 'esbuild' },
    // 계산 워커(`shared/compute/worker`)는 동적 import 로 문법을 나눠 싣는다 — 모듈 워커로 낸다.
    worker: { format: 'es' },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss(), absoluteRendererBase()]
  }
})
