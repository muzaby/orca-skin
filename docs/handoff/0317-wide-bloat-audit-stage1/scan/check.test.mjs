// UT-01(extractUnits) · UT-02(check K1~K12) · UT-03(ruling) · UT-04(deriveTargets) — plan §10 EP-02·EP-05·EP-06·EP-10.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AREAS, BLOCKS, BUCKETS, CATALOG_ROOTS, CELLS, codeViews, HOT_ENTRIES, I18N_EN, I18N_KO, READ_0315, REF_FORMS, catalogRemoval, catalogTree, check, collectRead, deriveI18n, deriveTargets, extractUnits, i18nBase, i18nRefs, i18nScopes, passes, refIndex, refTally, render, ruling, stripCatalog, writeBlocks } from './check.mjs'

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
  assert.deepEqual(names('export const en: typeof ko = {'), [])
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
const KO = AREAS[9]
const EN = AREAS[8]
const site = (line) => `${A1.file}:${line}`
const premise = (verdict = 'clear') => ({ verdict, evidence: 'rg x → 0' })
function candidate(over = {}) {
  return {
    id: 'W-01',
    area: 'F01',
    lens: 'L6',
    type: 'merge',
    sites: [site(10), site(20)],
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
function i18nCandidate(over = {}) {
  return candidate({
    id: 'W-03',
    area: 'F10',
    lens: 'L1',
    type: 'remove',
    approval: 'required',
    sites: [`${KO.file}:5`, `${EN.file}:5`],
    i18nKeys: ['a.b', 'a.c'],
    dynamicPrefix: 'git grep → 접두사 3개, 겹침 0',
    saving: { prod: 4, basis: '두 파일 2줄씩' },
    ...over
  })
}
function greenData() {
  const none = Object.fromEntries(CELLS.map((k) => [k, 'none']))
  return {
    base: '1168b67',
    progress: { P1: true, P2: true, P3: true, P4: true },
    areas: AREAS.map((a) => ({
      id: a.id,
      verdicts: a.id === 'F01' ? { ...none, L6: ['W-01'], X2: ['W-02'] } : a.id === 'F10' ? { ...none, L1: ['W-03'] } : { ...none },
      basis: '전부 읽음'
    })),
    units: AREAS.map((a) => ({ area: a.id, name: `unit_${a.id}`, l6: a.id === 'F01' ? ['W-01'] : 'none', basis: 'rg → 0' })),
    candidates: [
      candidate(),
      candidate({ id: 'W-02', lens: 'L4', excess: ['X2'], type: 'remove', approval: 'required', sites: [site(30)] }),
      i18nCandidate()
    ]
  }
}
const skeleton = BLOCKS.map((b) => `<!-- gen:${b} -->\n<!-- /gen:${b} -->`).join('\n\n')
const mdOf = (data) => writeBlocks(skeleton, render(data))
const TARGET_FILES = AREAS.map((a) => ({ path: a.file, lines: a.ranges[0][1] }))
const facts = (over = {}) => ({ fileAt: (p) => FILES.get(p) ?? null, files: TARGET_FILES, read: new Set(), ...over })
const run = (data, md = mdOf(data), over = {}) => check(data, facts({ auditMd: md, ...over }))
const clone = (x) => JSON.parse(JSON.stringify(x))

test('UT-02 green: 전부 유효한 입력은 위반 0 · 대기 0', () => {
  assert.deepEqual(run(greenData()), { violations: [], pending: [] })
})

/** [이름, 기대 규칙, 변이(data) — md 를 직접 바꾸려면 문자열 변환 함수를 반환]. */
const RED = [
  ['K1 구간 1개 삭제', 'K1', (d) => void d.areas.pop()],
  ['K1 모르는 구간', 'K1', (d) => void (d.areas[0].id = 'F99'), /모르는 구간 F99/],
  ['K1 X8 칸 삭제', 'K1', (d) => void delete d.areas[2].verdicts.X8],
  ['K1 L6 칸 삭제', 'K1', (d) => void delete d.areas[3].verdicts.L6],
  ['K1 값 형식', 'K1', (d) => void (d.areas[2].verdicts.X1 = 'x')],
  ['K1 빈 배열 값', 'K1', (d) => void (d.areas[2].verdicts.X1 = [])],
  ['K1 basis 빈 값', 'K1', (d) => void (d.areas[1].basis = '')],
  ['K2 단위 1행 삭제', 'K2', (d) => void d.units.pop()],
  ['K2 유령 단위', 'K2', (d) => void d.units.push({ area: 'F02', name: 'ghost', l6: 'none', basis: 'x' })],
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
  ['K3 모르는 area', 'K3', (d) => void (d.candidates[0].area = 'F99')],
  ['K3 id 중복', 'K3', (d) => void (d.candidates[1].id = 'W-01')],
  ['K3 id 형식', 'K3', (d) => void (d.candidates[0].id = 'X-1'), /id 형식/],
  ['K3 모르는 approval', 'K3', (d) => void (d.candidates[0].approval = 'maybe'), /모르는 approval/],
  ['K4 자리 형식', 'K4', (d) => void (d.candidates[0].sites[1] = 'no-line')],
  ['K4 파일 미실재', 'K4', (d) => void (d.candidates[0].sites[1] = 'app/src/none.ts:1')],
  ['K4 줄 초과', 'K4', (d) => void (d.candidates[0].sites[1] = `${A1.file}:99999`)],
  ['K4 L6 자리 1개', 'K4', (d) => void d.candidates[0].sites.pop()],
  ['K4 구간 안 자리 0', 'K4', (d) => void (d.candidates[0].sites = ['app/src/main/other.ts:1', 'app/src/main/other.ts:2'])],
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
  ['K7 구간 칸의 유령 ID', 'K7', (d) => void (d.areas[0].verdicts.X3 = ['W-99'])],
  ['K7 단위의 유령 ID', 'K7', (d) => void (d.units[0].l6 = ['W-01', 'W-99']), /단위 F01\/unit_F01 가 없는 후보 W-99/],
  ['K7 구간 칸 area 불일치', 'K7', (d) => void (d.areas[1].verdicts.L6 = ['W-01'])],
  ['K7 단위 area 불일치', 'K7', (d) => void (d.units[1].l6 = ['W-01'])],
  ['K7 범주 불일치', 'K7', (d) => void (d.areas[0].verdicts.X3 = ['W-02'])],
  ['K7 렌즈 불일치', 'K7', (d) => void (d.areas[0].verdicts.L5 = ['W-01'])],
  ['K7 단위가 L6 아닌 후보 지목', 'K7', (d) => void (d.units[0].l6 = ['W-01', 'W-02'])],
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
  ['K9 승인 블록에서 1행 삭제', 'K9', () => (md) => md.replace(/^\| W-02 \| 같은 판정 두 번 \| 통과 \|\n/m, '')],
  ['K10 문자 1개 수정', 'K10', () => (md) => md.replace('전부 읽음', '전부 읽음.')],
  ['K10 블록 삭제', 'K10', () => (md) => md.replace(/<!-- gen:premises -->[\s\S]*?<!-- \/gen:premises -->/, '')],
  ['K10 최상위 미지 키', 'K10', (d) => void (d.x = 1)],
  ['K12 i18n 꼴인데 i18nKeys 삭제', 'K12', (d) => void delete d.candidates[2].i18nKeys, /i18nKeys 없음/],
  ['K12 i18nKeys 빈 배열', 'K12', (d) => void (d.candidates[2].i18nKeys = []), /i18nKeys 없음/],
  ['K12 F09 의 L1 remove 도 i18nKeys 필수', 'K12', (d) => void (d.candidates[1] = { ...d.candidates[1], area: 'F09', lens: 'L1', sites: [`${EN.file}:3`] }), /W-02 i18n 구간의 L1 remove 인데 i18nKeys 없음/],
  ['K12 i18nKeys 가 있는데 area 가 F01', 'K12', (d) => void (d.candidates[2].area = 'F01'), /L1 remove 가 아니다/],
  ['K12 i18nKeys 가 있는데 lens 가 L6', 'K12', (d) => void (d.candidates[2].lens = 'L6'), /L1 remove 가 아니다/],
  ['K12 i18nKeys 가 있는데 type 이 merge', 'K12', (d) => void (d.candidates[2].type = 'merge'), /L1 remove 가 아니다/],
  ['K12 dynamicPrefix 삭제', 'K12', (d) => void delete d.candidates[2].dynamicPrefix, /dynamicPrefix 근거 없음/],
  ['K12 dynamicPrefix 빈 값', 'K12', (d) => void (d.candidates[2].dynamicPrefix = ''), /dynamicPrefix 근거 없음/],
  ['K12 i18n 아닌 후보에 dynamicPrefix', 'K12', (d) => void (d.candidates[0].dynamicPrefix = 'x'), /dynamicPrefix 가 있는데 i18nKeys 없음/]
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
  const { violations } = check(data, facts({ fileAt: (p) => (p === AREAS[5].file ? null : (FILES.get(p) ?? null)), auditMd: mdOf(data) }))
  assert.ok(violations.some((v) => /^K2: 기준 커밋에 .*CanonicalBackgroundContent\.tsx 없음/.test(v)), JSON.stringify(violations))
})

test('UT-02 hotEntry: null 은 유효하고 진입 심볼도 유효하다', () => {
  const data = greenData()
  data.candidates[0].hotEntry = 'LegacySubAgentContent'
  assert.deepEqual(run(data).violations, [])
})

test('UT-02 EP-07: 핫패스 심볼은 messages 를 구독하는 컴포넌트 셋이고 셋 다 유효하다', () => {
  assert.deepEqual(HOT_ENTRIES, ['CanonicalBackgroundContent', 'LegacySubAgentHeader', 'LegacySubAgentContent'])
  for (const symbol of HOT_ENTRIES) {
    const data = greenData()
    data.candidates[0].hotEntry = symbol
    assert.deepEqual(run(data).violations, [], symbol)
  }
})

test('UT-02 대기: 완료 선언 전의 빈 판정은 red 가 아니라 pending 이다', () => {
  const data = greenData()
  data.progress.P4 = false
  delete data.areas[2].verdicts.X8
  data.units[1].l6 = null
  data.units[1].basis = ''
  const result = check(data, facts({ auditMd: null }))
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

test('UT-02 red K11: 유도 대상인데 AREAS 에 없는 파일', () => {
  const data = greenData()
  const extra = { path: `${BUCKETS[3]}ui/New.tsx`, lines: 300 }
  const { violations } = run(data, mdOf(data), { files: [...TARGET_FILES, extra] })
  assert.deepEqual(violations, [`K11: 유도 대상인데 AREAS 에 없다 ${extra.path}`])
})
test('UT-02 red K11: AREAS 에 있는데 유도 대상이 아닌 파일 — 읽은 집합 · 줄 수 미달', () => {
  const data = greenData()
  assert.deepEqual(run(data, mdOf(data), { read: new Set([AREAS[3].file]) }).violations, [`K11: AREAS 에 있는데 유도 대상이 아니다 ${AREAS[3].file}`])
  const short = TARGET_FILES.map((f, i) => (i === 0 ? { ...f, lines: 299 } : f))
  assert.deepEqual(run(data, mdOf(data), { files: short }).violations, [`K11: AREAS 에 있는데 유도 대상이 아니다 ${AREAS[0].file}`])
})
test('UT-02 K11 은 완료 선언 전에도 대기가 아니라 red 다', () => {
  const data = greenData()
  data.progress.P4 = false
  assert.ok(run(data, mdOf(data), { files: TARGET_FILES.slice(1) }).violations.some((v) => v.startsWith('K11:')))
})

// ── UT-03 ───────────────────────────────────────────────────────────────────
let seq = 0
const pass = (over = {}) => candidate({ id: `W-${String(++seq).padStart(2, '0')}`, lens: 'L4', excess: ['X2'], ...over })
const blocked = (over = {}) => pass({ premises: { raceGuard: premise('blocks'), formLock: premise(), agentsRule: premise() }, ...over })
const prod = (n) => ({ saving: { prod: n, basis: 'b' } })
const i18n = (n, over = {}) => i18nCandidate({ id: `W-${String(++seq).padStart(2, '0')}`, ...prod(n), ...over })
const END = '0305 계열 종료'
const ASK = '다음 단계 사용자 결정'

test('UT-03 passes: 전제 3칸·ui·perf 중 하나라도 걸리면 통과가 아니다', () => {
  assert.equal(passes(pass()), true)
  for (const k of ['raceGuard', 'formLock', 'agentsRule']) {
    const c = pass()
    c.premises[k] = premise('blocks')
    assert.equal(passes(c), false, k)
  }
  assert.equal(passes(pass({ conditions: { ui: { verdict: 'risk', evidence: 'e' }, perf: { verdict: 'equal_or_better', evidence: 'e' } } })), false)
  for (const verdict of ['worse', 'unknown'])
    assert.equal(passes(pass({ conditions: { ui: { verdict: 'safe', evidence: 'e' }, perf: { verdict, evidence: 'e' } } })), false, verdict)
})

test('UT-03 R1: P = ∅ → 종료 · sum 0', () => {
  const none = ruling([])
  assert.deepEqual([none.verdict, none.sum, none.limit, none.P, none.blocked, none.total], [END, 0, 30, [], [], 0])
  assert.deepEqual(none.i18n, { candidates: 0, keys: 0, prod: 0, items: [] })
  const two = ruling([blocked(prod(40)), blocked(prod(40))])
  assert.deepEqual([two.verdict, two.sum, two.total, two.blocked.length], [END, 0, 80, 2])
  assert.deepEqual(two.blocked[0].cells, ['raceGuard'])
  const unknown = pass({ ...prod(50), conditions: { ui: { verdict: 'safe', evidence: 'e' }, perf: { verdict: 'unknown', evidence: 'e' } } })
  assert.deepEqual([ruling([unknown]).verdict, ruling([unknown]).sum, ruling([unknown]).blocked[0].cells], [END, 0, ['perf']])
  const risk = pass({ ...prod(50), conditions: { ui: { verdict: 'risk', evidence: 'e' }, perf: { verdict: 'equal_or_better', evidence: 'e' } } })
  assert.deepEqual([ruling([risk]).verdict, ruling([risk]).sum, ruling([risk]).blocked[0].cells], [END, 0, ['ui']])
})

test('UT-03 R2: P ≠ ∅ 이고 sum < 30 → 종료 (경계 29)', () => {
  const a = pass(prod(20))
  const b = pass(prod(9))
  const r = ruling([a, b])
  assert.deepEqual([r.verdict, r.sum, r.total], [END, 29, 29])
  assert.deepEqual(r.P, [{ id: a.id, prod: 20 }, { id: b.id, prod: 9 }])
  const mixed = ruling([pass(prod(5)), blocked(prod(100))])
  assert.deepEqual([mixed.verdict, mixed.sum, mixed.total, mixed.blocked.length], [END, 5, 105, 1])
})

test('UT-03 R3: sum ≥ 30 → 사용자 결정 (경계 30 — 각 후보는 30 미만이어도 합으로 판정)', () => {
  const split = ruling([pass(prod(15)), pass(prod(15))])
  assert.deepEqual([split.verdict, split.sum], [ASK, 30])
  assert.deepEqual([ruling([pass(prod(30))]).verdict, ruling([pass(prod(30))]).sum], [ASK, 30])
  const r = ruling([pass(prod(31)), blocked(prod(1))])
  assert.deepEqual([r.verdict, r.sum, r.total], [ASK, 31, 32])
})

test('UT-03 R4: i18n 미사용 키 후보는 sum·total·P·blocked 밖의 별도 집계다', () => {
  const only = i18n(100)
  const r1 = ruling([only])
  assert.deepEqual([r1.verdict, r1.sum, r1.total, r1.P, r1.blocked], [END, 0, 0, [], []])
  assert.deepEqual(r1.i18n, { candidates: 1, keys: 2, prod: 100, items: [{ id: only.id, keys: 2, prod: 100, pass: true }] })
  const r2 = ruling([pass(prod(29)), i18n(5)])
  assert.deepEqual([r2.verdict, r2.sum, r2.total, r2.i18n.prod], [END, 29, 29, 5])
  const r3 = ruling([pass(prod(30)), i18n(40, { i18nKeys: ['k'] })])
  assert.deepEqual([r3.verdict, r3.sum, r3.total, r3.i18n.prod, r3.i18n.keys], [ASK, 30, 30, 40, 1])
  const stuck = i18n(7, { premises: { raceGuard: premise(), formLock: premise('blocks'), agentsRule: premise() } })
  const r4 = ruling([stuck])
  assert.deepEqual([r4.blocked, r4.i18n.items], [[], [{ id: stuck.id, keys: 2, prod: 7, pass: false }]])
})

test('render: ruling 블록이 판정·합·i18n 집계·승인 목록을 싣는다', () => {
  const text = render(greenData()).ruling
  assert.match(text, /\| 판정 \| 0305 계열 종료 \| 통과 후보 감량 합 10줄 < 30줄 \|/)
  assert.match(text, /\| i18n 미사용 키\(문턱 밖 별도 집계\) \| 후보 1건 · 키 2개 · 4줄 \|/)
  assert.match(text, /^\| W-02 \|/m)
  assert.match(text, /^\| W-03 \|/m)
  const big = greenData()
  big.candidates[0].saving.prod = 25
  assert.match(render(big).ruling, /\| 판정 \| 다음 단계 사용자 결정 \| 통과 후보 감량 합 30줄 ≥ 30줄 \|/)
})
test('render: premises 블록이 i18n 후보의 동적 접두사 근거를 싣는다', () => {
  assert.match(render(greenData()).premises, /\| git grep → 접두사 3개, 겹침 0 \|/)
})

// ── UT-04 ───────────────────────────────────────────────────────────────────
const f = (path, lines = 400) => ({ path, lines })
const derive = (files, read = []) => deriveTargets({ files, read: new Set(read) })

test('UT-04 T1: 4버킷 접두사만 대상이다', () => {
  for (const b of BUCKETS) assert.deepEqual(derive([f(`${b}x.ts`)]), [`${b}x.ts`], b)
  assert.equal(BUCKETS.length, 4)
  assert.deepEqual(derive([f('app/src/main/adapters/claude/x.ts'), f('app/src/renderer/src/shared-x/y.ts')]), [])
})
test('UT-04 T2: .ts·.tsx 만 대상이다', () => {
  assert.deepEqual(derive([f(`${BUCKETS[3]}a.tsx`), f(`${BUCKETS[3]}a.css`), f(`${BUCKETS[3]}a.ts`)]), [`${BUCKETS[3]}a.ts`, `${BUCKETS[3]}a.tsx`])
})
test('UT-04 T3: 테스트·fixture·선언 파일은 대상이 아니다', () => {
  assert.deepEqual(derive([f(`${BUCKETS[0]}a.test.ts`), f(`${BUCKETS[0]}a.testfixture.ts`), f(`${BUCKETS[0]}a.d.ts`)]), [])
})
test('UT-04 T4: 300줄 이상 — 299 는 제외, 300 은 대상', () => {
  assert.deepEqual(derive([f(`${BUCKETS[1]}a.ts`, 299), f(`${BUCKETS[1]}b.ts`, 300)]), [`${BUCKETS[1]}b.ts`])
})
test('UT-04 T5: 읽은 집합의 파일은 제외 — 경로 전체로 대조한다', () => {
  assert.deepEqual(derive([f(`${BUCKETS[2]}send.ts`), f(`${BUCKETS[1]}send.ts`)], [`${BUCKETS[2]}send.ts`]), [`${BUCKETS[1]}send.ts`])
})
test('UT-04 T6: 경로 사전순 · 중복 없음', () => {
  assert.deepEqual(derive([f(`${BUCKETS[3]}b.ts`), f(`${BUCKETS[3]}a.ts`), f(`${BUCKETS[3]}b.ts`)]), [`${BUCKETS[3]}a.ts`, `${BUCKETS[3]}b.ts`])
})
test('UT-04 T7: collectRead — 두 JSON 의 read 합집합 ∪ extra', () => {
  const deep = { reviews: [{ bucket: 'x', read: ['a.ts', 'c.ts'] }] }
  const reviews = { reviews: [{ scenario: 'S', read: ['b.ts', 'c.ts'] }, { scenario: 'T' }] }
  assert.deepEqual([...collectRead({ deep, reviews, extra: ['e.ts'] })].sort(), ['a.ts', 'b.ts', 'c.ts', 'e.ts'])
  assert.deepEqual([...collectRead({ deep, reviews: { reviews: [] } })].sort(), ['a.ts', 'c.ts'])
})
test('UT-04 T7: READ_0315 는 0315 검사기 AREAS 의 파일 집합과 같다', () => {
  const src = readFileSync(new URL('../../0315-supplementary-bloat-audit/scan/check.mjs', import.meta.url), 'utf8')
  const expand = (s) => s.replace('${R}', 'app/src/renderer/src/features/chat/').replace('${M}', 'app/src/main/')
  const block = src.slice(src.indexOf('export const AREAS'), src.indexOf('export const CELLS'))
  const files = new Set([...block.matchAll(/file: `([^`]+)`/g)].map((m) => expand(m[1])))
  assert.deepEqual([...files].sort(), [...READ_0315].sort())
})

// ── i18n 근거 도구(r2 — verify r1 발견 1) — catalogTree · catalogRemoval · refIndex · i18nRefs ──────────
const CATALOG = [
  "import { X } from './x'", //                                   1
  '// 머리 주석 { 중괄호 }', //                                     2
  'export const ko = {', //                                       3
  '  a: {', //                                                    4
  "    b: 'B',", //                                               5
  '    \'needs-auth\': "N",', //                                  6
  '    // 주석 — 세지 않는다', //                                  7
  '    c:', //                                                    8
  "      '여러 줄 값',", //                                       9
  '    t: `템플릿 ${X} {중괄호} ${fn({ k: 1 })}`,', //            10
  "    rail: { x: 'X', y: 'Y' }", //                              11
  '  },', //                                                      12
  '  toast: {', //                                                13
  "    e1: 'E, 쉼표'", //                                         14
  '  } satisfies Record<A, string>,', //                          15
  "  z: 'Z'", //                                                  16
  '}' //                                                          17
].join('\n')

test('i18n catalogTree: 잎 키·객체와 줄 범위 — 따옴표 키 · 여러 줄 값 · 템플릿 안 중괄호 · 한 줄 객체 · satisfies 꼬리', () => {
  const tree = catalogTree(CATALOG)
  assert.equal(tree.name, 'ko')
  assert.deepEqual(
    tree.leaves.map((l) => [l.path, l.from, l.to]),
    [
      ['a.b', 5, 5],
      ['a.needs-auth', 6, 6],
      ['a.c', 8, 9],
      ['a.t', 10, 10],
      ['a.rail.x', 11, 11],
      ['a.rail.y', 11, 11],
      ['toast.e1', 14, 14],
      ['z', 16, 16]
    ]
  )
  assert.deepEqual(
    tree.objects.map((o) => [o.path, o.from, o.to]),
    [
      ['a.rail', 11, 11],
      ['a', 4, 12],
      ['toast', 13, 15]
    ]
  )
  assert.equal(tree.leaves.find((l) => l.path === 'toast.e1').value, "'E, 쉼표'")
  assert.equal(catalogTree('export const en: typeof ko = {\n  q: { r: 1 }\n}').leaves[0].path, 'q.r')
})
test('i18n catalogTree: 모르는 형태(펼침 · 계산 키 · 축약 속성 · 선언 없음)는 throw 한다', () => {
  assert.throws(() => catalogTree('export const ko = {\n  ...base,\n  a: 1\n}'), /모르는 속성 형태/)
  assert.throws(() => catalogTree("export const ko = {\n  [k]: 'v'\n}"), /모르는 속성 형태/)
  assert.throws(() => catalogTree('export const ko = {\n  a,\n  b: 1\n}'), /콜론 없음/)
  assert.throws(() => catalogTree('const ko = {}'), /선언이 없다/)
})
test('i18n catalogRemoval: 지워지는 줄 — 공유 줄은 남고 · 빈 객체는 함께 · 여러 줄 값 · 주석 제외 · 없는 키 보고', () => {
  const tree = catalogTree(CATALOG)
  assert.deepEqual(catalogRemoval(tree, ['a.b']), { lines: [5], sites: [5], missing: [], objects: [] })
  assert.deepEqual(catalogRemoval(tree, ['a.c']).lines, [8, 9])
  assert.deepEqual(catalogRemoval(tree, ['a.rail.x']).lines, [])
  assert.deepEqual(catalogRemoval(tree, ['a.rail.x', 'a.rail.y']), { lines: [11], sites: [11, 11], missing: [], objects: ['a.rail'] })
  assert.deepEqual(catalogRemoval(tree, ['toast.e1']), { lines: [13, 14, 15], sites: [14], missing: [], objects: ['toast'] })
  assert.deepEqual(catalogRemoval(tree, ['nope', 'z']), { lines: [16], sites: [16], missing: ['nope'], objects: [] })
  const whole = catalogRemoval(tree, ['a.b', 'a.needs-auth', 'a.c', 'a.t', 'a.rail.x', 'a.rail.y'])
  assert.deepEqual(whole.lines, [4, 5, 6, 8, 9, 10, 11, 12])
  assert.deepEqual(whole.objects, ['a.rail', 'a'])
})

test('i18n codeViews: 주석은 두 보기에서 · 문자열·템플릿 정적 부분은 code 보기에서 가린다 — ${} 안·대괄호 키는 코드로 남는다', () => {
  const text = "a('x.y') // ko.c.d\n`t.${ko.e.f}.u` /* ko.g\n.h */ ko['i']\n/['\"]/.test(z) && ko.j.k"
  const { comments, code } = codeViews(text)
  assert.equal(comments.length, text.length)
  assert.equal(code.split('\n').length, text.split('\n').length)
  const sp = (n) => ' '.repeat(n)
  const tail = `\n${sp(5)} ko['i']\n/['"]/.test(z) && ko.j.k`
  assert.equal(comments, `a('x.y')${sp(10)}\n\`t.\${ko.e.f}.u\`${sp(8)}${tail}`)
  assert.equal(code, `a('${sp(3)}')${sp(10)}\n\`${sp(2)}\${ko.e.f}${sp(2)}\`${sp(8)}${tail}`)
})
const forms = (files, key) => i18nRefs(refIndex(files), key).map((h) => `${h.form}@${h.path}:${h.line}`)
test('i18n i18nRefs string: 키 경로와 같은 따옴표 문자열 — 복수형 접미사 · translation: 접두 포함, 더 긴 키는 아니다', () => {
  const files = [{ path: 'src/x.ts', text: "tr('a.b')\nt(\"a.b_other\")\nt(`translation:a.b`)\ntr('a.bX')\ntr('a.b.c')" }]
  assert.deepEqual(forms(files, 'a.b').sort(), ['string@src/x.ts:1', 'string@src/x.ts:2', 'string@src/x.ts:3'])
})
test('i18n i18nRefs prop: 키 경로를 담은 멤버 체인 — 점 · ?. · 정적 대괄호 · 호출 뒤 · 줄바꿈 · 문자열 메서드, 더 긴 이름은 아니다', () => {
  const text = ['ko.a.b', 'en?.a?.b', "ko['a'][\"b\"]", 'foo().a.b', 'ko', '  .a', '  .b', 'ko.a.b.trim()', 'ko.a.bX', 'ko.a.c'].join('\n')
  assert.deepEqual(forms([{ path: 's.test.ts', text }], 'a.b').sort(), [
    'prop@s.test.ts:1',
    'prop@s.test.ts:2',
    'prop@s.test.ts:3',
    'prop@s.test.ts:4',
    'prop@s.test.ts:5',
    'prop@s.test.ts:8'
  ])
})
test('i18n i18nRefs ancestorString: 조상 경로 문자열 — 2단 이상은 그대로·끝 점, 1단은 끝 점만', () => {
  const text = ["x('a.b')", "x('a.b.')", "x('a.')", "x('a')", "x('a.bc')"].join('\n')
  assert.deepEqual(forms([{ path: 'x.ts', text }], 'a.b.c').sort(), ['ancestorString@x.ts:1', 'ancestorString@x.ts:2', 'ancestorString@x.ts:3'])
})
test('i18n i18nRefs ancestorProp: ko/en 에서 시작해 조상에서 끝나는 체인(통째·계산 접근) — 형제 접근·다른 루트는 아니다', () => {
  assert.deepEqual(CATALOG_ROOTS, ['ko', 'en'])
  const text = ['use(ko.a.b)', 'ko.a.b[k]', 'Object.keys(en.a)', 'ko.a.b.d', 'x.a.b', 'ko.a.bc'].join('\n')
  assert.deepEqual(forms([{ path: 'x.test.ts', text }], 'a.b.c').sort(), ['ancestorProp@x.test.ts:1', 'ancestorProp@x.test.ts:2', 'ancestorProp@x.test.ts:3'])
})
test('i18n i18nRefs template: 점으로 끝나는 머리 · 점을 담은 다른 머리 · 점으로 시작하는 꼬리 — 점 없는 머리는 아니다', () => {
  const text = ['tr(`a.${k}`)', 'tr(`a.b${s}`)', 'tr(`${p}.c`)', 'tr(`x${k}`)', 'tr(`q.${k}`)'].join('\n')
  assert.deepEqual(forms([{ path: 't.ts', text }], 'a.bc'), ['templateHead@t.ts:1', 'templateHeadLoose@t.ts:2'])
  assert.deepEqual(forms([{ path: 't.ts', text }], 'a.b.c'), ['templateHead@t.ts:1', 'templateHeadLoose@t.ts:2', 'templateTail@t.ts:3'])
})
test('i18n i18nRefs bare: 문서(.md)의 점 경로 낱말 — 키 · 접두 루트 · 조상 · 조상.* , 더 긴 낱말은 아니다', () => {
  const text = ['`a.b.c` 를 쓴다', 'ko.a.b.c 접근', '`a.b.*` 묶음', 'a.b.cd 는 다르다', '파일 docs/a.b.c 경로'].join('\n')
  assert.deepEqual(forms([{ path: 'docs/d.md', text }], 'a.b.c').sort(), ['bare@docs/d.md:1', 'bare@docs/d.md:2', 'bareAncestor@docs/d.md:3'])
  assert.deepEqual(forms([{ path: 'docs/d.ts', text: '// a.b.c 를 쓴다' }], 'a.b.c'), [])
})
test('i18n REF_FORMS: 형태 목록이 i18nRefs 가 내는 형태와 같다(분류 누락 없음)', () => {
  const files = [
    { path: 'p.ts', text: "tr('a.b.c')\nko.a.b.c\nx('a.b')\nuse(ko.a.b)\ntr(`a.${k}`)\ntr(`a.b${s}`)\ntr(`${p}.c`)" },
    { path: 'd.md', text: '`a.b.c` · `a.b.*`' }
  ]
  const seen = new Set(i18nRefs(refIndex(files), 'a.b.c').map((h) => h.form))
  assert.deepEqual([...seen].sort(), [...REF_FORMS.STATIC, ...REF_FORMS.TEMPLATE, ...REF_FORMS.DOC].sort())
})
test('i18n stripCatalog: 삭제 줄을 빼고 · 더 쓰지 않는 import 이름을 목록에서 뺀다(목록이 비면 줄째) · type import 는 그대로', () => {
  const text = [
    "import { A, B } from './p'",
    "import { C } from './c'",
    "import type { T } from './t'",
    'export const ko: T = {',
    '  g: {',
    '    x: `${B} 붙임`,',
    "    y: 'Y',",
    '    w: `${C}`',
    '  },',
    '  a: `${A}`',
    '}'
  ].join('\n')
  const one = stripCatalog(text, ['g.x'])
  assert.deepEqual(one.lines, [6])
  assert.deepEqual(one.droppedImports, ['B'])
  assert.equal(one.text.split('\n')[0], "import { A } from './p'")
  assert.deepEqual(catalogTree(one.text).leaves.map((l) => l.path), ['g.y', 'g.w', 'a'])
  const two = stripCatalog(text, ['g.w'])
  assert.deepEqual(two.droppedImports, ['C'])
  assert.equal(two.text.split('\n').length, text.split('\n').length - 2)
  assert.ok(two.text.includes("import type { T } from './t'"))
  assert.deepEqual(stripCatalog(text, ['g.y']).droppedImports, [])
})
test('i18n catalogRemoval: 원래 빈 객체는 다른 키를 지워도 남는다(자식 0 은 "전부 지워짐"이 아니다)', () => {
  const tree = catalogTree("export const ko = {\n  e: {},\n  f: 'F'\n}")
  assert.deepEqual(tree.objects.map((o) => o.path), ['e'])
  assert.deepEqual(catalogRemoval(tree, ['f']), { lines: [3], sites: [3], missing: [], objects: [] })
})

// ── §9 i18n 유도(plan rev.3 참조 형태 표 · 2단계 범위 · formLock) — r3 ─────────
const catalogOf = (lines) => ['export const ko = {', ...lines, '}'].join('\n')
const RSRC = 'app/src/renderer/src/'
const formsAt = (idx, key) => i18nRefs(idx, key).map((h) => h.form)

test('i18n i18nScopes: prod = app/src 의 test 아닌 코드(리소스 2파일 제외) · test = *.test.* · *.testfixture.* · app/scripts · eslint 설정 · 그 밖은 어느 쪽도 아니다', () => {
  const paths = [
    'app/src/main/a.ts',
    `${RSRC}b.tsx`,
    'app/src/shared/c.json',
    'app/src/main/d.mjs',
    'app/src/main/a.test.ts',
    'app/src/main/f.testfixture.ts',
    'app/scripts/g.mjs',
    'app/eslint.config.mjs',
    I18N_KO,
    I18N_EN,
    `${RSRC}x.css`,
    'app/src/main/README.md',
    'app/scripts/notes.md',
    'app/vitest.config.ts',
    'docs/x.test.ts'
  ]
  assert.deepEqual(i18nScopes(paths), {
    prod: ['app/src/main/a.ts', `${RSRC}b.tsx`, 'app/src/shared/c.json', 'app/src/main/d.mjs'],
    test: ['app/src/main/a.test.ts', 'app/src/main/f.testfixture.ts', 'app/scripts/g.mjs', 'app/eslint.config.mjs']
  })
  assert.deepEqual([I18N_KO, I18N_EN], [`${RSRC}shared/i18n/resources/ko.ts`, `${RSRC}shared/i18n/resources/en.ts`])
})

test('i18n deriveI18n STATIC: 4형태는 형태마다 하나만 있어도 referenced · 참조 없는 키는 eligible', () => {
  const koText = catalogOf(["  s: { a: 'A' },", "  p: { a: 'A' },", "  as: { g: { a: 'A' } },", "  ap: { g: { a: 'A' } },", "  free: { a: 'A' }"])
  const d = deriveI18n({ koText, prod: [{ path: `${RSRC}x.ts`, text: "tr('s.a')\nko.p.a\nx('as.g')\nuse(ko.ap.g)" }] })
  assert.deepEqual(d.referenced, ['s.a', 'p.a', 'as.g.a', 'ap.g.a'])
  assert.deepEqual(d.eligible, ['free.a'])
  assert.deepEqual(d.prefixed, [])
  assert.deepEqual(
    ['s.a', 'p.a', 'as.g.a', 'ap.g.a'].map((k) => formsAt(d.idx, k)),
    [['string'], ['prop'], ['ancestorString'], ['ancestorProp']]
  )
})

test('i18n deriveI18n TEMPLATE·DOC: 그 형태만 있는 키는 eligible — 후보 제외는 1단계 접두사만 한다', () => {
  const koText = catalogOf(["  t: { a: 'A' },", "  u: { vw: 'V' },", "  x: { tail: 'T' },", "  d: { a: 'D' }"])
  const prod = [
    { path: 'app/src/main/m.ts', text: 'tr(`t.${k}`)\ntr(`u.v${s}`)\ntr(`${p}.tail`)' },
    { path: 'app/src/main/n.md', text: '`d.a` 설명' }
  ]
  const d = deriveI18n({ koText, prod })
  assert.deepEqual(d.eligible, ['t.a', 'u.vw', 'x.tail', 'd.a'])
  assert.deepEqual([d.referenced, d.prefixed, d.keyHeads], [[], [], []])
  assert.deepEqual(
    ['t.a', 'u.vw', 'x.tail', 'd.a'].map((k) => formsAt(d.idx, k)),
    [['templateHead'], ['templateHeadLoose'], ['templateTail'], ['bare']]
  )
})

test('i18n deriveI18n 1단계: renderer/src·shared 의 `머리.${` 가 키의 접두사면 prefixed · main 의 같은 꼴·점으로 안 끝나는 머리는 아니다 · STATIC 이 먼저다', () => {
  const koText = catalogOf(["  bg: { on: 'On', off: 'Off' },", "  sh: { x: 'X' },", "  mn: { y: 'Y' },", "  loose: { z: 'Z' },", "  both: { k: 'K' }"])
  const prod = [
    { path: `${RSRC}r.ts`, text: "tr(`bg.${s}`)\ntr(`both.${s}`)\ntr('both.k')\ntr(`zz.${s}`)\ntr(`loose${s}`)" },
    { path: 'app/src/shared/s.ts', text: 't(`sh.${k}`)' },
    { path: 'app/src/main/m.ts', text: 't(`mn.${k}`)' }
  ]
  const d = deriveI18n({ koText, prod })
  assert.deepEqual(d.step1.map((s) => `${s.path}:${s.line}:${s.head}`), [`${RSRC}r.ts:1:bg.`, `${RSRC}r.ts:2:both.`, `${RSRC}r.ts:4:zz.`, 'app/src/shared/s.ts:1:sh.'])
  assert.deepEqual(d.heads, ['bg.', 'both.', 'sh.', 'zz.'])
  assert.deepEqual(d.keyHeads, ['bg.', 'both.', 'sh.'])
  assert.deepEqual(d.prefixed, ['bg.on', 'bg.off', 'sh.x'])
  assert.deepEqual(d.referenced, ['both.k'])
  assert.deepEqual(d.eligible, ['mn.y', 'loose.z'])
})

test('i18n deriveI18n 키: 복수형 접미사(_zero~_other)를 뗀 경로 — 복수형 잎은 한 키 · 참조는 뗀 경로로 센다 · _plural 은 접미사가 아니다', () => {
  const koText = catalogOf(['  n: {', "    c_one: '1',", "    c_other: 'N',", "    d_zero: '0',", "    d_two: '2',", "    d_few: 'F',", "    d_many: 'M',", "    e: 'E',", "    y_plural: 'P'", '  }'])
  const d = deriveI18n({ koText, prod: [{ path: `${RSRC}x.ts`, text: "tr('n.c', { count })" }] })
  assert.equal(d.keys.length, 8)
  assert.deepEqual(d.bases, ['n.c', 'n.d', 'n.e', 'n.y_plural'])
  assert.deepEqual(d.referenced, ['n.c'])
  assert.deepEqual(d.eligible, ['n.d', 'n.e', 'n.y_plural'])
  assert.deepEqual(
    ['n.c_one', 'n.c_other', 'n.d_zero', 'n.d_two', 'n.d_few', 'n.d_many', 'n.e', 'n.y_plural'].map(i18nBase),
    ['n.c', 'n.c', 'n.d', 'n.d', 'n.d', 'n.d', 'n.e', 'n.y_plural']
  )
})

test('i18n deriveI18n 부분 문자열: 더 긴 키·자손 경로의 문자열과 체인은 참조가 아니다', () => {
  const d = deriveI18n({ koText: catalogOf(["  k: { a: 'A' }"]), prod: [{ path: `${RSRC}x.ts`, text: "tr('k.ab')\nko.k.abc\nx('k.a.b')" }] })
  assert.deepEqual([d.referenced, d.eligible], [[], ['k.a']])
})

test('i18n refTally: prod STATIC → prod · prod TEMPLATE → template · test STATIC → test(formLock) · test TEMPLATE 은 세지 않는다 · rule DOC → rule · 1단계 접두사 → step1', () => {
  const idx = {
    prod: refIndex([{ path: 'app/src/main/p.ts', text: "tr('a.b')\ntr(`a.${k}`)" }]),
    test: refIndex([{ path: 'app/src/x.test.ts', text: 'expect(ko.a.b)\ntr(`a.${k}`)' }]),
    rule: refIndex([{ path: 'docs/r.md', text: '`a.b` 언급' }])
  }
  const r = refTally({ idx, key: 'a.b', keyHeads: ['a.'] })
  assert.deepEqual(r.tally, { prod: 1, test: 1, rule: 1, template: 1, step1: 1 })
  assert.deepEqual(
    r.hits.map((h) => `${h.scope}:${h.form}:${h.counted}`),
    ['prod:string:true', 'prod:templateHead:true', 'test:prop:true', 'test:templateHead:false', 'rule:bare:true']
  )
  assert.equal(refTally({ idx, key: 'a.b', keyHeads: [] }).tally.step1, 0)
})
