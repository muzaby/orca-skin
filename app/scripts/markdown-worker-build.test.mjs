// renderer 의 entity 해석기 해석 (0331 D-035 · VP-64). 계산·Markdown 워커에는 `document` 가 없다 —
// `decode-named-character-reference` 의 browser 판(`index.dom.js`)은 모듈 최상위에서 `document` 를 써서
// 워커가 뜨기 전에 죽는다. 실제 `electron.vite.config.ts` 를 electron-vite 로 해석하고, Vite 해석기로 워커
// 모듈에서 이 패키지를 푼다 — 소스 해석과 의존성 사전 번들(esbuild) 해석 둘 다, dev(serve)와 build 둘 다.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const APP = fileURLToPath(new URL('../', import.meta.url))
const WORKER_MODULE = join(APP, 'src/renderer/src/shared/compute/worker/markdownDefinitions.ts')

async function resolveEntityDecoder(command, mode) {
  const vite = await import('vite')
  const { resolveConfig } = await import('electron-vite')
  const renderer = (await resolveConfig({ root: APP }, command, mode)).config.renderer
  const config = await vite.resolveConfig(
    {
      ...renderer,
      root: renderer.root ?? join(APP, 'src/renderer'),
      configFile: false,
      logLevel: 'silent'
    },
    command,
    mode
  )
  const resolved = {}
  for (const [path, options] of [
    ['source', { asSrc: true }],
    ['prebundle', { asSrc: false, scan: true }]
  ])
    resolved[path] = await config.createResolver(options)(
      'decode-named-character-reference',
      WORKER_MODULE
    )
  return resolved
}

describe('renderer entity decoder (0331 D-035)', () => {
  for (const [command, mode] of [
    ['serve', 'development'],
    ['build', 'production']
  ])
    it(`D-035 resolves the entity decoder without document (${command})`, async () => {
      const resolved = await resolveEntityDecoder(command, mode)
      for (const [path, id] of Object.entries(resolved)) {
        assert.ok(id, `${path} resolution`)
        const file = id.split('?')[0]
        assert.doesNotMatch(readFileSync(file, 'utf8'), /\bdocument\s*\./, `${path}: ${file}`)
      }
    })
})
