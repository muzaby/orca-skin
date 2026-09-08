const { app, shell } = require('electron')
const fs = require('node:fs/promises')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const root = mkdtempSync(join(tmpdir(), 'orca-artifact-native-'))
app.setPath('userData', join(root, 'profile'))
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const file = join(root, 'artifact-native-smoke.md')
  await fs.writeFile(file, '# Synthetic artifact trash test\n')
  await shell.trashItem(file)
  const missing = await fs.stat(file).then(() => false, e => e.code === 'ENOENT')
  let rejected = false
  try { await shell.trashItem(join(root, 'does-not-exist.md')) } catch { rejected = true }
  console.log(JSON.stringify({ platform: process.platform, electron: process.versions.electron, trashRemovedFixture: missing, missingTargetRejected: rejected }))
  process.exitCode = missing && rejected ? 0 : 1
}).catch(error => { console.error(error.name + ': native smoke failed'); process.exitCode = 1 }).finally(() => app.quit())
