// Run from app/. Each defect is applied alone and source bytes are restored in finally.
const fs = require('fs')
const cp = require('child_process')
const path = require('path')
const out = path.resolve('node_modules/.cache/orca/0239/mutations')
fs.mkdirSync(out, { recursive: true })
const chat = 'src/renderer/src/features/chat/'
const panel = chat + 'components/rightpanel/CanonicalBackgroundContent.tsx'
const canonical = chat + 'lib/canonicalBackground.ts'
const store = chat + 'store/backgroundStore.ts'
const coord = 'src/main/features/chat/turn-coordinator.ts'
const settle = 'src/main/features/chat/settle.ts'
const render = [chat + 'components/transcript/nonExecution.render.test.ts']
const panels = [chat + 'components/rightpanel/CanonicalBackgroundContent.render.test.ts', chat + 'lib/canonicalBackground.settlement.test.ts']
const coordinator = ['src/main/features/chat/turn-coordinator.test.ts']
const pending = ['src/shared/background-task.test.ts', 'src/main/app/chat-turn/post-turn.schedules.test.ts']
const mutations = []
const replace = (text, from, to) => {
  const next = text.replace(from, to)
  if (next === text) throw Error('mutation anchor missing: ' + String(from))
  return next
}
const add = (id, pair, file, mutate, tests, typecheck = false) => mutations.push({ id, pair, file, mutate, tests, typecheck })
add('02-1-toolcard-label', 'VP-02', chat + 'components/transcript/ToolCard.tsx', t => t.replace(/(rejected: )'chat.toolMeta.rejected'/, "$1'chat.toolMeta.cancelled'").replace(/(cancelled: )'chat.toolMeta.cancelled'/, "$1'chat.toolMeta.rejected'"), render)
add('02-6-work-status', 'VP-02', chat + 'lib/workToolPresentation.ts', t => replace(t, 'return outcome', "return outcome === 'rejected' ? 'cancelled' : outcome === 'cancelled' ? 'rejected' : outcome"), render)
add('02-8-call-label', 'VP-02', panel, t => replace(t, 'tr(DISPLAY_LABEL[display.status])', "tr(DISPLAY_LABEL[display.status === 'rejected' ? 'cancelled' : display.status === 'cancelled' ? 'rejected' : display.status])"), panels)
add('02-10-group-tone', 'VP-02', chat + 'lib/toolMeta.ts', t => replace(t, "toolRunOutcome(call.result) === 'failed'", "call.result?.isError"), render)
add('02-11-taskbody-label', 'VP-02', chat + 'components/transcript/tool-bodies/TaskToolBody.tsx', t => replace(t, 'NON_EXECUTION_LABEL[outcome]', "NON_EXECUTION_LABEL[outcome === 'rejected' ? 'cancelled' : outcome === 'cancelled' ? 'rejected' : outcome]"), render)
add('02-12-detail-meta', 'VP-02', canonical, t => {
  const at = t.indexOf('export function backgroundCallToToolCall(')
  return t.slice(0, at) + replace(t.slice(at), 'const nonExecution = callNonExecution(call, transcript)', 'const nonExecution = undefined')
}, panels)
add('03-pending-foreground', 'VP-03/08/11', 'src/shared/background-task.ts', t => replace(t, '!isForegroundTask(task) &&', ''), pending)
const terminalBlock = `            if (ev.type === 'telemetry' || ev.type === 'error') {
              settleOrphanToolRuns(
                turn,
                this.streamEmit,
                'no_result',
                this.canonicalBackground(turn)
              )
            }
`
add('06-1-telemetry-after-emit', 'VP-06', coord, t => {
  t = replace(t, terminalBlock, terminalBlock.replace("ev.type === 'telemetry' || ev.type === 'error'", "ev.type === 'error'"))
  const start = t.indexOf('// 단일 팬아웃')
  return t.slice(0, start) + replace(t.slice(start), 'this.emit(turn, ev)', "this.emit(turn, ev)\n            if (ev.type === 'telemetry') settleOrphanToolRuns(turn, this.streamEmit, 'no_result', this.canonicalBackground(turn))")
}, coordinator)
add('06-2-remove-error', 'VP-06', coord, t => replace(t, terminalBlock, terminalBlock.replace("ev.type === 'telemetry' || ev.type === 'error'", "ev.type === 'telemetry'")), coordinator)
add('06-3-remove-synthetic', 'VP-06', coord, t => replace(t, "          settleOrphanToolRuns(turn, this.streamEmit, 'no_result', this.canonicalBackground(turn))\n", ''), coordinator)
add('06-4-error-after-steer', 'VP-06', coord, t => {
  t = replace(t, terminalBlock, terminalBlock.replace("ev.type === 'telemetry' || ev.type === 'error'", "ev.type === 'telemetry'"))
  const commit = "            if (ev.type !== 'telemetry') this.commitConsumed(turn, closeBeforeUser)"
  return replace(t, commit, commit + "\n            if (ev.type === 'error') settleOrphanToolRuns(turn, this.streamEmit, 'no_result', this.canonicalBackground(turn))")
}, coordinator)
add('07-retract-closed-id', 'VP-07', settle, t => replace(replace(t, 'return [...turn.openToolRuns.keys()].filter((id) => wanted.has(id))', 'return [...wanted]'), 'const info = turn.openToolRuns.get(toolRunId)\n    if (!info) continue', 'const info = turn.openToolRuns.get(toolRunId) ?? {}'), coordinator)
add('10-writer-omit-meta', 'VP-10', 'src/main/features/history/writer.ts', t => replace(t, '...(ev.nonExecution !== undefined ? { nonExecution: ev.nonExecution } : {})', '...{}'), ['src/main/features/history/writer.test.ts'])
add('13-interrupted-cancelled', 'VP-13', 'src/shared/tool-outcome.ts', t => replace(replace(t, "if (value.kind === 'interrupted') return 'aborted'", "if (value.kind === 'interrupted') return 'cancelled'"), "if (value.kind === 'cancelled') return 'cancelled'", "if (value.kind === 'cancelled') return 'aborted'"), ['src/shared/tool-outcome.test.ts'])
const onlyOrphan = fn => t => { const at = t.indexOf('export function orphanToolRunIds'); return t.slice(0, at) + fn(t.slice(at)) }
add('14-1-preserved-set', 'VP-14', settle, onlyOrphan(t => replace(t, '    if (preserved.has(toolRunId)) continue\n', '')), ['src/main/features/chat/settle.test.ts'])
add('14-2-no-canonical-child', 'VP-14', settle, onlyOrphan(t => replace(t, '    if (!background && info.parentToolRunId !== undefined) continue\n', '')), ['src/main/features/chat/settle.test.ts'])
add('14-3-open-parent-rule', 'VP-14', settle, onlyOrphan(t => replace(t, '    out.push(toolRunId)', '    if (info.parentToolRunId && turn.openToolRuns.has(info.parentToolRunId)) continue\n    out.push(toolRunId)')), ['src/main/features/chat/settle.test.ts'])
add('15-exclude-all-unknown', 'VP-15', 'src/shared/background-task.ts', t => replace(t, '!isForegroundTask(task) &&', "task.liveMembership !== 'unknown' &&"), pending)
for (const [id, file] of [
  ['agent-row', 'components/transcript/AgentTaskRow.tsx'], ['subagent-tile', 'components/rightpanel/SubAgentTileContent.tsx'],
  ['status-icon', 'components/rightpanel/TaskStatusIcon.tsx'], ['progress-list', 'components/rightpanel/TaskProgressList.tsx'],
  ['toolcard', 'components/transcript/ToolCard.tsx']
]) add('16-record-' + id, 'VP-16', chat + file, t => replace(t, /^  rejected:.*\n/m, ''), [], true)
add('04-1-task-group', 'VP-04', panel, t => replace(t, 'callForBackgroundTask(state, task),', "{ ...callForBackgroundTask(state, task)!, phase: 'started' },"), panels)
add('04-2-task-card', 'VP-04', panel, t => replace(t, 'backgroundTaskDisplay(state, task, call, transcript)', "backgroundTaskDisplay(state, task, call ? { ...call, phase: 'started' } : undefined, transcript)"), panels)
add('04-5-task-clear', 'VP-04', store, t => replace(t, 'callForBackgroundTask(view.state, task),', "{ ...callForBackgroundTask(view.state, task)!, phase: 'started' },"), panels)
add('12-1-render-projection', 'VP-12', panel, t => replace(t, '    panel,\n    transcriptResults\n', '    panel\n'), panels)
add('12-2-preclear-projection', 'VP-12', store, t => replace(t, 'projectBackgroundPanel(view.state, undefined, panel, transcriptResults)', 'projectBackgroundPanel(view.state, undefined, panel)'), panels)
add('12-3-postclear-projection', 'VP-12', store, t => replace(t, 'projectBackgroundPanel(view.state, view.selection, nextPanel, transcriptResults)', 'projectBackgroundPanel(view.state, view.selection, nextPanel)'), panels)
add('17-time-call', 'VP-17', canonical, t => replace(t, 'endedAt: call.lastSeenAt', 'endedAt: call.firstSeenAt'), panels)
add('17-time-foreground', 'VP-17', canonical, t => replace(t, 'return { status, settled: true, endedAt: call.lastSeenAt }', 'return { status, settled: true, endedAt: task.firstSeenAt }'), panels)
add('17-time-dead-task', 'VP-17', canonical, t => replace(t, 'endedAt: task.lastSeenAt\n', 'endedAt: task.firstSeenAt\n'), panels)
add('17-time-elapsed', 'VP-17', canonical, t => replace(t, '(endedAt ?? now)', '(endedAt === undefined ? now : task.firstSeenAt)'), panels)
add('17-remote-call', 'VP-17', canonical, t => replace(t, "call.mode !== 'remote' && deadGeneration", 'deadGeneration'), panels)
add('17-remote-task-mode', 'VP-17', canonical, t => replace(t, "call?.mode === 'remote' || ", ''), panels)
add('17-dead-call-rule', 'VP-17', canonical, t => replace(t, "  if (call.mode !== 'remote' && deadGeneration(state, call.generation)) return done('unconfirmed')\n", ''), panels)
add('17-remote-task-type', 'VP-17', canonical, t => replace(t, " || task.taskType?.startsWith('remote_') === true", ''), panels)
add('19-20-result-equality', 'VP-19/20', chat + 'lib/parts.ts', t => replace(t, 'nonExecutionEquals(a.nonExecution, b.nonExecution)', 'true'), [chat + 'lib/nonExecution.test.ts', chat + 'lib/parts.reconcile.test.ts'])

const selected = mutations.filter(m => !process.argv[2] || m.id.startsWith(process.argv[2]))
const results = []
function writeSource(file, bytes) {
  for (let attempt = 0; ; attempt++) {
    try { fs.writeFileSync(file, bytes); return }
    catch (error) {
      if (attempt === 19) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
}
for (const mutation of selected) {
  const original = fs.readFileSync(mutation.file)
  fs.writeFileSync(path.join(out, mutation.id + '.original'), original)
  let report
  try {
    const text = original.toString('utf8').replace(/\r\n/g, '\n')
    const changed = mutation.mutate(text)
    if (changed === text) throw Error('no source change')
    writeSource(mutation.file, changed)
    const args = mutation.typecheck
      ? ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.web.json', '--composite', 'false', '--incremental', '--tsBuildInfoFile', path.join(out, 'mutation.tsbuildinfo')]
      : ['node_modules/vitest/vitest.mjs', 'run', ...mutation.tests, '--reporter=json', '--outputFile=' + path.join(out, mutation.id + '.json')]
    const run = cp.spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8', timeout: 240000, maxBuffer: 12 * 1024 * 1024, windowsHide: true })
    fs.writeFileSync(path.join(out, mutation.id + '.log'), run.stdout + run.stderr)
    let detected = false
    let failed = 0
    let names = []
    if (mutation.typecheck) {
      detected = run.status !== 0 && run.stdout.includes("Property 'rejected' is missing")
      names = run.stdout.trim().split('\n').filter(s => s.includes('error TS'))
      failed = names.length
    } else {
      const result = JSON.parse(fs.readFileSync(path.join(out, mutation.id + '.json'), 'utf8'))
      failed = result.numFailedTests
      names = result.testResults.flatMap(f => f.assertionResults.filter(a => a.status === 'failed').map(a => a.fullName))
      detected = run.status !== 0 && failed > 0
    }
    report = { id: mutation.id, pair: mutation.pair, file: mutation.file, detected, exit: run.status, failed, tests: mutation.tests, names }
  } catch (error) {
    report = { id: mutation.id, pair: mutation.pair, detected: false, error: String(error) }
  } finally {
    writeSource(mutation.file, original)
  }
  results.push(report)
  fs.writeFileSync(path.join(out, mutation.id + '.result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
}
console.log('Mutations: ' + results.filter(r => r.detected).length + '/' + results.length)
process.exitCode = results.every(r => r.detected) ? 0 : 1
