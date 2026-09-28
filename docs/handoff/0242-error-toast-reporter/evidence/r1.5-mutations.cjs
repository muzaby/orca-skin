// node docs/handoff/0242-error-toast-reporter/evidence/r1.5-mutations.cjs [id ...]
// Sequential production mutations. Original bytes are restored even when an oracle fails.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const app = path.resolve(__dirname, '../../../../app')
const host = 'src/renderer/src/shared/ui/ErrorToastHost.tsx'
const actions = 'src/renderer/src/shared/ui/ErrorToastHost.actions.test.ts'
const target = 'src/renderer/src/app/errorToastTarget.ts'
const targetTest = 'src/renderer/src/app/errorToastTarget.test.ts'
const bridge = 'src/renderer/src/shared/errors/mainErrorBridge.ts'
const integration = 'src/main/app/error-report.integration.test.ts'
const main = 'src/main/infra/error-report/index.ts'
const mutations = [
  { id: 'VP-26-clamp-swap', file: host, tests: [actions], mutate: s => s.replace('mt-[3px] line-clamp-8', 'mt-[3px]').replace('text-[13.5px]', 'line-clamp-8 text-[13.5px]') },
  { id: 'VP-27a-dismiss', file: host, tests: [actions], mutate: s => s.replace('              dismiss(id)', '') },
  { id: 'VP-27b-close-opens', file: host, tests: [actions], mutate: s => s.replace('onClick={() => dismiss(id)}', 'onClick={() => { onOpen(target); dismiss(id) }}') },
  { id: 'VP-27c-branch-swap', file: target, tests: [targetTest], mutate: s => s.replace('deps.navigate(target.path)', 'deps.openSettings(target.path)').replace('deps.openSettings(target.tab)', 'deps.navigate(target.tab)') },
  { id: 'VP-27d-invalid-guard', file: target, tests: [targetTest], mutate: s => s.replace('if (isValidTarget(target))', 'if (target)') },
  { id: 'VP-28-renderer-target', file: 'src/renderer/src/shared/errors/reportError.ts', tests: ['src/renderer/src/shared/errors/reportError.test.ts'], mutate: s => s.replace('target: input.target', 'target: undefined') },
  { id: 'VP-28-main-target', file: main, tests: ['src/main/infra/error-report/index.test.ts', integration], mutate: s => s.replace('target: input.target', 'target: undefined') },
  { id: 'VP-28-publish-target', file: main, tests: ['src/main/infra/error-report/index.test.ts', integration], mutate: s => { const offset = s.indexOf('export function publishErrorReport'); return s.slice(0, offset) + s.slice(offset).replace('target: input.target', 'target: undefined') } },
  { id: 'VP-28-event-target', file: bridge, tests: [integration], mutate: s => s.replace('api.onReport(present)', 'api.onReport((report) => present({ ...report, target: undefined }))') },
  { id: 'VP-28-drain-target', file: bridge, tests: [integration], mutate: s => s.replace('of await api.drain()) present(report)', 'of await api.drain()) present({ ...report, target: undefined })') },
  { id: 'VP-29-flush', file: 'src/main/app/handlers/error.ts', tests: ['src/main/app/handlers/error.test.ts'], mutate: s => s.replace('    flushLogSync()', '') },
  { id: 'VP-29-layer-noop', file: 'src/renderer/src/app/ErrorToastLayer.tsx', tests: ['src/renderer/src/app/ErrorToastLayer.test.ts'], mutate: s => s.replace('void openErrorTarget(target, { navigate, openSettings, revealLog: errorApi.revealLog })', 'void target') },
  { id: 'mount-regression', file: 'src/renderer/src/App.tsx', tests: ['src/renderer/src/App.projects.test.ts', 'src/renderer/src/shared/ui/ErrorToastHost.render.test.ts'], mutate: s => s.replace('<ErrorToastLayer />', '') },
  { id: 'animation-key', file: host, tests: [actions], mutate: s => s.replace('key={`${id}:${seq}`}', 'key={id}') },
  { id: 'preload-channel', file: 'src/preload/index.ts', tests: ['src/preload/index.test.ts'], mutate: s => s.replace('ipcRenderer.invoke(CHANNELS.errorRevealLog)', 'ipcRenderer.invoke(CHANNELS.errorDrain)') },
  { id: 'api-noop', file: 'src/renderer/src/shared/api/ipc.ts', tests: ['src/preload/index.test.ts', 'src/renderer/src/app/ErrorToastLayer.test.ts'], mutate: s => s.replace('window.orca.error.revealLog()', 'Promise.resolve()') },
  { id: 'VP-02a-regression', file: bridge, tests: ['src/renderer/src/shared/errors/mainErrorBridge.test.ts'], mutate: s => s.replace('    presentErrorReport(report)', "    presentErrorReport(report)\n    reportError({ event: 'errors.duplicate.failed', scope: 'errors', title: report.title, detail: report.detail })") },
  { id: 'VP-02b-regression', file: 'src/main/infra/mutation-publisher.ts', tests: ['src/main/error-report.registry.test.ts'], mutate: () => 'publishErrorReport({ title: "unexpected" })\n' }
]
const output = path.join(__dirname, 'r1.5-mutations.json')
const selected = process.argv.slice(2)
const results = selected.length && fs.existsSync(output)
  ? JSON.parse(fs.readFileSync(output, 'utf8')).filter(r => !selected.includes(r.id)) : []
for (const item of mutations.filter(m => !selected.length || selected.includes(m.id))) {
  const file = path.resolve(app, item.file)
  if (!file.startsWith(app + path.sep)) throw new Error('Outside app')
  const original = fs.existsSync(file) ? fs.readFileSync(file) : null
  const source = original?.toString('utf8') ?? ''
  const changed = item.mutate(source)
  if (changed === source) throw new Error('No mutation applied: ' + item.id)
  try {
    fs.writeFileSync(file, changed)
    const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...item.tests, '--reporter=json'], {
      cwd: app, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: 60000
    })
    let report
    try { report = JSON.parse(run.stdout) } catch { throw new Error(item.id + ': ' + run.stderr + run.stdout) }
    const failures = report.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName))
    const result = { id: item.id, file: item.file, status: run.status, failedTests: report.numFailedTests, failures }
    results.push(result)
    console.log(JSON.stringify(result))
    if (run.status === 0 || report.numFailedTests < 1) throw new Error('Survived: ' + item.id)
  } finally {
    if (original) fs.writeFileSync(file, original)
    else fs.unlinkSync(file)
    fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n')
  }
}
