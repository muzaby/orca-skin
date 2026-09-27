// Run from any directory with `node <this file>`. Every mutation is restored in finally.
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../../../..')
const app = path.join(root, 'app')
const bridge = 'src/renderer/src/shared/errors/mainErrorBridge.ts'
const bridgeTest = 'src/renderer/src/shared/errors/mainErrorBridge.test.ts'
const mutations = [
  {
    id: 'VP-02b-new-file', file: 'src/main/infra/mutation-publisher.ts', tests: ['src/main/error-report.registry.test.ts'],
    mutate: () => 'publishErrorReport({ title: "unexpected" })\n'
  },
  {
    id: 'VP-04b-new-file', file: 'src/renderer/src/shared/mutation-silent.ts', tests: ['src/renderer/src/shared/errors/reportSites.registry.test.ts'],
    mutate: () => 'task.catch(() => undefined)\n'
  },
  {
    id: 'VP-04b-existing-file', file: 'src/renderer/src/shared/hooks/useSkills.ts', tests: ['src/renderer/src/shared/errors/reportSites.registry.test.ts'],
    mutate: (s) => s + '\ntask.catch(() => undefined)\n'
  },
  {
    id: 'VP-02a', file: bridge, tests: [bridgeTest],
    mutate: (s) => s.replace('    presentErrorReport(report)', "    presentErrorReport(report)\n    reportError({ event: 'errors.duplicate.failed', scope: 'errors', title: report.title, detail: report.detail })")
  },
  {
    id: 'VP-14', file: bridge, tests: [bridgeTest],
    mutate: (s) => s.replace('  const unsubscribe = api.onReport(present)', '  const pending = api.drain()\n  const unsubscribe = api.onReport(present)').replace('await api.drain()', 'await pending')
  },
  {
    id: 'VP-19', file: 'src/main/features/scheduler/scheduler.ts', tests: ['src/main/features/scheduler/scheduler.test.ts'],
    mutate: (s) => s.replace('      this.failing.delete(key)', '')
  },
  {
    id: 'host-mount-oracle', file: 'src/renderer/src/App.tsx', tests: ['src/renderer/src/shared/ui/ErrorToastHost.render.test.ts', 'src/renderer/src/App.projects.test.ts'],
    mutate: (s) => s.replace('                  <ErrorToastHost />', '')
  },
  ...['installErrorReportSink()', 'registerErrorHandlers()', 'registerLogHandlers()'].map((call) => ({
    id: 'startup-wiring-' + call, file: 'src/main/index.ts', tests: ['src/main/error-report.registry.test.ts'],
    mutate: (s) => s.replace(call, '')
  }))
]
const output = path.join(__dirname, 'r1-mutations.json')
const selected = process.argv.slice(2)
const results = selected.length && fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')).filter((r) => !selected.includes(r.id)) : []
for (const item of mutations.filter((m) => !selected.length || selected.includes(m.id))) {
  const file = path.join(app, item.file)
  if (!file.startsWith(app + path.sep)) throw new Error('Outside app: ' + file)
  const original = fs.existsSync(file) ? fs.readFileSync(file) : null
  const source = original?.toString('utf8') ?? ''
  const changed = item.mutate(source)
  if (source === changed) throw new Error('Mutation did not apply: ' + item.id)
  try {
    fs.writeFileSync(file, changed)
    const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...item.tests, '--reporter=json'], {
      cwd: app, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: 60000
    })
    let report
    try { report = JSON.parse(run.stdout) } catch { throw new Error(item.id + ': ' + run.stdout + run.stderr) }
    const failures = report.testResults.flatMap((suite) => suite.assertionResults.filter((test) => test.status === 'failed').map((test) => test.fullName))
    const result = { id: item.id, file: item.file, status: run.status, failedTests: report.numFailedTests, failures }
    results.push(result)
    console.log(JSON.stringify(result))
    if (run.status === 0 || report.numFailedTests < 1) throw new Error('Mutation survived: ' + item.id)
  } finally {
    if (original) fs.writeFileSync(file, original)
    else fs.unlinkSync(file)
    fs.writeFileSync(output, JSON.stringify(results, null, 2) + '\n')
  }
}
