import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { evaluate } from './windows-verdict.mjs'

const root = join(import.meta.dirname, 'windows-verdict/example')
const load = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const full = join(root, 'passing')
const ok = '충족',
  bad = '위반',
  hold = '미판정'
function fixture(key = 'typing') {
  const plan = load(full, 'plan.json')
  const cell = plan.cells.find((c) => c.key === key)
  plan.cells = [cell]
  plan.tasks = plan.tasks.filter((t) => t.id === cell.task)
  const manifest = load(full, 'manifest.json')
  manifest.runs = manifest.runs.filter((r) => r.runId.startsWith(key + '-'))
  const observations = readFileSync(join(full, 'observations.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((o) => manifest.runs.some((r) => r.runId === o.runId))
  const files = new Map()
  const readRaw = (path) => {
    if (files.has(path)) return files.get(path)
    try {
      return readFileSync(join(full, 'raw', path))
    } catch {
      return null
    }
  }
  const owners = load(full, 'owners.json'),
    decision = load(full, 'decision.confirmed.json')
  const input = { plan, manifest, observations, owners, decision, readRaw }
  const put = (path, text) => {
    files.set(path, text)
    return { path, sha256: createHash('sha256').update(text).digest('hex') }
  }
  const raw = (i, data, kind = manifest.runs[i].runRef.kind) => {
    const run = manifest.runs[i],
      obs = observations.find((o) => o.runId === run.runId)
    const ref = put(run.runRef.path, typeof data === 'string' ? data : JSON.stringify(data))
    run.runRef = { ...ref, kind }
    obs.rawRef = { ...ref, range: obs.rawRef.range }
  }
  const pair = () => {
    cell.side = 'pair'
    cell.rule.mode = 'relative'
    cell.rule.unit = '비'
    cell.rule.value = 1.1
    for (const r of [...manifest.runs]) {
      const before = {
        ...structuredClone(r),
        runId: 'before-' + r.runId,
        side: 'before',
        sha: plan.wBaselineSha,
        appSource: { ...r.appSource, commit: plan.wBaselineSha }
      }
      const o = structuredClone(observations.find((o) => o.runId === r.runId))
      o.runId = before.runId
      const old = JSON.parse(readRaw(r.runRef.path))
      const ref = put(
        before.runId + '.json',
        JSON.stringify({ ...old, sha: before.sha, appSource: before.appSource })
      )
      before.runRef = { ...ref, kind: 'electron-json' }
      o.rawRef = { ...ref, range: o.rawRef.range }
      manifest.runs.push(before)
      observations.push(o)
    }
  }
  const report = () => evaluate(input),
    result = () => report().cells[0]
  return {
    input,
    cell,
    plan,
    runs: manifest.runs,
    obs: observations,
    owners,
    decision,
    readRaw,
    put,
    raw,
    pair,
    report,
    result
  }
}
function cli(dir, variant = '', change = {}) {
  const args = {
    plan: 'plan.json',
    manifest: 'manifest.json',
    observations: 'observations.jsonl',
    'raw-root': 'raw',
    owners: 'owners.json',
    decision: 'decision' + variant + '.json',
    ...change
  }
  return spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, 'windows-verdict.mjs'),
      ...Object.entries(args)
        .filter(([, v]) => v)
        .flatMap(([k, v]) => ['--' + k, join(dir, v)])
    ],
    { encoding: 'utf8' }
  )
}
for (const [name, expected] of [
  ['failing', ['불합격', '불합격']],
  ['passing', ['판정 보류', '합격']]
])
  test('report CLI: ' + name + ' example before and after confirmation', () => {
    const dir = join(root, name)
    for (const [i, variant] of ['', '.confirmed'].entries()) {
      const run = cli(dir, variant),
        report = JSON.parse(run.stdout)
      assert.equal(report.overall, expected[i])
      assert.equal(run.status, expected[i] === '합격' ? 0 : 1)
      assert.deepEqual(report, load(dir, 'expected' + variant + '.json'))
      if (name === 'failing')
        for (const k of ['violations', 'missing', 'ownerFailures']) assert.ok(report[k].length)
    }
  })
test('report CLI: owner FAIL without evidence still fails', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'oo-owner-fail-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  cpSync(full, dir, { recursive: true })
  const owners = load(dir, 'owners.json')
  owners.rows[0].machine = 'FAIL'
  delete owners.rows[0].machineRef
  writeFileSync(join(dir, 'owners.json'), JSON.stringify(owners))

  const run = cli(dir, '.confirmed')
  assert.equal(run.status, 1)
  const report = JSON.parse(run.stdout)
  assert.equal(report.overall, '불합격')
  assert.deepEqual(report.ownerFailures, ['T17/0326'])
  assert.deepEqual(report.holds, ['소유 판정 근거 없음'])
  assert.equal(report.cells.find((cell) => cell.key === 'typing').ownerMachine, 'FAIL')
})

test('cli rejects missing arguments and malformed input and supports optional owners', (t) => {
  for (const flag of ['raw-root', 'plan', 'manifest', 'observations']) {
    const invalid = cli(full, '', { [flag]: null })
    assert.equal(invalid.status, 2)
    assert.ok(invalid.stderr.includes('--' + flag))
  }
  const dir = mkdtempSync(join(tmpdir(), 'oo-verdict-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'broken.jsonl'), '{')
  const run = spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, 'windows-verdict.mjs'),
      '--plan',
      join(full, 'plan.json'),
      '--manifest',
      join(full, 'manifest.json'),
      '--raw-root',
      join(full, 'raw'),
      '--observations',
      join(dir, 'broken.jsonl')
    ],
    { encoding: 'utf8' }
  )
  assert.equal(run.status, 2)
  assert.match(run.stderr, /broken\.jsonl/)
  const noOwners = cli(full, '.confirmed', { owners: null })
  assert.equal(noOwners.status, 1)
  assert.equal(JSON.parse(noOwners.stdout).cells[0].ownerMachine, '미기록')
})

test('U1–U3 independent intervals and metrics, identical resubmission and conflicting evidence', () => {
  const f = fixture()
  for (const [metric, interval] of [
    ['second', 'interaction'],
    ['input-p95', 'later'],
    ['second', 'later']
  ]) {
    f.plan.cells.push({ ...f.cell, key: metric + interval, metric, interval })
    f.obs.push(...f.obs.slice(0, 3).map((o) => ({ ...o, metric, interval, values: [8] })))
  }
  assert.deepEqual(
    f.report().cells.map((c) => c.n),
    [3, 3, 3, 3]
  )
  f.obs.push(structuredClone(f.obs[0]))
  assert.equal(f.report().duplicates.length, 1)
  assert.equal(f.result().n, 3)
  for (const patch of [{ values: [17] }, { rawRef: { ...f.obs[0].rawRef, sha256: 'different' } }]) {
    f.obs.push({ ...f.obs[0], ...patch })
    assert.equal(f.result().reason, '충돌')
    assert.equal(f.report().conflicts.length, 1)
    f.obs.pop()
  }
})
test('U4–U5, U33, U34 absence, unobservable evidence and actual functional failures', () => {
  for (const [status, reason, expected] of [
    ['absent', '', '이전 기능 없음'],
    ['unavailable', '함수 없음', '이전 기능 없음'],
    ['unavailable', '실패: test', '측정 불가: 실패: test'],
    ['unobservable', 'no-session-owner', '이 방식으로 관측 불가: no-session-owner']
  ]) {
    const f = fixture()
    f.pair()
    Object.assign(f.obs[3], { status, reason })
    assert.equal(f.result().reason, expected)
    f.plan.cells.push({
      ...f.cell,
      key: 'absolute',
      side: 'after',
      rule: { ...f.cell.rule, mode: 'absolute', unit: 'ms', value: 50 }
    })
    assert.equal(f.report().cells[1].status, ok)
  }
  const f = fixture()
  f.obs[1].status = 'failed'
  assert.equal(f.result().status, bad)
  assert.equal(f.report().missing.length, 0)
  f.obs[1].status = 'other'
  assert.match(f.result().reason, /지원 안 함/)
})
test('U6/U16 profile and build kind must match the locked cell', () => {
  const f = fixture()
  f.runs[0].profile = '120Hz'
  assert.equal(f.result().reason, '프로필 불일치')
  f.runs[0].profile = 'desktop'
  f.plan.profiles = []
  assert.equal(f.result().reason, '프로필 불일치')
  const g = fixture()
  g.pair()
  g.runs[3].buildKind = 'install'
  assert.equal(g.result().reason, '빌드 종류 혼합')
})
test('U7/U8/U15 required slots, unexpected observations, missing repeats and owner failures coexist', () => {
  const f = fixture()
  f.input.manifest.runs.splice(1, 1)
  assert.equal(f.report().missing[0].repeat, 2)
  assert.equal(f.result().reason, '반복 부족')
  assert.equal(f.report().unexpected.length, 1)
  f.obs.push({ ...f.obs[0], metric: 'unplanned' })
  assert.equal(f.report().unexpected.length, 2)
  f.obs.length = 0
  assert.equal(f.report().missing.length, 3)
  f.plan.cells = []
  assert.throws(f.report, /필수 셀 없음/)
})
test('U9 all five comparisons around equality and unsupported rules', () => {
  for (const [operator, answers] of [
    ['<', [true, false, false]],
    ['≤', [true, true, false]],
    ['=', [false, true, false]],
    ['≥', [false, true, true]],
    ['>', [false, false, true]]
  ]) {
    const f = fixture()
    Object.assign(f.cell.rule, { operator, value: 12 })
    for (const [i, value] of [11, 12, 13].entries()) {
      f.obs.forEach((o) => (o.values = [value]))
      assert.equal(f.result().status, answers[i] ? ok : bad)
    }
  }
  for (const [field, value] of [
    ['operator', '≈'],
    ['unit', 'fps'],
    ['inputUnit', 'hz'],
    ['aggregate', 'p99'],
    ['combine', 'mean'],
    ['mode', 'other']
  ]) {
    const f = fixture()
    f.cell.rule[field] = value
    assert.match(f.result().reason, /지원 안 함/)
    assert.equal(f.report().overall, '판정 보류')
  }
  const f = fixture()
  f.plan.cells.push({
    ...f.cell,
    key: 'extra',
    required: false,
    rule: { ...f.cell.rule, value: 0 }
  })
  assert.equal(f.report().cells[1].status, '기록 전용')
  assert.equal(f.report().overall, '합격')
})
test('U10/U11 nearest rank, even median, censored floor and zero relative denominator', () => {
  const f = fixture()
  f.cell.repeats = 1
  for (const [n, expected] of [
    [1, 1],
    [19, 19],
    [20, 19],
    [21, 20]
  ]) {
    f.obs[0].values = Array.from({ length: n }, (_, i) => i + 1)
    assert.equal(f.result().aggregate, expected)
  }
  f.cell.rule.aggregate = 'median'
  f.obs[0].values = [1, 4]
  assert.equal(f.result().aggregate, 2.5)
  Object.assign(f.obs[0], { status: 'censored', bound: 16 })
  assert.equal(f.result().status, ok)
  f.cell.rule.value = 10
  assert.equal(f.result().reason, '검열')
  const g = fixture()
  g.pair()
  g.obs.slice(3).forEach((o) => (o.values = [0]))
  assert.equal(g.result().reason, '분모 0')
})
test('U12/U14/U18 agreement precedes samples and confirmation follows the last run', () => {
  const f = fixture()
  const stamp = Date.parse(f.plan.lockedAt)
  for (const delta of [-1, 0, 1]) {
    f.runs[0].startedAt = new Date(stamp + delta).toISOString()
    assert.equal(f.result().status, delta === 1 ? ok : '기록 전용')
  }
  for (const key of ['revision', 'lockedAt']) {
    const g = fixture()
    g.decision.agreement[key] = 'other'
    assert.equal(g.result().reason, '합의 불일치')
    assert.ok(g.report().holds.includes('합의 불일치'))
  }
  for (const [patch, why] of [
    [null, '사용자 확정 대기'],
    [{ revision: 'v2' }, '확정 revision 불일치'],
    [{ confirmedAt: f.plan.lockedAt }, '확정이 실행보다 앞섬']
  ]) {
    const g = fixture()
    g.decision.confirmation = patch ? { ...g.decision.confirmation, ...patch } : undefined
    assert.equal(g.report().overallReason, why)
  }
  assert.equal(f.report().overall, '합격')
  assert.equal(f.result().revision, f.plan.revision)
  f.decision.confirmation.confirmedAt = f.plan.lockedAt
  f.runs.push({ ...f.runs[0], runId: 'incomplete-attempt', endedAt: undefined })
  assert.equal(f.report().overallReason, '확정이 실행보다 앞섬')
})
test('U13 checks owner pair and W side identities independently', () => {
  const f = fixture()
  f.pair()
  assert.equal(f.result().status, ok)
  f.plan.integrationSha = 'other'
  assert.equal(f.result().reason, '통합 SHA 아님')
  f.plan.integrationSha = f.runs[0].sha
  f.plan.wBaselineSha = 'other'
  assert.equal(f.result().reason, '기준 SHA 아님')
  f.cell.sample = 'owner'
  f.runs.forEach((r) => (r.sample = 'owner'))
  assert.equal(f.result().status, ok)
  for (const side of ['before', 'after']) {
    const field = side + 'Sha',
      saved = f.cell.pair[field]
    f.cell.pair[field] = 'wrong'
    assert.equal(f.result().reason, '소유 SHA 아님')
    f.cell.pair[field] = saved
  }
})
test('U17/U24 task with two owners and independently required columns', () => {
  const f = fixture()
  f.plan.tasks[0].owners.push('0328')
  assert.throws(f.report, /T17\/0328/)
  f.plan.cells.push({ ...f.cell, key: 'owner2', owner: '0328' })
  assert.ok(f.report().missing.includes('T17/0328'))
  f.owners.rows.push({ ...f.owners.rows[0], owner: '0328' })
  assert.equal(f.report().overall, '합격')
  for (const column of ['machine', 'windows']) {
    const row = f.owners.rows.at(-1)
    delete row[column]
    assert.equal(f.report().overall, '판정 보류')
    assert.ok(f.report().holds.includes('소유 판정 없음'))
    row[column] = '미완'
    assert.equal(f.report().overall, '판정 보류')
    row[column] = 'PASS'
  }
})
test('U19/U28 raw hash, path and the exact range must be verifiable', () => {
  const f = fixture()
  const o = f.obs[0],
    rr = structuredClone(o.rawRef)
  for (const raw of [
    undefined,
    { ...rr, path: '../outside' },
    { ...rr, path: '/outside' },
    { ...rr, path: 'absent' }
  ]) {
    o.rawRef = raw
    assert.equal(f.result().reason, '원본 없음')
  }
  o.rawRef = { ...rr, sha256: 'invalid' }
  assert.equal(f.result().reason, '원본 해시 불일치')
  const ref = f.put('sample.log', Array(10).fill('line').join('\n') + '\n')
  for (const [range, expected] of [
    [{ kind: 'lines', start: 3, end: 5 }, ok],
    [{ kind: 'lines', start: 0, end: 1 }, hold],
    [{ kind: 'lines', start: 900, end: 910 }, hold],
    [{ kind: 'frames' }, hold],
    [{}, hold]
  ]) {
    o.rawRef = { ...ref, range }
    assert.equal(f.result().status, expected)
  }
  const trace = f.put('trace.json', JSON.stringify({ traceEvents: [{ ts: 100 }, { ts: 200 }] }))
  for (const [start, end, expected] of [
    [100, 150, ok],
    [150, 160, hold],
    [200, 200, ok]
  ]) {
    o.rawRef = { ...trace, range: { kind: 'trace-ts', start, end } }
    assert.equal(f.result().status, expected)
  }
  o.rawRef = { ...rr, range: { kind: 'json-pointer', pointer: '/values/0' } }
  assert.equal(f.result().status, ok)
  o.rawRef.range.pointer = '/values/1'
  assert.equal(f.result().reason, '구간 없음')
})
test('U20/U21/U29/U30 aggregation, combination, result units and unsupported equal combinations', () => {
  const f = fixture()
  const r = f.cell.rule
  Object.assign(r, {
    aggregate: 'count',
    where: { operator: '≥', value: 160, unit: 'ms' },
    unit: '건'
  })
  f.cell.repeats = 1
  f.obs[0].values = [159, 160, 161]
  assert.equal(f.result().aggregate, 2)
  f.obs[0].unit = 'frames'
  assert.equal(f.result().reason, '단위 불일치')
  f.obs[0].unit = 'ms'
  r.where.unit = 'frames'
  assert.equal(f.result().reason, '단위 불일치')
  r.where.unit = 'ms'
  r.unit = 'ms'
  assert.equal(f.result().reason, '단위 불일치')
  const g = fixture()
  g.obs.forEach((o, i) => (o.values = [10, 10, i === 0 ? 100 : 10]))
  for (const [combine, status, value] of [
    ['pooled', bad, 100],
    ['median-of-runs', ok, 10],
    ['each', bad, [100, 10, 10]]
  ]) {
    g.cell.rule.combine = combine
    assert.equal(g.result().status, status)
    assert.deepEqual(g.result().aggregate, value)
  }
  const h = fixture()
  Object.assign(h.cell.rule, {
    aggregate: 'equal',
    operator: '=',
    value: 'a',
    inputUnit: 'text',
    unit: 'text'
  })
  h.obs.forEach((o, i) => Object.assign(o, { unit: 'text', values: [i === 1 ? 'b' : 'a'] }))
  for (const combine of ['pooled', 'each']) {
    h.cell.rule.combine = combine
    assert.equal(h.result().status, bad)
  }
  h.obs[1].values = ['a']
  assert.equal(h.result().status, ok)
  h.cell.rule.combine = 'median-of-runs'
  assert.equal(h.result().reason, '지원 안 함: 조합')
  h.cell.rule.combine = 'pooled'
  h.cell.rule.mode = 'relative'
  assert.equal(h.result().reason, '지원 안 함: 조합')
  const ratio = fixture()
  ratio.cell.repeats = 1
  Object.assign(ratio.cell.rule, {
    aggregate: 'ratio',
    unit: '비',
    numerator: 'drop',
    denominator: 'total'
  })
  const den = { ...structuredClone(ratio.obs[0]), metric: 'total', values: [60] }
  ratio.obs[0].metric = 'drop'
  ratio.obs[0].values = [3]
  ratio.obs.push(den)
  assert.equal(ratio.result().aggregate, 0.05)
  den.values = [0]
  assert.equal(ratio.result().reason, '분모 0')
  den.unit = 'frames'
  assert.equal(ratio.result().reason, '단위 불일치')
  const rel = fixture()
  rel.pair()
  rel.obs.forEach((o) => (o.values = [o.runId.startsWith('before') ? 100 : 105]))
  assert.equal(rel.result().aggregate, 1.05)
  assert.equal(rel.result().status, ok)
  rel.obs[0].values = [111]
  assert.equal(rel.result().status, bad)
  Object.assign(rel.cell.rule, {
    aggregate: 'count',
    where: { operator: '≥', value: 100, unit: 'ms' }
  })
  rel.obs[3].values = [0]
  assert.equal(rel.result().aggregate, 1.5)
})
test('U22 requires the before side of the same pair and repeat', () => {
  for (const change of [{ pairId: 'other' }, { repeat: 4 }]) {
    const f = fixture()
    f.pair()
    Object.assign(f.runs[3], change)
    assert.equal(f.result().reason, '짝 없음')
  }
})
test('U23/U25/U26/U27/U35 runtime, collection and tool origin', () => {
  for (const [patch, reason] of [
    [{ environment: 'linux-electron' }, '런타임 불일치: 원본'],
    [{ env: false }, '수집 실패'],
    [{ error: 'stopped' }, '수집 실패'],
    [{ provenanceConflict: true }, '수집 실패'],
    [{ tool: 'unknown' }, '도구 출처 불명']
  ]) {
    const f = fixture()
    f.raw(0, { ...JSON.parse(f.readRaw(f.runs[0].runRef.path)), ...patch })
    assert.equal(f.result().reason, reason)
    assert.equal(f.report().missing.length, 1)
  }
  for (const change of [{ path: '../elsewhere' }, { sha256: 'wrong' }, null]) {
    const f = fixture()
    f.runs[0].profileRef = f.runs[0].runRef
    f.runs[0].runRef = change ? { ...f.runs[0].runRef, ...change } : undefined
    assert.equal(f.result().reason, '수집 실패')
  }
  const node = fixture('function')
  node.runs[0].exitCode = 1
  assert.equal(node.result().reason, '수집 실패')
  node.runs[0].exitCode = 0
  node.raw(0, 'Node v22 · linux/x64\n| I3 | x | 12.34ms / 15.00ms |')
  assert.equal(node.result().reason, '런타임 불일치: 원본')
  node.runs[0].runtime = 'linux-node'
  assert.equal(node.result().reason, '런타임 불일치')
  const capture = fixture('search')
  delete capture.runs[0].profileRef
  assert.equal(capture.result().reason, '런타임 불명')
  const f = fixture()
  const reference = structuredClone(f.cell)
  reference.key = 'linux'
  reference.profile = 'lab'
  reference.sample = 'reference'
  reference.rule.value = 0
  f.plan.cells.push(reference)
  f.plan.profiles.push({ id: 'lab', os: 'linux' })
  const original = f.runs[0]
  for (const run of [...f.runs]) {
    const id = 'ref-' + run.runId,
      ref = f.put(
        id + '.json',
        JSON.stringify({ ...JSON.parse(f.readRaw(run.runRef.path)), environment: 'linux-electron' })
      )
    f.runs.push({
      ...run,
      runId: id,
      sample: 'reference',
      profile: 'lab',
      runtime: 'linux-electron',
      runRef: { ...ref, kind: 'electron-json' }
    })
    f.obs.push({ ...f.obs[0], runId: id, rawRef: { ...ref, range: f.obs[0].rawRef.range } })
  }
  assert.equal(f.report().overall, '합격')
  assert.equal(f.report().cells[1].aggregate, 12)
  assert.equal(f.report().cells[1].reason, '참고')
  original.tools.probe.provenanceConflict = true
  assert.equal(f.result().reason, '도구 출처 불명')
})
test('U34/U37 read numeric Node table cells, N/A reasons, and only the matching run', () => {
  const f = fixture('function')
  for (const [cell, column, values, expected] of [
    ['12.34ms / 15.00ms', 'median', [12.34], ok],
    ['12.34ms / 15.00ms (시도 5)', 'max', [15], ok],
    ['0.00ms / 0.00ms', 'median', [0], ok],
    ['N/A(함수 없음)', 'median', [], '측정 불가: 함수 없음'],
    ['N/A(실패: fixture unavailable)', 'max', [], '측정 불가: 실패: fixture unavailable'],
    ['abc', 'median', [], '값 해석 불가'],
    ['12.34ms / 15.00ms', 'median', [12], '원본 값 불일치']
  ]) {
    f.raw(0, 'Node v22.12.0 · win32/x64\n| I3 | fixture | ' + cell + ' |\n')
    f.obs[0].values = values
    f.obs[0].rawRef.range.column = column
    const r = f.result()
    assert.equal(r.status === ok ? ok : r.reason, expected)
  }
  f.raw(0, 'Node v22.12.0 · win32/x64\n| I4 | fixture | 12ms / 12ms |')
  assert.equal(f.result().reason, '지표 없음')
  const g = fixture('function')
  g.obs[1].rawRef = structuredClone(g.obs[0].rawRef)
  assert.equal(g.result().reason, '다른 실행의 원본')
})
test('U31–U33/U36/U38 target markers belong to the right selection, repeat, session and row', () => {
  const f = fixture('search'),
    o = f.obs[0]
  assert.equal(f.result().n, 3)
  const select = { ts: 100, name: 'oo-select:op-r1' }
  const shown = 'oo-visible:search-target:sB:m63:op-r1'
  for (const [events, expected] of [
    [[select, { ts: 180, name: shown }], ok],
    [[select], '대상 표시 기록 없음'],
    [[select, { ts: 180, name: shown.replace('sB', 'sA') }], '대상 표시 기록 없음'],
    [[select, { ts: 180, name: shown.replace('m63', 'm64') }], '대상 표시 기록 없음'],
    [[{ ts: 90, name: shown }, select], '대상 표시 기록 없음'],
    [[select, { ts: 150, name: 'oo-highlight-other:op-r1' }], '다른 행 강조'],
    ...['no-message-id', 'no-session-owner'].map((reason) => [
      [select, { ts: 150, name: 'oo-unobservable:op-r1:' + reason }],
      '이 방식으로 관측 불가: ' + reason
    ])
  ]) {
    f.raw(0, { traceEvents: events })
    o.rawRef.range.start = 50
    const result = f.result()
    assert.equal(result.status === ok ? ok : result.reason, expected)
    if (expected === '다른 행 강조') assert.equal(result.status, bad)
  }
  o.rawRef.range.kind = 'trace-ts'
  assert.equal(f.result().reason, '다른 선택')
  const g = fixture('search')
  g.obs[1].rawRef.range.opId = 'op-r1'
  assert.equal(g.result().reason, '다른 선택')
  g.runs[0].selections[0].target.messageId = 'm64'
  assert.equal(g.result().reason, '다른 선택')
  delete g.cell.target
  assert.throws(g.report, /search/)
})
test('U32 a later search cannot consume an earlier selection’s delayed mark', () => {
  const f = fixture('search')
  f.cell.repeats = 1
  const next = structuredClone(f.cell)
  next.key = 'other'
  next.target.messageId = 'm64'
  f.plan.cells.push(next)
  f.runs[0].selections.push({
    opId: 'op2',
    input: 'enter',
    target: { kind: 'search-target', sessionId: 'sB', messageId: 'm64' }
  })
  f.raw(0, [
    { name: 'oo-select:op-r1', ts: 100 },
    { name: 'oo-select:op2', ts: 110 },
    { name: 'oo-visible:search-target:sB:m63:op-r1', ts: 120 }
  ])
  const o = structuredClone(f.obs[0])
  o.rawRef.range.opId = 'op2'
  f.obs.push(o)
  assert.deepEqual(
    f.report().cells.map((c) => c.status),
    [ok, hold]
  )
  assert.equal(f.report().cells[1].reason, '대상 표시 기록 없음')
})

test('a selection produces one trace mark and one latency value', () => {
  const f = fixture('search')
  f.obs[0].values = [12, 14]
  assert.equal(f.result().reason, '선택 표본 수 불일치')
  f.obs[0].values = [12]
  const trace = JSON.parse(f.readRaw(f.runs[0].runRef.path))
  for (const event of trace.traceEvents) {
    f.raw(0, { traceEvents: [...trace.traceEvents, event] })
    assert.equal(f.result().reason, '대상 표시 기록 없음')
  }
})

test('U29 byte maxima retain the measured value and unit', () => {
  const f = fixture('reply')
  const result = f.result()
  assert.equal(result.aggregate, 11020)
  assert.equal(result.unit, 'bytes')
  assert.equal(result.n, 9)
  assert.equal(result.status, ok)
})
test('U8/U17/U24 distinguish required keys, unrequested owner columns, and missing owners', () => {
  const f = fixture()
  f.cell.required = false
  assert.throws(f.report, /필수 셀 없음/)
  f.cell.required = true
  f.cell.ownerChecks = { machine: false, windows: false }
  f.owners.rows = []
  assert.ok(f.report().missing.includes('T17/0326'))
  f.owners.rows = [
    {
      task: 'T17',
      owner: '0326',
      machine: 'PASS',
      machineRef: 'm',
      windows: 'FAIL',
      windowsRef: 'w'
    }
  ]
  const result = f.result()
  assert.equal(result.ownerMachine, 'PASS')
  assert.equal(result.ownerWindows, 'FAIL')
  assert.equal(f.report().overall, '불합격')
  f.owners.rows[0].windows = undefined
  assert.equal(f.report().overall, '합격')
})

test('U39 keeps owner failures and reports missing evidence for each owner column', () => {
  for (const [kind, output] of [
    ['machine', 'ownerMachine'],
    ['windows', 'ownerWindows']
  ]) {
    for (const [value, ref, column, overall] of [
      ['FAIL', undefined, 'FAIL', '불합격'],
      ['PASS', undefined, '미기록', '판정 보류'],
      ['미완', undefined, '미기록', '판정 보류'],
      ['FAIL', 'verify#owner', 'FAIL', '불합격'],
      ['PASS', 'verify#owner', 'PASS', '합격'],
      ['미완', 'verify#owner', '미완', '판정 보류']
    ]) {
      const f = fixture()
      f.owners.rows[0][kind] = value
      f.owners.rows[0][kind + 'Ref'] = ref
      const report = f.report()
      assert.equal(report.cells[0][output], column)
      assert.equal(report.overall, overall)
      assert.deepEqual(report.ownerFailures, value === 'FAIL' ? ['T17/0326'] : [])
      assert.equal(report.holds.includes('소유 판정 근거 없음'), value === 'FAIL' && !ref)
    }
  }
  const f = fixture()
  // Only the row declaring the failure can supply its evidence.
  const row = f.owners.rows[0]
  row.machine = 'FAIL'
  const sibling = { ...row, machine: 'PASS', machineRef: undefined }
  f.owners.rows.push(sibling)
  assert.deepEqual(f.report().holds, [])
  sibling.machine = 'FAIL'
  assert.deepEqual(f.report().holds, ['소유 판정 근거 없음'])

  const referenceCase = fixture()
  const reference = {
    ...referenceCase.cell,
    key: 'reference',
    sample: 'reference',
    required: false
  }
  referenceCase.plan.cells.push(reference)
  referenceCase.owners.rows.push({
    task: referenceCase.cell.task,
    owner: referenceCase.cell.owner,
    key: reference.key,
    windows: 'FAIL'
  })
  const report = referenceCase.report()
  assert.equal(report.cells[1].ownerWindows, 'FAIL')
  assert.equal(report.overall, '합격')
  assert.deepEqual(report.holds, [])
})

test('U13 diagnostic overlay source carries its recorded diff hash', () => {
  const f = fixture('search')
  f.runs[0].appSource = {
    ...f.runs[0].appSource,
    tree: null,
    dirty: true,
    diffSha256: 'a'.repeat(64)
  }
  assert.equal(f.result().status, ok)
  delete f.runs[0].appSource.diffSha256
  assert.equal(f.result().reason, '도구 출처 불명')
})
