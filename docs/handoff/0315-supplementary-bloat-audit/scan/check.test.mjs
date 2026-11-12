// UT-01(extractUnits) · UT-02(check K1~K10) · UT-03(ruling) — plan §10 EP-02·EP-05·EP-06.
import test from 'node:test'
import assert from 'node:assert/strict'
import { AREAS, BLOCKS, CELLS, check, extractUnits, passes, render, ruling, writeBlocks } from './check.mjs'

// ── UT-01 ───────────────────────────────────────────────────────────────────
const names = (text, ranges = [[1, 99]]) => extractUnits(text, ranges).map((u) => u.name)

test('UT-01 P1: 최상위 function 선언', () => {
  assert.deepEqual(names('export function receive(ev) {\nasync function load() {'), ['receive', 'load'])
})
test('UT-01 P2: 2칸 들여쓴 메서드 — 제어문·constructor 는 단위가 아니다', () => {
  assert.deepEqual(names('  private async connectEvents(signal) {'), ['connectEvents'])
  assert.deepEqual(names('  if (x) {\n  for (const a of b) {\n  constructor(deps) {\n  return (\n  switch (x) {\n  while (x) {'), [])
})
test('UT-01 P3: case 라벨', () => {
  assert.deepEqual(names("      case 'turn.ended':"), ['turn.ended'])
})
test('UT-01 P4: msg.type 분기', () => {
  assert.deepEqual(names("  if (msg.type === 'result') {"), ['result'])
})
test('UT-01 P5: 최상위 const', () => {
  assert.deepEqual(names('const coalescer = createEventCoalescer('), ['coalescer'])
  assert.deepEqual(names('  const inner = 1'), [])
})
test('UT-01 U6: 구간 범위 밖 줄은 보지 않는다', () => {
  assert.deepEqual(names('function x() {\nfunction y() {\nfunction z() {', [[2, 2]]), ['y'])
  assert.deepEqual(names('function x() {', [[2, 5]]), [])
})
test('UT-01 U7: 같은 이름은 첫 등장 1개 — 줄 번호는 첫 등장', () => {
  const units = extractUnits("    case 'a':\n    case 'b':\n    case 'a':", [[1, 3]])
  assert.deepEqual(units, [
    { name: 'a', line: 1 },
    { name: 'b', line: 2 }
  ])
})
test('UT-01: 한 줄은 첫 일치 패턴만 쓴다 · 여러 범위를 합친다', () => {
  assert.deepEqual(names('function a() {\n\nfunction b() {\n\nfunction c() {', [[1, 1], [5, 5]]), ['a', 'c'])
})

// ── fixture ─────────────────────────────────────────────────────────────────
const TEST_FILE = 'app/src/main/x.test.ts'
function fixtureFiles() {
  const files = new Map()
  for (const a of AREAS) {
    const lines = files.get(a.file) ?? Array.from({ length: 2600 }, () => '')
    lines[a.ranges[0][0] - 1] = `function unit_${a.id}() {`
    files.set(a.file, lines)
  }
  const out = new Map([...files].map(([k, v]) => [k, v.join('\n')]))
  for (const p of [TEST_FILE, 'app/src/main/a.testfixture.ts', 'app/scripts/a.mjs', '.github/workflows/ci.yml', 'app/src/main/adapters/claude/mock-adapter.ts', 'app/src/main/other.ts'])
    out.set(p, 'line1\nline2\nline3')
  return out
}
const FILES = fixtureFiles()
const A1 = AREAS[0]
const site = (line) => `${A1.file}:${line}`
const premise = (verdict = 'clear') => ({ verdict, evidence: 'rg x → 0' })
function candidate(over = {}) {
  return {
    id: 'B-01',
    area: 'A1',
    lens: 'L6',
    type: 'merge',
    sites: [site(961), site(1000)],
    duplicate: '같은 판정 두 번',
    preserve: '화면 동작',
    keepStructure: '함수 경계',
    saving: { prod: 5, basis: '두 자리 중 한쪽 5줄' },
    hotEntry: null,
    premises: { raceGuard: premise(), formLock: premise(), agentsRule: premise() },
    conditions: { ui: { verdict: 'safe', evidence: 'x.test' }, perf: { verdict: 'equal_or_better', evidence: '호출 수 같음' } },
    ...over
  }
}
function greenData() {
  const none = Object.fromEntries(CELLS.map((k) => [k, 'none']))
  return {
    base: 'c1af29f',
    progress: { P1: true, P2: true, P3: true, P4: true },
    areas: AREAS.map((a) => ({
      id: a.id,
      verdicts: a.id === 'A1' ? { ...none, L6: ['B-01'], X2: ['B-02'] } : { ...none },
      basis: '전부 읽음'
    })),
    units: AREAS.map((a) => ({ area: a.id, name: `unit_${a.id}`, l6: a.id === 'A1' ? ['B-01'] : 'none', basis: 'rg → 0' })),
    candidates: [
      candidate(),
      candidate({ id: 'B-02', lens: 'L4', excess: ['X2'], type: 'remove', approval: 'required', sites: [site(970)] })
    ]
  }
}
const skeleton = BLOCKS.map((b) => `<!-- gen:${b} -->\n<!-- /gen:${b} -->`).join('\n\n')
const mdOf = (data) => writeBlocks(skeleton, render(data))
const run = (data, md = mdOf(data)) => check(data, { fileAt: (p) => FILES.get(p) ?? null, auditMd: md })
const clone = (x) => JSON.parse(JSON.stringify(x))

test('UT-02 green: 전부 유효한 입력은 위반 0 · 대기 0', () => {
  assert.deepEqual(run(greenData()), { violations: [], pending: [] })
})

/** [이름, 기대 규칙, 변이(data) — md 를 직접 바꾸려면 문자열 변환 함수를 반환]. */
const RED = [
  ['K1 구간 1개 삭제', 'K1', (d) => void d.areas.pop()],
  ['K1 모르는 구간', 'K1', (d) => void (d.areas[0].id = 'A9'), /모르는 구간 A9/],
  ['K1 X8 칸 삭제', 'K1', (d) => void delete d.areas[2].verdicts.X8],
  ['K1 L6 칸 삭제', 'K1', (d) => void delete d.areas[3].verdicts.L6],
  ['K1 값 형식', 'K1', (d) => void (d.areas[2].verdicts.X1 = 'x')],
  ['K1 빈 배열 값', 'K1', (d) => void (d.areas[2].verdicts.X1 = [])],
  ['K1 basis 빈 값', 'K1', (d) => void (d.areas[1].basis = '')],
  ['K2 단위 1행 삭제', 'K2', (d) => void d.units.pop()],
  ['K2 유령 단위', 'K2', (d) => void d.units.push({ area: 'A2', name: 'ghost', l6: 'none', basis: 'x' })],
  ['K2 행 복제', 'K2', (d) => void d.units.push(clone(d.units[1]))],
  ['K2 l6 삭제', 'K2', (d) => void delete d.units[1].l6],
  ['K2 l6 형식', 'K2', (d) => void (d.units[1].l6 = 'no')],
  ['K2 basis 빈 값', 'K2', (d) => void (d.units[1].basis = ' ')],
  ...['id', 'area', 'lens', 'type', 'sites', 'duplicate', 'preserve', 'keepStructure', 'saving', 'hotEntry', 'premises', 'conditions'].map(
    (f) => [`K3 필수 칸 ${f} 제거`, 'K3', (d) => void delete d.candidates[0][f]]
  ),
  ['K3 빈 값', 'K3', (d) => void (d.candidates[0].preserve = '')],
  ['K3 모르는 키', 'K3', (d) => void (d.candidates[0].x = 1)],
  ['K3 모르는 type', 'K3', (d) => void (d.candidates[0].type = 'x')],
  ['K3 모르는 lens', 'K3', (d) => void (d.candidates[0].lens = 'L9')],
  ['K3 모르는 area', 'K3', (d) => void (d.candidates[0].area = 'A9')],
  ['K3 id 중복', 'K3', (d) => void (d.candidates[1].id = 'B-01')],
  ['K3 id 형식', 'K3', (d) => void (d.candidates[0].id = 'X-1'), /id 형식/],
  ['K3 모르는 approval', 'K3', (d) => void (d.candidates[0].approval = 'maybe'), /모르는 approval/],
  ['K4 자리 형식', 'K4', (d) => void (d.candidates[0].sites[1] = 'no-line')],
  ['K4 파일 미실재', 'K4', (d) => void (d.candidates[0].sites[1] = 'app/src/none.ts:1')],
  ['K4 줄 초과', 'K4', (d) => void (d.candidates[0].sites[1] = `${A1.file}:99999`)],
  ['K4 L6 자리 1개', 'K4', (d) => void d.candidates[0].sites.pop()],
  ['K4 구간 안 자리 0', 'K4', (d) => void (d.candidates[0].sites = [site(10), 'app/src/main/other.ts:1'])],
  ...[TEST_FILE, 'app/src/main/a.testfixture.ts', 'app/scripts/a.mjs', '.github/workflows/ci.yml', 'app/src/main/adapters/claude/mock-adapter.ts'].map(
    (p) => [`K4 제외 패턴 ${p}`, 'K4', (d) => void (d.candidates[0].sites[1] = `${p}:1`)]
  ),
  ...['raceGuard', 'formLock', 'agentsRule'].map((p) => [`K5 전제 ${p} 제거`, 'K5', (d) => void delete d.candidates[0].premises[p]]),
  ['K5 verdict enum 밖', 'K5', (d) => void (d.candidates[0].premises.formLock.verdict = 'ok')],
  ['K5 evidence 빈 값', 'K5', (d) => void (d.candidates[0].premises.agentsRule.evidence = '')],
  ['K6 ui 제거', 'K6', (d) => void delete d.candidates[0].conditions.ui],
  ['K6 perf 제거', 'K6', (d) => void delete d.candidates[0].conditions.perf],
  ['K6 verdict enum 밖', 'K6', (d) => void (d.candidates[0].conditions.perf.verdict = 'x')],
  ['K6 evidence 빈 값', 'K6', (d) => void (d.candidates[0].conditions.ui.evidence = '')],
  ['K7 구간 칸의 유령 ID', 'K7', (d) => void (d.areas[0].verdicts.X3 = ['B-99'])],
  ['K7 단위의 유령 ID', 'K7', (d) => void (d.units[0].l6 = ['B-01', 'B-99']), /단위 A1\/unit_A1 가 없는 후보 B-99/],
  ['K7 구간 칸 area 불일치', 'K7', (d) => void (d.areas[1].verdicts.L6 = ['B-01'])],
  ['K7 단위 area 불일치', 'K7', (d) => void (d.units[1].l6 = ['B-01'])],
  ['K7 범주 불일치', 'K7', (d) => void (d.areas[0].verdicts.X3 = ['B-02'])],
  ['K7 렌즈 불일치', 'K7', (d) => void (d.areas[0].verdicts.L5 = ['B-01'])],
  ['K7 단위가 L6 아닌 후보 지목', 'K7', (d) => void (d.units[0].l6 = ['B-01', 'B-02'])],
  ['K7 고아 후보', 'K7', (d) => void (d.areas[0].verdicts.X2 = 'none')],
  ['K7 단위 없는 L6 후보', 'K7', (d) => void (d.units[0].l6 = 'none')],
  ['K8 prod 0', 'K8', (d) => void (d.candidates[0].saving.prod = 0)],
  ['K8 prod 소수', 'K8', (d) => void (d.candidates[0].saving.prod = 1.5)],
  ['K8 basis 빈 값', 'K8', (d) => void (d.candidates[0].saving.basis = '')],
  ['K8 hotEntry 미지 심볼', 'K8', (d) => void (d.candidates[0].hotEntry = 'send')],
  ['K8 L4 인데 excess 빈 배열', 'K8', (d) => void (d.candidates[1].excess = [])],
  ['K8 excess X9', 'K8', (d) => void (d.candidates[1].excess = ['X9'])],
  ['K9 remove 인데 approval 삭제', 'K9', (d) => void delete d.candidates[1].approval],
  ['K9 remove 인데 approval none', 'K9', (d) => void (d.candidates[1].approval = 'none')],
  ['K9 승인 블록에서 1행 삭제', 'K9', () => (md) => md.replace(/^\| B-02 \| 같은 판정 두 번 \| 통과 \|\n/m, '')],
  ['K10 문자 1개 수정', 'K10', () => (md) => md.replace('전부 읽음', '전부 읽음.')],
  ['K10 블록 삭제', 'K10', () => (md) => md.replace(/<!-- gen:premises -->[\s\S]*?<!-- \/gen:premises -->/, '')],
  ['K10 최상위 미지 키', 'K10', (d) => void (d.x = 1)]
]

for (const [name, rule, mutate, message] of RED) {
  test(`UT-02 red ${name}`, () => {
    const data = greenData()
    const mdEdit = mutate(data)
    const md = typeof mdEdit === 'function' ? mdEdit(mdOf(greenData())) : mdOf(data)
    if (typeof mdEdit === 'function') assert.notEqual(md, mdOf(greenData()), 'md 변이가 적용되지 않았다')
    const { violations } = run(data, md)
    assert.ok(
      violations.some((v) => v.startsWith(`${rule}:`) && (message ? message.test(v) : true)),
      `${rule} 위반이 없다: ${JSON.stringify(violations)}`
    )
  })
}

test('UT-02 red K2 기준 커밋에 구간 파일이 없다', () => {
  const data = greenData()
  const { violations } = check(data, {
    fileAt: (p) => (p === AREAS[5].file ? null : (FILES.get(p) ?? null)),
    auditMd: mdOf(data)
  })
  assert.ok(violations.some((v) => /^K2: 기준 커밋에 .*map\.ts 없음/.test(v)), JSON.stringify(violations))
})

test('UT-02 hotEntry: null 은 유효하고 진입 심볼도 유효하다', () => {
  const data = greenData()
  data.candidates[0].hotEntry = 'receive'
  assert.deepEqual(run(data).violations, [])
})

test('UT-02 대기: 완료 선언 전의 빈 판정은 red 가 아니라 pending 이다', () => {
  const data = greenData()
  data.progress.P4 = false
  delete data.areas[2].verdicts.X8
  data.units[1].l6 = null
  data.units[1].basis = ''
  const result = check(data, { fileAt: (p) => FILES.get(p) ?? null, auditMd: null })
  assert.deepEqual(result.violations, [])
  assert.equal(result.pending.length, 4)
})

test('UT-02 대기: 완료 선언 전에도 단위 집합 차이와 후보 칸 누락은 red 다', () => {
  const data = greenData()
  data.progress.P4 = false
  data.units.pop()
  delete data.candidates[0].premises.raceGuard
  const { violations } = run(data)
  assert.ok(violations.some((v) => v.startsWith('K2:')))
  assert.ok(violations.some((v) => v.startsWith('K5:')))
})

// ── UT-03 ───────────────────────────────────────────────────────────────────
let seq = 0
const pass = (over = {}) => candidate({ id: `B-${String(++seq).padStart(2, '0')}`, lens: 'L4', excess: ['X2'], ...over })
const blocked = (over = {}) =>
  pass({ premises: { raceGuard: premise('blocks'), formLock: premise(), agentsRule: premise() }, ...over })
const prod = (n) => ({ saving: { prod: n, basis: 'b' } })
const axes = (r) => [r.impl, r.wideAudit]

test('UT-03 passes: 전제 3칸·ui·perf 중 하나라도 걸리면 통과가 아니다', () => {
  assert.equal(passes(pass()), true)
  for (const p of ['raceGuard', 'formLock', 'agentsRule']) {
    const c = pass()
    c.premises[p] = premise('blocks')
    assert.equal(passes(c), false, p)
  }
  assert.equal(passes(pass({ conditions: { ui: { verdict: 'risk', evidence: 'e' }, perf: { verdict: 'equal_or_better', evidence: 'e' } } })), false)
  for (const v of ['worse', 'unknown'])
    assert.equal(passes(pass({ conditions: { ui: { verdict: 'safe', evidence: 'e' }, perf: { verdict: v, evidence: 'e' } } })), false, v)
})

test('UT-03 I1·G1: P = ∅ → 없음 · 열지 않는다', () => {
  const inputs = [
    [],
    [blocked(), blocked({ premises: { raceGuard: premise(), formLock: premise('blocks'), agentsRule: premise() } })],
    [pass({ conditions: { ui: { verdict: 'safe', evidence: 'e' }, perf: { verdict: 'unknown', evidence: 'e' } } })],
    [pass({ conditions: { ui: { verdict: 'risk', evidence: 'e' }, perf: { verdict: 'equal_or_better', evidence: 'e' } } })],
    [blocked({ lens: 'L6', hotEntry: 'receive', ...prod(300) })]
  ]
  for (const input of inputs) {
    const r = ruling(input)
    assert.deepEqual(axes(r), ['없음', '열지 않는다'])
    assert.deepEqual([r.bundles, r.reasons, r.P, r.H], [[], [], [], []])
  }
})

test('UT-03 I2·G2: 전부 소형(29·5줄) · 핫패스 아님 → 1건(묶음 1개에 전부) · 열지 않는다', () => {
  const a = pass({ area: 'A1', ...prod(29) })
  const b = pass({ area: 'A6', ...prod(5) })
  const r = ruling([a, b, blocked(prod(400))])
  assert.deepEqual(axes(r), ['1건', '열지 않는다'])
  assert.deepEqual(r.bundles, [{ area: null, ids: [a.id, b.id] }])
  assert.deepEqual(r.P, [
    { id: a.id, prod: 29 },
    { id: b.id, prod: 5 }
  ])
})

test('UT-03 I3: 30줄 이상이 하나라도 있으면 영역별 묶음 — 소형도 자기 구간 묶음에 든다', () => {
  const a = pass({ area: 'A1', ...prod(30) })
  const b = pass({ area: 'A1', ...prod(5) })
  const c = pass({ area: 'A6', ...prod(12) })
  const r = ruling([c, a, b])
  assert.equal(r.impl, '영역별 묶음')
  assert.deepEqual(r.bundles, [
    { area: 'A1', ids: [a.id, b.id] },
    { area: 'A6', ids: [c.id] }
  ])
  const single = pass({ area: 'A3', ...prod(30) })
  assert.deepEqual(ruling([single]).bundles, [{ area: 'A3', ids: [single.id] }])
})

test('UT-03 W1: 핫패스 L6 통과 후보(5줄) → 연다(W1 만)', () => {
  const r = ruling([pass({ lens: 'L6', hotEntry: 'receive', ...prod(5) })])
  assert.deepEqual([r.wideAudit, r.reasons], ['연다', ['W1']])
})

test('UT-03 W2: 30줄 통과 후보(콜드 L4) → 연다(W2 만)', () => {
  const r = ruling([pass({ ...prod(30) })])
  assert.deepEqual([r.wideAudit, r.reasons, r.H], ['연다', ['W2'], []])
})

test('UT-03 W3: H = ∅ 이고 전부 소형이면 열지 않는다 — L6 콜드 · L4 핫', () => {
  assert.equal(ruling([]).wideAudit, '열지 않는다')
  assert.equal(ruling([pass({ lens: 'L6', hotEntry: null, ...prod(29) })]).wideAudit, '열지 않는다')
  assert.equal(ruling([pass({ lens: 'L4', hotEntry: 'receive', ...prod(29) })]).wideAudit, '열지 않는다')
})

test('UT-03 G3: 핫패스 L6 30줄 + 콜드 5줄 → 영역별 묶음 · 연다(W1·W2)', () => {
  const r = ruling([pass({ lens: 'L6', hotEntry: 'receive', ...prod(30) }), pass(prod(5))])
  assert.deepEqual([...axes(r), r.reasons], ['영역별 묶음', '연다', ['W1', 'W2']])
})

test('UT-03 G4: 핫패스 L6 29줄 → 1건 · 연다', () => {
  const c = pass({ lens: 'L6', hotEntry: 'receive', ...prod(29) })
  const r = ruling([c])
  assert.deepEqual(axes(r), ['1건', '연다'])
  assert.deepEqual(r.H, [{ id: c.id, prod: 29 }])
})

test('UT-03 G5: H = ∅ 이고 30줄 이상 → 영역별 묶음 · 연다', () => {
  assert.deepEqual(axes(ruling([pass({ hotEntry: null, ...prod(30) })])), ['영역별 묶음', '연다'])
  const r = ruling([pass({ lens: 'L4', hotEntry: 'receive', ...prod(40) })])
  assert.deepEqual([...axes(r), r.H, r.reasons], ['영역별 묶음', '연다', [], ['W2']])
})

test('render: ruling 블록이 두 축 값과 승인 목록을 싣는다', () => {
  const text = render(greenData()).ruling
  assert.match(text, /\| 구현 건수 \| 1건 \|/)
  assert.match(text, /\| 넓은 감사 \| 열지 않는다 \|/)
  assert.match(text, /^\| B-02 \|/m)
})
