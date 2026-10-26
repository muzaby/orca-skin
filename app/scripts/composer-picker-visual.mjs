// Real Chromium layout/motion probe for the composer menus. No app profile or native DB is opened.
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, '.temp', '0287-visual')
await mkdir(output, { recursive: true })
await writeFile(
  path.join(output, 'index.html'),
  '<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/entry.ts"></script></body></html>'
)
await writeFile(
  path.join(output, 'entry.ts'),
  "import '../../scripts/fixtures/composer-picker-visual'; import './source.css'"
)
await writeFile(
  path.join(output, 'source.css'),
  "@import 'tailwindcss'; @source '../../src/renderer/src';"
)
await build({
  configFile: false,
  root: output,
  base: './',
  plugins: [react(), tailwind()],
  build: { outDir: 'dist', emptyOutDir: true }
})
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(
  require('electron'),
  [path.join(root, 'scripts/fixtures/composer-picker-capture.mjs'), output],
  { env, stdio: 'inherit', windowsHide: true }
)
process.exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', (code) => resolve(code ?? 1))
})
