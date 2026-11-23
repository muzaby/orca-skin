import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { serveProbe } from './check-transcript-selection.mjs'

const electron = process.env.ELECTRON_BINARY || createRequire(import.meta.url)('electron')
const served = await serveProbe('visible-views')
try {
  const child = spawn(
    electron,
    [fileURLToPath(new URL('./visible-views/electron-main.mjs', import.meta.url)), served.origin],
    { stdio: 'inherit' }
  )
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('exit', (code) => resolve(code ?? 1))
    child.once('error', reject)
  })
} finally {
  await served.close()
}
