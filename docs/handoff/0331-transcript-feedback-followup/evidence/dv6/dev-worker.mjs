// Vite dev 서버에서 계산·Markdown 워커가 생성 직후 죽는지 확인한다(electron.vite renderer 의 worker 설정을 그대로 쓴다).
import { createRequire } from 'node:module'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const app = new URL('../../../../../app', import.meta.url).pathname
const { createServer, build, preview } = await import(app + '/node_modules/vite/dist/node/index.js')
const { resolveConfig } = await import(app + '/node_modules/electron-vite/dist/index.js')
process.chdir(app)
const mode = process.argv[2] ?? 'dev'
const page = `<!doctype html><meta charset="utf-8"><script type="module">
const out = {}
for (const [name, url] of [
  ['compute', new URL('/src/shared/compute/worker/compute.worker.ts', location.href)],
  ['markdown', new URL('/src/shared/compute/worker/markdown.worker.ts', location.href)]
]) {
  out[name] = await new Promise((resolve) => {
    const w = new Worker(url, { type: 'module', name })
    const timer = setTimeout(() => resolve('alive (no error in 4s)'), 4000)
    w.onerror = (e) => { clearTimeout(timer); resolve('error: ' + (e.message || 'worker error event')) }
  })
}
window.result = out
</script>`
const renderer = (await resolveConfig({}, 'serve', 'development')).config.renderer
const rendererRoot = renderer.root ?? join(app, 'src/renderer')
const config = { ...renderer, root: rendererRoot, configFile: false, logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } }
let server
let origin
if (mode === 'dev') {
  writeFileSync(join(rendererRoot, 'zz-dev-worker.html'), page)
  server = await createServer(config)
  await server.listen()
  origin = server.resolvedUrls.local[0].replace(/\/$/, '') + '/zz-dev-worker.html'
}
const browser = await chromium.launch()
try {
  const p = await browser.newPage()
  const logs = []
  p.on('console', (m) => logs.push(m.type() + ': ' + m.text().slice(0, 200)))
  p.on('worker', (w) => w.on('console', (m) => logs.push('worker ' + m.text().slice(0, 200))))
  await p.goto(origin)
  await p.waitForFunction(() => window.result, null, { timeout: 60000 })
  console.log(JSON.stringify({ mode, result: await p.evaluate(() => window.result), logs: logs.slice(0, 6) }, null, 1))
} finally {
  await browser.close()
  await server?.close()
}
