// Codex 작성. 숨긴 Electron renderer, fixture 전용 profile, 사용자 DB/config와 분리.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const cache = path.resolve(process.argv[2])
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {})
const profile = fs.mkdtempSync(path.join(cache, 'profile-'))
app.setPath('userData', profile)
app.setPath('appData', profile)
const report = { manifest: JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8')), startedAt: new Date().toISOString(), success: false, errors: [] }
async function run() {
  await app.whenReady()
  // Windows에서 완전히 가려진 테스트 창의 rAF 정지를 피하되 실제 Chromium DOM을 사용한다.
  const win = new BrowserWindow({ show: false, width: 1100, height: 750, webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } })
  win.webContents.setBackgroundThrottling(false)
  win.webContents.on('console-message', event => { process.stdout.write(String(event.message) + '\n') })
  let timer
  try {
    await win.loadFile(path.join(cache, 'work.html'))
    report.result = await Promise.race([win.webContents.executeJavaScript('window.runWorkLifetime()'), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Work fixture timeout')), 45000) })])
    report.success = true
  } finally { clearTimeout(timer); win.destroy() }
}
run().catch(error => report.errors.push(error.stack || String(error))).finally(() => {
  report.finishedAt = new Date().toISOString()
  const output = path.join(cache, 'result.json')
  fs.writeFileSync(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ output, success: report.success, errors: report.errors }))
  app.exit(report.success ? 0 : 1)
})
