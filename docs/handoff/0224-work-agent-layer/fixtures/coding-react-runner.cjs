// 실제 Electron renderer 실행. 외부 API/사용자 config/DB/보이는 창을 사용하지 않는다.
// electron coding-react-runner.cjs <prepared-cache-directory> [pairs=5]
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const cache = path.resolve(process.argv[2])
const pairs = Number(process.argv[3] || 5)
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 20) throw new Error('pairs must be 1..20')
app.disableHardwareAcceleration()
// A/B 창 사이에 열린 창이 없어도 측정 프로세스를 유지한다.
app.on('window-all-closed', () => {})
const profile = fs.mkdtempSync(path.join(cache, 'profile-'))
app.setPath('userData', profile)
app.setPath('appData', profile)
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
const summarize = values => ({ n: values.length, median: percentile(values, .5), p95: percentile(values, .95) })
const report = {
  manifest: JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8')),
  scope: 'Actual Coding Exchange/AssistantTurn/AssistantMessage, React production profiling, synthetic Markdown, fixed fixture CSS, hidden renderer; excludes full-app event transport, paint/FPS and SDK.',
  machine: { platform: process.platform, arch: process.arch, cpus: os.cpus().length, cpu: os.cpus()[0].model, versions: process.versions },
  startedAt: new Date().toISOString(), pairs, samples: [], errors: []
}
async function run() {
  await app.whenReady()
  for (let pair = 0; pair < pairs; pair++) {
    for (const label of pair % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
      const win = new BrowserWindow({ show: false, width: 1200, height: 850, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } })
      win.show = () => {}
      win.webContents.setBackgroundThrottling(false)
      try {
        await win.loadFile(path.join(cache, `${label}.html`))
        const data = await win.webContents.executeJavaScript('window.runBenchmark()')
        report.samples.push({ pair, label, ...data })
      } finally { win.destroy() }
    }
  }
  report.summary = Object.fromEntries(['baseline', 'current'].map(label => {
    const samples = report.samples.filter(sample => sample.label === label)
    return [label, {
      flushAndLayoutMs: summarize(samples.flatMap(sample => sample.elapsed)),
      reactRenderMs: summarize(samples.flatMap(sample => sample.commits.map(commit => commit.actualDuration))),
      perRun: samples.map(sample => ({ pair: sample.pair, flushAndLayoutMs: summarize(sample.elapsed), reactRenderMs: summarize(sample.commits.map(commit => commit.actualDuration)), counts: sample.counts, commits: sample.commits.length }))
    }]
  }))
}
run().catch(error => { report.errors.push(error.stack || String(error)); process.exitCode = 1 }).finally(() => {
  report.finishedAt = new Date().toISOString()
  const output = path.join(cache, `result-${Date.now()}.json`)
  fs.writeFileSync(output, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ output, summary: report.summary, errors: report.errors }, null, 2))
  app.exit(report.errors.length ? 1 : 0)
})
