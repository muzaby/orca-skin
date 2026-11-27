// 0330 H1 — W-004 합의값과 소유 §19 표에서 판독기 plan.json(필수 셀 분모)을 만든다.
// 사용: node cells.mjs --node-rows <node-stdout> --targets <targets.json> --locked-at <ISO> > plan.json
// 규칙 출처: plan §14 W-004 서식 · H1 · H4 · 0326 §19 D-109 · 0327 §19 · 0328 §19 · 0329 §19.
import { readFileSync } from 'node:fs'

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i < 0 ? undefined : process.argv[i + 1]
}
const lockedAt = arg('--locked-at')
if (!lockedAt || !Number.isFinite(Date.parse(lockedAt))) throw Error('--locked-at <ISO> 필요')

const REVISION = '0330-W004-r1'
const PROFILE = 'win-4ejndg'
const SHA = {
  ee8: 'ee8ac8173c83a97114a9dc8bd257ba770a7dc368',
  d86: 'd86846844dc9ea092f394f942621b78dc3d50e02',
  '7c2': '7c241d191438e7aa9625a2914c38fe0a1b3d1bdd',
  c7d: 'c7d2adf2ddb548a2ce897cfc4f19173a2879b77f',
  '7db': '7db1c7cefcdd3ef6d7f44cadbb9e6dc10fde76e6',
  eae: 'eae9081b5536232da98ab918ed9f0c1b525660f6',
  int: '515ff58d60eb5d76744cc34aaad20bc7f186d928'
}
const PAIRS = {
  A: { id: 'A-0325', beforeSha: SHA.ee8, afterSha: SHA.d86 },
  B: { id: 'B-0326', beforeSha: SHA.d86, afterSha: SHA['7c2'] },
  C: { id: 'C-0327', beforeSha: SHA['7c2'], afterSha: SHA.c7d },
  D: { id: 'D-0328', beforeSha: SHA.c7d, afterSha: SHA['7db'] },
  E: { id: 'E-0329', beforeSha: SHA['7db'], afterSha: SHA.eae },
  W: { id: 'W-0330', beforeSha: SHA.d86, afterSha: SHA.int }
}
const OWNER = {
  A: ['0325', 'V1 rev 4 + ΔV1 + ΔV2'],
  B: ['0326', 'V1 rev 7 + ΔV1 rev 2 + ΔV2 rev 5 + ΔV3'],
  C: ['0327', 'V1 rev 3 + ΔV1~ΔV8'],
  D: ['0328', 'V1 rev 5 + ΔV1'],
  E: ['0329', 'V1 rev 5 + ΔV1~ΔV7'],
  W: ['0330', 'V1 rev 7 + ΔV1 + ΔV2']
}
// 0325 §6-B/§6-D 런타임 소유 — A=0325 B=0326 C=0327 D=0328 E=0329 W=0330.
const TASKS = {
  T01: ['A', 'E'], T02: ['B'], T03: ['B'], T04: ['A', 'B'], T05: ['B'], T06: ['A', 'B'],
  T07: ['B'], T08: ['C'], T09: ['A', 'W'], T10: ['A'], T11: ['B'], T12: ['A', 'B'],
  T13: ['A'], T14: ['A', 'C'], T15: ['A', 'C'], T16: ['B'], T17: ['B'], T18: ['B'],
  T19: ['A'], T20: ['D'], T21: ['A', 'D'], T22: ['C'], T23: ['C'], T24: ['D'],
  T25: ['B'], T26: ['A'], T27: ['C'], T28: ['D'], T29: ['D'], T30: ['D'], T31: ['D'],
  T32: ['D'], T33: ['C', 'D']
}

// 규칙 — W-004 합의: 소유 기준만 필수, W 최소지표·T17·T18 은 기록 전용.
const R = {
  stall160: () => ({ aggregate: 'count', combine: 'each', operator: '=', value: 0, inputUnit: 'ms', unit: '건', mode: 'absolute', where: { operator: '≥', value: 160, unit: 'ms' } }),
  tasks50: () => ({ aggregate: 'max', combine: 'each', operator: '≤', value: 1, inputUnit: '건', unit: '건', mode: 'absolute' }),
  consec3: () => ({ aggregate: 'max', combine: 'each', operator: '<', value: 3, inputUnit: 'frames', unit: 'frames', mode: 'absolute' }),
  px1: () => ({ aggregate: 'max', combine: 'each', operator: '≤', value: 1, inputUnit: 'px', unit: 'px', mode: 'absolute' }),
  ok: () => ({ aggregate: 'equal', combine: 'each', operator: '=', value: 'ok', inputUnit: 'text', unit: 'text', mode: 'absolute' }),
  rel110: (agg, unit) => ({ aggregate: agg, combine: 'median-of-runs', operator: '≤', value: 1.1, inputUnit: unit, unit: '비', mode: 'relative' }),
  relRatio: (num, den) => ({ aggregate: 'ratio', combine: 'median-of-runs', operator: '≤', value: 1, inputUnit: 'frames', unit: '비', mode: 'relative', numerator: num, denominator: den }),
  relMax: (unit) => ({ aggregate: 'max', combine: 'median-of-runs', operator: '≤', value: 1, inputUnit: unit, unit: '비', mode: 'relative' }),
  // 기록 완결 — 유효 표본이 반복마다 1개 이상(값 범위 제약 없음).
  recorded: (unit) => ({ aggregate: 'count', combine: 'each', operator: '≥', value: 1, inputUnit: unit, unit: '건', mode: 'absolute', where: { operator: '≥', value: 0, unit } }),
  rec: (agg, unit) => ({ aggregate: agg, combine: 'pooled', operator: '≥', value: 0, inputUnit: unit, unit: agg === 'count' ? '건' : unit, mode: 'absolute', ...(agg === 'count' ? { where: { operator: '≥', value: 0, unit } } : {}) })
}

const cells = []
const seen = new Set()
function cell(o) {
  const [owner, ownerRevision] = OWNER[o.stage]
  const key = [owner, o.scenario, o.operation, o.load, o.harness, o.buildKind, o.side, o.metric, o.interval, o.task].join('|')
  if (seen.has(key)) return
  seen.add(key)
  cells.push({
    key, task: o.task, owner, ownerRevision,
    sample: o.sample ?? (o.stage === 'W' ? 'w' : o.stage === 'A' ? 'reference' : 'owner'),
    scenario: o.scenario, operation: o.operation, load: o.load, harness: o.harness, profile: PROFILE,
    pair: PAIRS[o.stage], side: o.side, buildKind: o.buildKind, metric: o.metric, interval: o.interval,
    ...(o.target ? { target: o.target } : {}),
    repeats: 3, required: o.required, ownerChecks: { machine: o.stage !== 'W', windows: o.stage !== 'W' && o.stage !== 'A' },
    rule: o.rule
  })
}
// 한 시나리오 행 → 지표마다 셀. tasks 는 첫 지표 셀을 과제마다 복제(같은 관측이 채운다).
function row(stage, scenario, harnesses, ops, tasks) {
  for (const harness of harnesses)
    for (const op of ops) {
      const base = { stage, scenario, harness, operation: op.op, load: op.load ?? 'default', buildKind: op.buildKind ?? 'diagnostic', interval: op.interval ?? 'operation' }
      op.metrics.forEach((m, i) => {
        for (const task of i === 0 ? tasks : [tasks[0]])
          cell({ ...base, task, side: m.side ?? 'after', metric: m.metric, required: m.required ?? true, rule: m.rule, interval: m.interval ?? base.interval, target: typeof m.target === 'function' ? m.target(harness) : m.target })
      })
    }
}
const CC = ['claude-code'], CW = ['claude-work'], OC = ['opencode'], ALL3 = ['claude-code', 'claude-work', 'opencode']

// ── A 0325 AC19 — 참고 기준선(W-018: W 에서는 기록 전용). 진단·설치 두 벌.
const refMetrics = (names) => names.map(([metric, agg, unit]) => ({ metric, side: 'pair', required: false, rule: R.rec(agg, unit) }))
for (const buildKind of ['diagnostic', 'install']) {
  const inst = buildKind === 'install'
  const diag = (list) => (inst ? [] : list)
  row('A', 'S1', ['claude-code', 'opencode'], [{ op: 'open-largest', buildKind, metrics: refMetrics([['click-to-first-row-paint', 'max', 'ms'], ...diag([['commit-ms', 'max', 'ms'], ['layout-ms', 'max', 'ms']]), ['perf-stall', 'count', 'ms']]) }], ['T01', 'T04', 'T09'])
  row('A', 'S2', OC, [{ op: 'stream-type-wheel', buildKind, metrics: refMetrics([...diag([['input-to-paint', 'p95', 'ms'], ['input-to-paint', 'max', 'ms'], ['dropped-frames', 'count', 'frames'], ['longest-consecutive-dropped', 'max', 'frames']]), ['perf-stall', 'count', 'ms']]) }], ['T06'])
  row('A', 'S3', ['claude-code', 'claude-work'], [{ op: 'stream-type-wheel', buildKind, metrics: refMetrics([...diag([['input-to-paint', 'p95', 'ms'], ['longest-consecutive-dropped', 'max', 'frames']]), ['perf-stall', 'count', 'ms']]) }], ['T10', 'T12', 'T13'])
  row('A', 'S4', CC, [{ op: 'open-scroll', buildKind, metrics: refMetrics([['click-to-first-row-paint', 'max', 'ms'], ...diag([['longest-consecutive-dropped', 'max', 'frames']])]) }], ['T14'])
  row('A', 'S5', CC, ['F1', 'F2', 'F3'].map((load) => ({ op: 'paste-type', load, buildKind, metrics: refMetrics([...diag([['input-to-paint', 'p95', 'ms'], ['decoration-commit-ms', 'max', 'ms']]), ['perf-stall', 'count', 'ms']]) })), ['T19'])
  row('A', 'S6', CC, [{ op: 'drag-boundary', buildKind, metrics: refMetrics([...diag([['longest-consecutive-dropped', 'max', 'frames'], ['pointer-to-paint', 'max', 'ms']]), ['perf-stall', 'count', 'ms']]) }], ['T26'])
  row('A', 'S7', CC, [{ op: 'images-5-send', buildKind, metrics: refMetrics([['click-to-bubble-paint', 'max', 'ms'], ['perf-stall', 'count', 'ms']]) }], ['T21'])
  row('A', 'S8', CC, [{ op: 'git-50k-expand', buildKind, metrics: refMetrics([['expand-to-first-row-paint', 'max', 'ms'], ...diag([['mounted-rows', 'max', '건']])]) }], ['T15'])
}

// ── B 0326 AC33 — D-109(측정 전 고정). 진단 빌드, d86 ↔ 7c2 교차 3회 중앙값.
const d109abs = (extra = []) => [
  { metric: 'longest-stall-ms', rule: R.stall160() },
  { metric: 'longest-consecutive-dropped', rule: R.consec3() },
  ...extra
]
row('B', 'S1', ALL3, [{ op: 'stream-type-wheel', metrics: [
  { metric: 'key-to-paint', side: 'pair', rule: R.rel110('p95', 'ms') },
  { metric: 'wheel-dropped-ratio', side: 'pair', rule: R.relRatio('wheel-dropped-frames', 'wheel-presented-frames') },
  ...d109abs()] }], ['T02', 'T03', 'T07'])
row('B', 'S2', ALL3, ['open', 'resume', 'sync'].map((cause) => ({ op: 'entry-' + cause, metrics: [
  ...(cause === 'sync' ? [] : [{ metric: 'click-to-paint', side: 'pair', rule: R.rel110('max', 'ms') }]),
  { metric: 'position-correct', rule: R.ok() },
  ...d109abs()] })), ['T16', 'T25'])
row('B', 'S6', ALL3, [{ op: 'bubble-drag-collapse', metrics: [
  { metric: 'drag-frame-interval', side: 'pair', rule: R.rel110('p95', 'ms') },
  { metric: 'drag-dropped-ratio', side: 'pair', rule: R.relRatio('drag-dropped-frames', 'drag-presented-frames') },
  { metric: 'collapse-click-to-paint', side: 'pair', rule: R.rel110('p95', 'ms') },
  { metric: 'layout-sum-ms', side: 'pair', required: false, rule: R.rec('max', 'ms') },
  ...d109abs()] }], ['T16'])
row('B', 'S7', CC, [{ op: 'code-stream-100k', metrics: [
  { metric: 'dropped-per-10k', side: 'pair', rule: R.relMax('frames') },
  { metric: 'loaf50-per-10k', side: 'pair', rule: R.relMax('건') },
  ...d109abs()] }], ['T07'])
row('B', 'S7d', CC, [{ op: 'stream-fixture-100k', metrics: d109abs() }], ['T07'])
row('B', 'S3', ALL3, [{ op: 'answer-5000-new-question', metrics: d109abs([{ metric: 'tasks-over-50ms', rule: R.tasks50() }]) }], ['T04', 'T05', 'T11'])
row('B', 'S4', ALL3, [
  { op: 'prepend-pin', load: 'turns-1', metrics: d109abs([{ metric: 'tasks-over-50ms', rule: R.tasks50() }, { metric: 'pin-bottom-distance', rule: R.px1() }]) },
  { op: 'prepend-pin', load: 'turns-100', metrics: d109abs([{ metric: 'tasks-over-50ms', rule: R.tasks50() }, { metric: 'pin-bottom-distance', rule: R.px1() }]) },
  { op: 'prepend-unpin', load: 'turns-1', metrics: d109abs([{ metric: 'tasks-over-50ms', rule: R.tasks50() }, { metric: 'unpin-sentence-offset', rule: R.px1() }]) },
  { op: 'prepend-unpin', load: 'turns-100', metrics: d109abs([{ metric: 'tasks-over-50ms', rule: R.tasks50() }, { metric: 'unpin-sentence-offset', rule: R.px1() }]) }
], ['T04'])
row('B', 'S5', ALL3, [{ op: 'select-copy-cancel', metrics: [
  { metric: 'longest-stall-ms', rule: R.stall160() },
  { metric: 'longest-consecutive-dropped', rule: R.consec3() },
  ...['paste-matches-selection', 'selection-cleared-on-mount', 'no-revive-same-gesture', 'clipboard-kept-after-cancel', 'no-mount-scroll-keeps-selection'].map((metric) => ({ metric, rule: R.ok() }))] }], ['T06', 'T12'])
// T17·T18 — W-004: 기록 전용.
row('B', 'S8', CW, [{ op: 'plan-approval-card', metrics: [{ metric: 'card-commit-ms', required: false, rule: R.rec('max', 'ms') }] }], ['T17'])
row('B', 'S9', CC, ['subtasks-10', 'subtasks-50'].map((load) => ({ op: 'subtasks-30s', load, metrics: ['paint-ms', 'script-ms', 'timers'].map((metric) => ({ metric, required: false, rule: R.rec('max', metric === 'timers' ? '건' : 'ms') })) })), ['T18'])

// ── C 0327 AC30 — 기록 완결이 완료. S-C8 문자열 일치는 결함 판정(ok).
const recs = (list, buildKind) => list.map(([metric, unit]) => ({ metric, rule: R.recorded(unit) }))
row('C', 'S-C0', CC, [{ op: 'f5-stream-type-wheel', metrics: recs([['expand-to-first-row-paint', 'ms'], ['input-to-paint', 'ms'], ['wheel-to-paint', 'ms'], ['visible-request-wait', 'ms'], ['mounted-rows', '건']]) },
  { op: 'f5-stream-type-wheel', buildKind: 'install', metrics: recs([['perf-stall', 'ms']]) }], ['T22', 'T15'])
row('C', 'S-C1', CC, [{ op: 'f5-expand-wheel-select', metrics: recs([['expand-to-first-row-paint', 'ms'], ['scroll-to-paint', 'ms'], ['draft-key-to-paint', 'ms'], ['mounted-rows', '건']]) }], ['T22'])
row('C', 'S-C2', CC, [{ op: 'f8-expand-all', metrics: recs([['expand-to-paint', 'ms'], ['computed-files', '건'], ['mounted-rows', '건']]) },
  { op: 'f8-expand-all', buildKind: 'install', metrics: recs([['perf-stall', 'ms']]) }], ['T23'])
row('C', 'S-C3', ALL3, [{ op: 'tool-card-fixture', metrics: [...recs([['expand-to-paint', 'ms'], ['scroll-to-paint', 'ms']]), { metric: 'copy-length-equals-source', rule: R.ok() }] }], ['T14'])
row('C', 'S-C4', CC, ['F6', 'F7', 'F9'].map((load) => ({ op: 'artifact-viewer', load, metrics: recs([['open-to-first-block-paint', 'ms'], ['raw-to-formatted-ms', 'ms'], ['scroll-to-paint', 'ms']]) })), ['T27'])
row('C', 'S-C5', ['claude-code', 'opencode'], [{ op: 'loose-list-stream', metrics: recs([['delta-to-paint', 'ms'], ['tasks-over-50ms', '건'], ['tail-requests', '건']]) }], ['T08'])
row('C', 'S-C6', CC, [{ op: 'theme-switch', metrics: recs([['switch-to-color-paint', 'ms']]) }, { op: 'theme-switch', buildKind: 'install', metrics: recs([['perf-stall', 'ms']]) }], ['T33'])
row('C', 'S-C7', CC, [{ op: 'f5-end-new-answer', metrics: recs([['code-highlight-ms', 'ms'], ['visible-request-wait', 'ms']]) }], ['T08'])
row('C', 'S-C8', CC, [{ op: 'copy-isolation', metrics: ['normal-copy-matches', 'cancel-keeps-clipboard', 'reselect-copies-new', 'other-panel-keeps-selection'].map((metric) => ({ metric, rule: R.ok() })) }], ['T22'])
row('C', 'S-C9', CC, ['edit-rewrite', 'f5-near'].map((load) => ({ op: 'preempt', load, metrics: recs([['worker-occupancy', 'ms'], ['visible-request-wait', 'ms'], ['request-to-paint', 'ms']]) })), ['T15'])

// ── D 0328 — Windows 행은 "0330 인계" 기록(R-H/R-W/R-R 는 분기 규칙이지 합격선이 아니다).
row('D', 'S-D1', CC, [{ op: 'mention-20k-files', metrics: recs([['popover-paint', 'ms'], ['update-latency', 'ms']]) }], ['T20'])
row('D', 'S-D2', CC, ['a', 'b', 'c', 'd'].map((v) => ({ op: 'images-5-' + v, metrics: [...recs([['attach-to-thumb', 'ms'], ['image-work-ms', 'ms']]), { metric: 'source-order-preserved', rule: R.ok() }, { metric: 'draft-cleared-focus-same-task', rule: R.ok() }] })), ['T21'])
row('D', 'S-D3', CC, [{ op: 'plan-comments-resize', metrics: recs([['rect-reads-per-frame', '건'], ['popover-position-px', 'px']]) }], ['T24'])
row('D', 'S-D4', CC, [{ op: 'session-search-list', metrics: recs([['ipc-bytes', 'bytes'], ['dom-rows', '건'], ['select-to-paint', 'ms']]) }], ['T28'])
row('D', 'S-D5', CC, [{ op: 'settings-json-307k', metrics: recs([['validate-task-ms', 'ms'], ['form-commit-ms', 'ms']]) }], ['T29'])
row('D', 'S-D6', CC, [{ op: 'schedule-history-50', metrics: recs([['ipc-bytes', 'bytes'], ['dom-rows', '건']]) }], ['T30'])
row('D', 'S-D7', CC, [{ op: 'usage-ranges', metrics: recs([['initial-commit-ms', 'ms'], ['paint-ms', 'ms']]) }], ['T31'])
row('D', 'S-D8', CC, [{ op: 'installer-log', metrics: recs([['commit-ms', 'ms'], ['last-output-visible', '건']]) }, { op: 'installer-log', buildKind: 'install', metrics: recs([['perf-stall', 'ms']]) }], ['T32'])
row('D', 'S-D9', CC, ['ko-2000', 'ko-20000'].map((load) => ({ op: 'ime-input', load, buildKind: 'install', metrics: [...recs([['input-to-paint', 'ms']]), { metric: 'caret-and-last-line-visible', rule: R.ok() }] })), ['T33'])
row('D', 'S-D10a', CC, [{ op: 'assets-1000', buildKind: 'install', metrics: recs([['main-response-ms', 'ms']]) }], ['T21'])
row('D', 'S-D10b', CC, ['normal', 'minimized', 'maximized'].map((load) => ({ op: 'close-relaunch', load, buildKind: 'install', metrics: [{ metric: 'state-restored', rule: R.ok() }] })), ['T21'])
row('D', 'S-D10c', CC, [{ op: 'log-flush', buildKind: 'install', metrics: recs([['flush-ms', 'ms']]) }], ['T21'])

// ── E 0329 AC10 — E 의 행동·크기 경계는 ok(위반 시 E AC 재개), 시간은 기록. 3,729ms 는 Linux 전용(W-017).
// W-044 — 대상 키 `<시나리오>/<하네스>/<부하 또는 입력>`. 대상 없는 첫 가시 셀로 분모를 줄이지 않는다.
if (!arg('--targets')) throw Error('--targets <targets.json> 필요(seed-history-fixture.mjs 출력)')
const targetFile = JSON.parse(readFileSync(arg('--targets'), 'utf8'))
const target = (key) => (harness) => {
  const t = targetFile[key.replace('<h>', harness)]
  if (!t) throw Error('대상 없음: ' + key.replace('<h>', harness))
  return t
}
row('E', 'S-E1', ALL3, ['turns-1', 'turns-100', 'turns-10000'].map((load) => ({ op: 'open-saved', load, metrics: [
  { metric: 'first-body-paint', rule: R.recorded('ms'), target: target(`S-E1/<h>/${load}`) },
  { metric: 'latest-turn-at-bottom', rule: R.ok() },
  { metric: 'ipc-bytes', required: false, rule: R.rec('max', 'bytes') }] })), ['T01'])
row('E', 'S-E2', ALL3, ['short', 'long'].flatMap((load) => ['wheel', 'touchpad-flick', 'keyboard', 'button'].map((input) => ({ op: 'pull-' + input, load, metrics: [
  { metric: 'requests-per-gesture-is-1', rule: R.ok() },
  { metric: 'reading-offset', rule: R.px1() },
  ...(input === 'touchpad-flick' ? [{ metric: 'gesture-gap-ms', required: false, rule: R.rec('median', 'ms') }] : [])] }))), ['T01'])
row('E', 'S-E3', ALL3, [{ op: 'live-while-reading', metrics: [{ metric: 'applied-once-correct-session', rule: R.ok() }] }], ['T01'])
row('E', 'S-E4', ALL3, ['4mib', 'msg-600', 'empty-200k'].map((load) => ({ op: 'large-turn', load, metrics: [
  { metric: 'idle-fill-after-first-paint', rule: R.ok() }, { metric: 'no-neighbor-auto-request', rule: R.ok() }] })), ['T01'])
row('E', 'S-E5', ALL3, ['click', 'enter'].map((input) => ({ op: 'search-hit-' + input, load: 'turn-63', metrics: [
  { metric: 'first-visible-target', rule: R.recorded('ms'), target: target(`S-E5/<h>/${input}`) },
  { metric: 'highlight-on-target', rule: R.ok() }, { metric: 'highlight-cleared-2s', rule: R.ok() }] })), ['T01'])

// ── W 0330 통합(H4 W1~W4) — d86 ↔ 515ff58d. 소유 규칙만 필수(D-109 절대 ②③b④⑤ · 행동 ok), W 최소지표는 기록 전용.
const wMin = [
  { metric: 'input-to-paint', side: 'pair', required: false, rule: R.rec('p95', 'ms') },
  { metric: 'input-to-paint-max', side: 'pair', required: false, rule: R.rec('max', 'ms') },
  { metric: 'dropped-frames', side: 'pair', required: false, rule: R.rec('count', 'frames') },
  { metric: 'tasks-over-50ms', side: 'pair', required: false, rule: R.rec('max', '건') }
]
const loads = { W1: ['history-1', 'history-100'], W3: ['turn-10', 'turn-500', 'f5-2000', 'f5-50000'] }
row('W', 'W1', ALL3, loads.W1.map((load) => ({ op: 'long-chat-type-wheel-drag', load, metrics: [...d109abs(), ...wMin] })), ['T09'])
row('W', 'W2', ALL3, ['history-1', 'history-100'].map((load) => ({ op: 'open-pull', load, metrics: [{ metric: 'requests-per-gesture-is-1', rule: R.ok() }, { metric: 'reading-offset', rule: R.px1() }, ...wMin] })), ['T09'])
row('W', 'W2p', ALL3, [{ op: 'live-large-turn', metrics: [{ metric: 'applied-once-correct-session', rule: R.ok() }, ...wMin] }], ['T09'])
row('W', 'W2pp', ALL3, ['click', 'enter'].map((input) => ({ op: 'search-' + input, metrics: [{ metric: 'highlight-on-target', rule: R.ok() }, ...wMin] })), ['T09'])
row('W', 'W3', ALL3, loads.W3.map((load) => ({ op: 'drag-copy', load, metrics: [{ metric: 'paste-matches-selection', rule: R.ok() }, { metric: 'clipboard-kept-after-cancel', rule: R.ok() }, { metric: 'longest-stall-ms', rule: R.stall160() }, ...wMin] })), ['T09'])
row('W', 'W3p', ALL3, ['tail-4000', 'tail-50000', 'tail-50001'].map((load) => ({ op: 'stream-markdown', load, metrics: [{ metric: 'tail-band-correct', rule: R.ok() }, ...wMin] })), ['T09'])
row('W', 'W4', ALL3, [{ op: 'images-5-send-switch', metrics: [{ metric: 'source-order-preserved', rule: R.ok() }, { metric: 'draft-kept-on-switch', rule: R.ok() }, ...wMin] }], ['T09'])
row('W', 'W4p', CC, [{ op: 'lists-panels-installer', metrics: [{ metric: 'state-restored', rule: R.ok() }, ...wMin] }], ['T09'])

// ── Node 함수 재측정(win32-node) — measure-ui-inputs 표 행. 이전/이후 짝 3회. 기록 완결.
// 판독기는 관측 지표 = 행 ID(`windows-verdict.mjs` `tableSample`), 같은 ID 행은 둘째 열 `range.label`과
// 관측 `interval`로 가른다(ΔV4 W-045). 그래서 셀 `interval`은 둘째 열이다. (ID, 둘째 열) 중복은 exit 1.
const nodeRows = arg('--node-rows')
  ? readFileSync(arg('--node-rows'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\| ([A-Z][0-9][^|]*?) \| ([^|]*?) \|/))
      .filter(Boolean)
      .map((m) => ({ id: m[1], label: m[2] }))
  : []
const nodeSeen = new Set()
const nodeStage = (id) => (id.startsWith('I') ? 'A' : id.startsWith('J') ? 'B' : id.startsWith('K') ? 'C' : null)
const nodeTask = { A: 'T19', B: 'T04', C: 'T14' }
for (const { id, label } of nodeRows) {
  const stage = nodeStage(id)
  if (!stage) continue
  if (nodeSeen.has(id + '|' + label)) throw Error('Node 행 (ID, 이름) 중복: ' + id + ' | ' + label)
  nodeSeen.add(id + '|' + label)
  cell({ stage, scenario: 'node-fn', operation: 'measure-ui-inputs', load: 'fixed-inputs', harness: 'node', buildKind: 'node', side: 'pair', task: nodeTask[stage], metric: id, interval: label, required: stage !== 'A', rule: R.recorded('ms') })
}

const plan = {
  revision: REVISION, lockedAt, wBaselineSha: SHA.d86, integrationSha: SHA.int,
  profiles: [{ id: PROFILE, os: 'win32', hz: 60, resolution: '1920x1080', scale: 125, cpu: 'Intel Core i7-6500U', gpu: 'Intel HD Graphics 520 21.20.16.4565', ramGb: 15.9, windows: 'Windows 11 Home 22631', power: 'balanced 381b4222-f694-41f0-9685-ff5bb260df2e', koreanIme: true, precisionTouchpad: true }],
  tasks: Object.entries(TASKS).map(([id, stages]) => ({ id, owners: stages.map((s) => OWNER[s][0]) })),
  cells
}
process.stdout.write(JSON.stringify(plan, null, 1) + '\n')
