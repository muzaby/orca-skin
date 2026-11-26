import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
const APP = '/home/user/orca-skin/app', SRC = APP + '/scripts/windows-verdict/example/passing'
const J = (d, f) => JSON.parse(readFileSync(join(d, f), 'utf8')), W = (d, f, v) => writeFileSync(join(d, f), JSON.stringify(v))
const obs = (d) => readFileSync(join(d, 'observations.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const wobs = (d, a) => writeFileSync(join(d, 'observations.jsonl'), a.map((o) => JSON.stringify(o)).join('\n') + '\n')
const cases = {
  baseline: () => {},
  agreementRevision: (d) => { const x = J(d, 'decision.confirmed.json'); x.agreement.revision = 'other'; W(d, 'decision.confirmed.json', x) },
  unknownSample: (d) => { const p = J(d, 'plan.json'); p.cells[0].sample = 'W'; W(d, 'plan.json', p) },
  unknownOperator: (d) => { const p = J(d, 'plan.json'); p.cells[0].rule.operator = '≦'; W(d, 'plan.json', p) },
  targetMissing: (d) => { const p = J(d, 'plan.json'); delete p.cells[5].target; W(d, 'plan.json', p) },
  rawDeleted: (d) => rmSync(join(d, 'raw/typing-2.json')),
  manifestRuntimeLie: (d) => { const m = J(d, 'manifest.json'); m.runs.filter((r) => r.scenario === m.runs.find((x) => x.runId.startsWith('function')).scenario && r.runId.startsWith('function')).forEach((r) => (r.runtime = 'linux-node')); W(d, 'manifest.json', m) },
  confirmEarly: (d) => { const x = J(d, 'decision.confirmed.json'); x.confirmation.confirmedAt = '2026-11-20T12:00:00Z'; W(d, 'decision.confirmed.json', x) },
  dupLine: (d) => { const a = obs(d); a.push(a[0]); wobs(d, a) },
  wrongIntegrationSha: (d) => { const m = J(d, 'manifest.json'); const r = m.runs.find((r) => r.runId === 'scroll-2'); r.sha = 'f'.repeat(40); r.appSource.commit = r.sha; W(d, 'manifest.json', m) },
  optionalViolation: (d) => { const p = J(d, 'plan.json'); p.cells[1].required = false; p.cells[1].rule.value = 0; W(d, 'plan.json', p) },
  ownerRowRemoved: (d) => { const o = J(d, 'owners.json'); o.rows = o.rows.filter((r) => r.task !== 'T09'); W(d, 'owners.json', o) },
  unitFrames: (d) => { const a = obs(d); a[0].unit = 'frames'; wobs(d, a) },
  opIdOtherRun: (d) => { const a = obs(d); const s = a.filter((o) => o.runId.startsWith('search')); s[1].rawRef.range.opId = s[0].rawRef.range.opId; wobs(d, a) },
  valueMismatchMarker: (d) => { const a = obs(d); a.filter((o) => o.runId.startsWith('search')).forEach((o) => (o.values = [0.01])); wobs(d, a) },
  ownerFailNoRef: (d) => { const o = J(d, 'owners.json'); o.rows[0].machine = 'FAIL'; delete o.rows[0].machineRef; W(d, 'owners.json', o) },
  extraUnknownRow: (d) => { const a = obs(d); a.push({ ...a[0], metric: 'surprise' }); wobs(d, a) },
  emptyValues: (d) => { const a = obs(d); a[0].values = []; wobs(d, a) },
  nanValue: (d) => { const a = obs(d); a[0].values = ['12']; wobs(d, a) }
}
for (const [name, fn] of Object.entries(cases)) {
  const d = mkdtempSync(join(tmpdir(), 'wv-')); cpSync(SRC, d, { recursive: true }); fn(d)
  const r = spawnSync('node', ['scripts/windows-verdict.mjs', '--plan', join(d, 'plan.json'), '--manifest', join(d, 'manifest.json'), '--observations', join(d, 'observations.jsonl'), '--owners', join(d, 'owners.json'), '--decision', join(d, 'decision.confirmed.json'), '--raw-root', join(d, 'raw')], { cwd: APP, encoding: 'utf8' })
  let s = ''
  try { const o = JSON.parse(r.stdout); s = `${o.overall} | ${o.cells.map((c) => c.key + ':' + c.status + (c.reason ? '(' + c.reason + ')' : '')).join(' ')} | miss=${o.missing.length} dup=${o.duplicates.length} unexp=${o.unexpected.length} ownF=${o.ownerFailures.length} holds=${o.holds.join('/')}` } catch { s = (r.stderr || r.stdout).trim().split('\n').slice(-1)[0] }
  console.log(`${name} exit=${r.status} :: ${s}`.slice(0, 520)); rmSync(d, { recursive: true, force: true })
}
