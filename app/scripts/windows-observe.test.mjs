import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  eventTimings,
  frameStates,
  longestRun,
  mainThread,
  observe,
  parseChecks,
  taskDurations,
  TRACE_METRICS
} from './windows-observe.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const M = (pid, tid) => ({
  ph: 'M',
  name: 'thread_name',
  pid,
  tid,
  args: { name: 'CrRendererMain' }
})
const task = (pid, tid, ts, durMs) => ({
  ph: 'X',
  name: 'RunTask',
  pid,
  tid,
  ts,
  dur: durMs * 1000
})
// DevTools Frames 트랙 이벤트(ΔV6 rev 2). state: 'draw' | 'drop' | 'partial'
const frame = (seq, ts, state, pid = 1) => ({
  ph: 'I',
  name: state === 'draw' ? 'DrawFrame' : 'DroppedFrame',
  cat: 'disabled-by-default-devtools.timeline.frame',
  pid,
  tid: 9,
  ts,
  args: { frameSeqId: seq, ...(state === 'partial' ? { hasPartialUpdate: true } : {}) }
})
const mark = (pid) => ({
  ph: 'I',
  name: 'oo-measure-start',
  cat: 'blink.user_timing',
  pid,
  tid: 1,
  ts: 1
})
const timing = (id, type, ts, durMs) => [
  { ph: 'b', name: 'EventTiming', pid: 1, tid: 1, ts, id, args: { data: { type } } },
  ...(durMs == null
    ? []
    : [{ ph: 'e', name: 'EventTiming', pid: 1, tid: 1, ts: ts + durMs * 1000, id }])
]

test("E1′ picks the renderer main thread of the measure mark's pid, or none", () => {
  // pid 2 가 RunTask 더 많지만(DevTools 창처럼) 표식은 pid 1 에 있다.
  const events = [
    M(1, 1),
    M(2, 1),
    task(1, 1, 0, 1),
    task(2, 1, 0, 1),
    task(2, 1, 5, 1),
    task(2, 1, 9, 1)
  ]
  assert.deepEqual(mainThread([...events, mark(1)]), { pid: 1, tid: 1 })
  assert.deepEqual(mainThread([...events, mark(2)]), { pid: 2, tid: 1 })
  assert.equal(mainThread(events), null) // 표식 없음
  assert.equal(mainThread([...events, mark(7)]), null) // 표식 pid 에 주 스레드 없음
  // 다른 범주의 같은 이름은 표식이 아니다.
  assert.equal(mainThread([...events, { ...mark(1), cat: 'devtools.timeline' }]), null)
})

test('E1′/E3′ on a real trace excerpt pick the app renderer and its frames', () => {
  // probe3(진단 515ff58d — 앱 창 + DevTools 창) 발췌. 기대값은 추출기와 독립으로 센 수다.
  const real = JSON.parse(
    readFileSync(join(here, 'windows-observe/fixtures/probe-min.json'), 'utf8')
  ).traceEvents
  const t = mainThread(real)
  assert.deepEqual(t, { pid: 324780, tid: 306108 })
  assert.equal(taskDurations(real, t).length, 10)
  // 발췌: 앱 pid DrawFrame 30·DroppedFrame 4 + DevTools pid Draw 10·Dropped 20 + 두 pid 의 PipelineReporter.
  const frames = { frames: frameStates(real, t.pid) }
  assert.equal(frames.frames.length, 34)
  assert.equal(TRACE_METRICS['dropped-frames'](frames).values.length, 4)
  assert.deepEqual(TRACE_METRICS['wheel-presented-frames'](frames).values, [30])
  assert.deepEqual(TRACE_METRICS['longest-consecutive-dropped'](frames).values, [2])
  // PipelineReporter 만 남기면 프레임 0 — 그 이벤트는 세지 않는다.
  assert.equal(
    frameStates(
      real.filter((e) => e.name !== 'DrawFrame' && e.name !== 'DroppedFrame'),
      t.pid
    ).length,
    0
  )
})

test('E2 task lengths: stall list keeps >=50ms, over-50 count is strict', () => {
  const t = {
    tasks: taskDurations(
      [
        M(1, 1),
        ...[49.9, 50, 50.1, 160, 170].map((d, i) => task(1, 1, i * 1e6, d)),
        task(1, 2, 0, 900)
      ],
      { pid: 1, tid: 1 }
    )
  }
  assert.deepEqual(TRACE_METRICS['longest-stall-ms'](t).values, [50, 50.1, 160, 170])
  assert.deepEqual(TRACE_METRICS['tasks-over-50ms'](t).values, [3])
  assert.deepEqual(
    TRACE_METRICS['longest-stall-ms']({
      tasks: taskDurations([task(1, 1, 0, 10)], { pid: 1, tid: 1 })
    }).values,
    [0]
  )
})

test('E3′ frames: Draw/Dropped by frameSeqId on the main pid, dropped wins a shared seq', () => {
  const states = ['draw', 'drop', 'partial', 'drop', 'draw', 'drop']
  const events = states.map((s, i) => frame(i, 1000 + i * 16000, s))
  const noise = [frame(2, 5, 'draw'), frame(9, 7, 'draw', 2), frame(10, 8, 'drop', 2)] // 같은 seq Draw · 다른 pid
  for (const order of [[...events, ...noise], [...noise, ...events].reverse()]) {
    const t = { frames: frameStates(order, 1) }
    assert.equal(t.frames.length, 6)
    assert.equal(TRACE_METRICS['dropped-frames'](t).values.length, 4)
    assert.deepEqual(TRACE_METRICS['wheel-presented-frames'](t).values, [2])
    assert.deepEqual(TRACE_METRICS['longest-consecutive-dropped'](t).values, [3])
    assert.deepEqual(TRACE_METRICS['drag-frame-interval'](t).values, [64])
  }
  assert.equal(frameStates(events, 2).length, 0)
  assert.equal(longestRun([]), 0)
})

test('E4 event timing pairs split key and click inputs and drop unfinished starts', () => {
  const events = [
    ...timing('k1', 'keydown', 0, 10),
    ...timing('k2', 'keypress', 100, 20),
    ...timing('k3', 'keyup', 200, 30),
    ...timing('c1', 'click', 300, 40),
    ...timing('c2', 'pointerup', 400, 50),
    ...timing('k4', 'keydown', 500, null),
    { ph: 'e', name: 'EventTiming', pid: 1, tid: 1, ts: 900, id: 'orphan' }
  ]
  const t = { timings: eventTimings(events) }
  assert.deepEqual(TRACE_METRICS['key-to-paint'](t).values, [10, 20, 30])
  assert.deepEqual(TRACE_METRICS['click-to-paint'](t).values, [40, 50])
  assert.deepEqual(TRACE_METRICS['input-to-paint-max'](t).values, [10, 20, 30])
})

test('E5 layout sum on the main thread only', () => {
  const thread = { pid: 1, tid: 1 }
  const events = [
    { ph: 'X', name: 'Layout', pid: 1, tid: 1, ts: 1, dur: 2000 },
    { ph: 'X', name: 'Layout', pid: 1, tid: 1, ts: 5, dur: 3000 },
    { ph: 'X', name: 'Layout', pid: 1, tid: 2, ts: 5, dur: 9000 }
  ]
  assert.deepEqual(TRACE_METRICS['layout-sum-ms']({ events, thread }).values, [5])
})

test('E6 checks text parses ok/fail strings and numbers', () => {
  const c = parseChecks('paste-matches-selection=ok; pin-bottom-distance=0.5;bad;x=fail')
  assert.deepEqual(
    [...c],
    [
      ['paste-matches-selection', 'ok'],
      ['pin-bottom-distance', 0.5],
      ['x', 'fail']
    ]
  )
})

// 잠긴 plan 에서 W1 셀 하나 묶음을 쓴다 — 셀 정의는 production 생성기의 것이다.
const plan = JSON.parse(
  readFileSync(
    join(
      here,
      '../../docs/handoff/0330-windows-responsiveness-verdict/evidence/wu-w/lock/plan.json'
    ),
    'utf8'
  )
)
const INT = plan.integrationSha
const traceFor = (stallMs) =>
  JSON.stringify({
    traceEvents: [
      M(1, 1),
      mark(1),
      task(1, 1, 1000, stallMs),
      task(1, 1, 3000, 20),
      ...['draw', 'drop', 'draw'].map((s, i) => frame(i, 2000 + i * 16000, s)),
      ...timing('k1', 'keydown', 2500, 12)
    ]
  })
const rowFor = (extra = {}) => ({
  owner: '0330',
  scenario: 'W1',
  operation: 'long-chat-type-wheel-drag',
  load: 'history-1',
  harness: 'claude-code',
  build: 'diagnostic',
  side: 'after',
  sha: INT,
  repeat: '1',
  runId: 'w1-r1',
  startedAt: '2026-11-26T12:00:00Z',
  endedAt: '2026-11-26T12:01:00Z',
  traceFile: 'w1-r1.json',
  checks: '',
  ...extra
})
const builds = { [INT]: { binarySha256: 'a'.repeat(64), diffSha256: 'b'.repeat(64) } }

test('E7/E8 run fields and trace ranges come from the row and the locked cell', () => {
  const files = { 'w1-r1.json': traceFor(170) }
  const out = observe({
    plan,
    rows: [rowFor(), { ...rowFor(), runId: '' }],
    readRaw: (p) => files[p] ?? null,
    builds,
    profileRef: { path: 'p.txt', sha256: 'c' },
    tool: 'd'.repeat(40)
  })
  assert.equal(out.manifest.runs.length, 1)
  const r = out.manifest.runs[0]
  assert.deepEqual(
    [
      r.sample,
      r.pairId,
      r.side,
      r.sha,
      r.appSource.commit,
      r.appSource.dirty,
      r.appSource.diffSha256,
      r.binarySha256,
      r.buildKind,
      r.profile,
      r.scenario,
      r.operation,
      r.load,
      r.harness,
      r.repeat,
      r.runRef.kind
    ],
    [
      'w',
      'W-0330',
      'after',
      INT,
      INT,
      true,
      'b'.repeat(64),
      'a'.repeat(64),
      'diagnostic',
      'win-4ejndg',
      'W1',
      'long-chat-type-wheel-drag',
      'history-1',
      'claude-code',
      1,
      'trace'
    ]
  )
  const stall = out.observations.find((o) => o.metric === 'longest-stall-ms')
  assert.deepEqual(stall.values, [170])
  assert.deepEqual(stall.rawRef.range, { kind: 'trace-ts', start: 1000, end: 3000 })
  const owner = observe({
    plan,
    rows: [
      rowFor({
        owner: '0326',
        scenario: 'S1',
        operation: 'stream-type-wheel',
        load: 'default',
        sha: plan.wBaselineSha.replace(/^d868.*/, '7c241d191438e7aa9625a2914c38fe0a1b3d1bdd')
      })
    ],
    readRaw: (p) => files[p] ?? null,
    builds: { '7c241d191438e7aa9625a2914c38fe0a1b3d1bdd': builds[INT] },
    profileRef: { path: 'p.txt', sha256: 'c' },
    tool: 'd'.repeat(40)
  })
  assert.equal(owner.manifest.runs[0].sample, 'owner')
})

test('observe output passes the verdict reader (AR-06)', () => {
  const root = mkdtempSync(join(tmpdir(), 'oo-observe-'))
  try {
    for (const [name, stall, expected] of [
      ['ok', 120, '충족'],
      ['stall', 170, '위반']
    ]) {
      const dir = join(root, name)
      const raw = join(dir, 'raw')
      spawnSync(process.execPath, [
        '-e',
        `require('fs').mkdirSync(${JSON.stringify(raw)},{recursive:true})`
      ])
      writeFileSync(
        join(raw, 'profile.txt'),
        'Caption : Microsoft Windows 11 Home\nVersion : 10.0.22631\n'
      )
      const cols = Object.keys(rowFor())
      const rows = [1, 2, 3].map((r) => {
        writeFileSync(join(raw, `w1-r${r}.json`), traceFor(stall))
        const row = rowFor({ repeat: String(r), runId: `w1-r${r}`, traceFile: `w1-r${r}.json` })
        return cols.map((k) => row[k]).join('\t')
      })
      writeFileSync(join(dir, 'runs.tsv'), cols.join('\t') + '\n' + rows.join('\n') + '\n')
      writeFileSync(join(dir, 'builds.json'), JSON.stringify(builds))
      const lock = join(
        here,
        '../../docs/handoff/0330-windows-responsiveness-verdict/evidence/wu-w/lock'
      )
      const o = spawnSync(
        process.execPath,
        [
          join(here, 'windows-observe.mjs'),
          '--plan',
          join(lock, 'plan.json'),
          '--runsheet',
          join(dir, 'runs.tsv'),
          '--raw-root',
          raw,
          '--builds',
          join(dir, 'builds.json'),
          '--profile-ref',
          'profile.txt',
          '--tool',
          'd'.repeat(40),
          '--out-manifest',
          join(dir, 'm.json'),
          '--out-observations',
          join(dir, 'o.jsonl')
        ],
        { encoding: 'utf8' }
      )
      assert.equal(o.status, 0, o.stderr)
      const v = spawnSync(
        process.execPath,
        [
          join(here, 'windows-verdict.mjs'),
          '--plan',
          join(lock, 'plan.json'),
          '--manifest',
          join(dir, 'm.json'),
          '--observations',
          join(dir, 'o.jsonl'),
          '--raw-root',
          raw,
          '--decision',
          join(lock, 'decision.json')
        ],
        { encoding: 'utf8' }
      )
      const report = JSON.parse(v.stdout)
      const cell = report.cells.find((c) =>
        c.key.startsWith(
          '0330|W1|long-chat-type-wheel-drag|history-1|claude-code|diagnostic|after|longest-stall-ms|'
        )
      )
      // 반복 3 · 원본 해시·런타임(profileRef Caption) 통과 → D-109 ② 160ms 정지 규칙으로 판정된다.
      assert.equal(cell.status, expected, JSON.stringify(cell))
      assert.equal(cell.n, 3)
      const one = JSON.parse(readFileSync(join(dir, 'o.jsonl'), 'utf8').split('\n')[0])
      assert.equal(
        one.rawRef.sha256,
        createHash('sha256')
          .update(readFileSync(join(raw, 'w1-r1.json')))
          .digest('hex')
      )
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
