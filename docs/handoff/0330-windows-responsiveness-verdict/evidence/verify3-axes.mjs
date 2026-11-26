// verify 3 독립 축(하한 ⑥) — verify 2 변형 11건 재실행 + W-039·W-040 문장에서 유도한 passing 예제 변형. 실행: `node verify2-axes.mjs`(APP 경로는 파일 안 상수)
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
const APP = '/home/user/orca-skin/app', SRC = APP + '/scripts/windows-verdict/example/passing'
const J = (d, f) => JSON.parse(readFileSync(join(d, f), 'utf8')), W = (d, f, v) => writeFileSync(join(d, f), JSON.stringify(v))
const own = (d, fn) => { const o = J(d, 'owners.json'); fn(o.rows); W(d, 'owners.json', o) }
const cases = {
  wsRefFail: (d) => own(d, (r) => { r[0].machine = 'FAIL'; r[0].machineRef = '   ' }),
  numRefPass: (d) => own(d, (r) => { r[0].machineRef = 1 }),
  nullRefFail: (d) => own(d, (r) => { r[0].machine = 'FAIL'; r[0].machineRef = null }),
  windowsFailNoRef: (d) => own(d, (r) => { r[1].windows = 'FAIL'; delete r[1].windowsRef }),
  keyedCellFailNoRef: (d) => own(d, (r) => r.push({ task: 'T17', owner: '0326', key: 'scroll', machine: 'FAIL' })),
  keyedUnknownCellFailNoRef: (d) => own(d, (r) => r.push({ task: 'T17', owner: '0326', key: 'nope', machine: 'FAIL' })),
  bothOwnersFailNoRef: (d) => own(d, (r) => r.forEach((x) => { x.machine = 'FAIL'; delete x.machineRef })),
  failNoRefPlusOwnerMissing: (d) => own(d, (r) => { r[0].machine = 'FAIL'; delete r[0].machineRef; r.splice(1, 1) }),
  failWithRefAndSiblingFailNoRef: (d) => own(d, (r) => { r[0].machine = 'FAIL'; r.push({ ...r[0], machineRef: undefined }) }),
  unknownTaskFailNoRef: (d) => own(d, (r) => r.push({ task: 'T99', owner: '0326', machine: 'FAIL' })),
  trailingSpaceValue: (d) => own(d, (r) => { r[0].machine = 'FAIL ' }),
  emptyStringValue: (d) => own(d, (r) => { r[0].windows = '' }),
  arrayValue: (d) => own(d, (r) => { r[0].machine = ['FAIL'] }),
  lowercaseMiwanOk: (d) => own(d, (r) => { r[0].machine = '미완' }),
  numericKey: (d) => own(d, (r) => r.push({ task: 'T17', owner: '0326', key: 0, machine: 'FAIL' })),
  whitespaceKey: (d) => own(d, (r) => r.push({ task: 'T17', owner: '0326', key: ' ', machine: 'FAIL' })),
  missingTaskField: (d) => own(d, (r) => { delete r[0].task }),
  ownerOfOtherTask: (d) => own(d, (r) => r.push({ task: 'T09', owner: '0326', machine: 'FAIL' })),
  crossTaskKey: (d) => own(d, (r) => r.push({ task: 'T17', owner: '0326', key: 'reply', machine: 'FAIL' })),
  nullKeyFailNoRef: (d) => own(d, (r) => r.push({ task: 'T17', owner: '0326', key: null, machine: 'FAIL' })),
  duplicatePassFail: (d) => own(d, (r) => r.push({ ...r[0], key: 'typing', machine: 'FAIL', machineRef: 'v#x' })),
  rowsNotArray: (d) => W(d, 'owners.json', { rows: {} }),
  failNoRefUnconfirmed: (d) => { own(d, (r) => { r[0].machine = 'FAIL'; delete r[0].machineRef }); const x = J(d, 'decision.confirmed.json'); delete x.confirmation; W(d, 'decision.confirmed.json', x) }
}
for (const [name, fn] of Object.entries(cases)) {
  const d = mkdtempSync(join(tmpdir(), 'wv3-')); cpSync(SRC, d, { recursive: true }); fn(d)
  const r = spawnSync('node', ['scripts/windows-verdict.mjs', '--plan', join(d, 'plan.json'), '--manifest', join(d, 'manifest.json'), '--observations', join(d, 'observations.jsonl'), '--owners', join(d, 'owners.json'), '--decision', join(d, 'decision.confirmed.json'), '--raw-root', join(d, 'raw')], { cwd: APP, encoding: 'utf8' })
  let s = ''
  try { const o = JSON.parse(r.stdout); s = `${o.overall} | ${o.cells.map((c) => c.key + ':' + c.ownerMachine + '/' + c.ownerWindows).join(' ')} | miss=${o.missing.join(',')} ownF=${o.ownerFailures.join(',')} holds=${o.holds.join('/')}` } catch { s = (r.stderr || r.stdout).trim().split('\n').slice(-1)[0] }
  console.log(`${name} exit=${r.status} :: ${s}`.slice(0, 520)); rmSync(d, { recursive: true, force: true })
}
