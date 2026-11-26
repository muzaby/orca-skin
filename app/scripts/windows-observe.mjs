// 0330 W-046 — Windows 실측 trace·측정자 확인 값을 판독기 입력(manifest·observations)으로 바꾼다(측정 전용).
//
// node scripts/windows-observe.mjs --plan <lock/plan.json> --runsheet <tsv> --raw-root <dir>
//   --builds <builds.json> --profile-ref <장비 기록 경로(raw-root 기준)> --tool <full SHA>
//   --out-manifest <file> --out-observations <file>
// trace 유도 지표는 아래 TRACE_METRICS 만, 그 밖은 실행표 `checks` 칸만에서 만든다. 둘 다 아니면 관측을
// 만들지 않는다 — 판독기가 그 셀을 `missing`으로 보인다(fail-closed). 규칙 정본: 0330 plan §24-D.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const ms = (us) => Math.round((us / 1000) * 1000) / 1000

export function traceEvents(text) {
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? [])
}

export const MEASURE_MARK = 'oo-measure-start'

/**
 * E1′(ΔV6 W-050) — `oo-measure-start` user timing 표식이 찍힌 pid 의 `CrRendererMain`.
 * 실제 trace 에는 DevTools 창 렌더러도 있고 프로세스 이름표가 없어(probe2) 표식으로만 앱 창을 가른다.
 */
export function mainThread(events) {
  const mark = events.find(
    (e) => e.name === MEASURE_MARK && String(e.cat ?? '').includes('blink.user_timing')
  )
  if (!mark) return null
  const main = events.find(
    (e) =>
      e.ph === 'M' &&
      e.name === 'thread_name' &&
      e.args?.name === 'CrRendererMain' &&
      e.pid === mark.pid
  )
  return main ? { pid: main.pid, tid: main.tid } : null
}

const onThread = (t) => (e) => e.pid === t.pid && e.tid === t.tid

/** E2 — 주 스레드 RunTask 길이(ms). */
export function taskDurations(events, thread) {
  return events
    .filter((e) => e.ph === 'X' && e.name === 'RunTask' && onThread(thread)(e))
    .map((e) => ({ ms: ms(e.dur ?? 0), ts: e.ts }))
}

/**
 * E3′(ΔV6 rev 2 W-051) — DevTools Frames 트랙 모형. 주 스레드 pid 의 `DrawFrame`(표시)·`DroppedFrame`(누락 —
 * 부분 표시 포함)을 `args.frameSeqId`로 묶고, 같은 seq 에 둘 다 있으면 누락이다. PipelineReporter 는 한 seq 에
 * 보고자가 둘이라 쓰지 않는다(probe3).
 */
export function frameStates(events, pid) {
  const bySeq = new Map()
  for (const e of events) {
    if ((e.name !== 'DrawFrame' && e.name !== 'DroppedFrame') || e.pid !== pid) continue
    const seq = Number(e.args?.frameSeqId)
    if (!Number.isFinite(seq)) continue
    const prev = bySeq.get(seq)
    const dropped = e.name === 'DroppedFrame' || prev?.dropped === true
    bySeq.set(seq, {
      seq,
      ts: prev ? Math.min(prev.ts, e.ts) : e.ts,
      dropped,
      partial: dropped && (e.args?.hasPartialUpdate === true || prev?.partial === true)
    })
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

export function longestRun(frames) {
  let best = 0
  let run = 0
  for (const f of frames) {
    run = f.dropped ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

const KEY = new Set(['keydown', 'keypress', 'keyup'])
const CLICK = new Set(['click', 'pointerup', 'pointerdown'])

/** E4 — EventTiming 비동기 시작·끝 쌍(같은 id). 끝 없는 시작은 버린다. */
export function eventTimings(events) {
  const idOf = (e) => `${e.pid}:${e.id ?? e.id2?.local ?? e.id2?.global}`
  const open = new Map()
  const out = []
  for (const e of events.filter((x) => x.name === 'EventTiming').sort((a, b) => a.ts - b.ts)) {
    if (e.ph === 'b') open.set(idOf(e), e)
    else if (e.ph === 'e' && open.has(idOf(e))) {
      const b = open.get(idOf(e))
      open.delete(idOf(e))
      out.push({ type: b.args?.data?.type, ms: ms(e.ts - b.ts), ts: b.ts, end: e.ts })
    }
  }
  return out
}

const span = (items) =>
  items.length
    ? {
        start: Math.min(...items.map((i) => i.ts)),
        end: Math.max(...items.map((i) => i.end ?? i.ts))
      }
    : null

/** 지표 이름 → trace 유도. 모르는 지표는 null. */
export const TRACE_METRICS = {
  'key-to-paint': (t) => timing(t, KEY),
  'input-to-paint': (t) => timing(t, KEY),
  'input-to-paint-max': (t) => timing(t, KEY),
  'click-to-paint': (t) => timing(t, CLICK),
  'collapse-click-to-paint': (t) => timing(t, CLICK),
  'longest-stall-ms': (t) => {
    const long = t.tasks.filter((x) => x.ms >= 50)
    return { values: long.length ? long.map((x) => x.ms) : [0], used: t.tasks }
  },
  'tasks-over-50ms': (t) => ({ values: [t.tasks.filter((x) => x.ms > 50).length], used: t.tasks }),
  'longest-consecutive-dropped': (t) => ({ values: [longestRun(t.frames)], used: t.frames }),
  'dropped-frames': (t) => dropped(t),
  'wheel-dropped-frames': (t) => dropped(t),
  'drag-dropped-frames': (t) => dropped(t),
  'wheel-presented-frames': (t) => presented(t),
  'drag-presented-frames': (t) => presented(t),
  'drag-frame-interval': (t) => {
    const shown = t.frames.filter((f) => !f.dropped)
    return { values: shown.slice(1).map((f, i) => ms(f.ts - shown[i].ts)), used: shown }
  },
  'layout-sum-ms': (t) => {
    const layouts = t.events.filter(
      (e) => e.ph === 'X' && e.name === 'Layout' && onThread(t.thread)(e)
    )
    return {
      values: [ms(layouts.reduce((n, e) => n + (e.dur ?? 0), 0))],
      used: layouts.map((e) => ({ ts: e.ts }))
    }
  }
}
function timing(t, types) {
  const hits = t.timings.filter((x) => types.has(x.type))
  return { values: hits.map((x) => x.ms), used: hits }
}
const dropped = (t) => ({ values: t.frames.filter((f) => f.dropped).map(() => 1), used: t.frames })
const presented = (t) => ({ values: [t.frames.filter((f) => !f.dropped).length], used: t.frames })

/** E6 — `지표=값;…`. ok·fail 은 문자열, 수치는 수. */
export function parseChecks(text = '') {
  const out = new Map()
  for (const part of text
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf('=')
    if (i < 1) continue
    const value = part.slice(i + 1).trim()
    out.set(part.slice(0, i).trim(), /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value)
  }
  return out
}

export function parseRunsheet(text) {
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim())
  const cols = head.split('\t')
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v ?? ''])))
}

const runFields = ['scenario', 'operation', 'load', 'harness', 'buildKind', 'profile']
const slotOf = (c, side) =>
  [
    c.owner,
    c.scenario,
    c.operation,
    c.load,
    c.harness,
    c.buildKind,
    side,
    c.pair[side + 'Sha']
  ].join('|')

/**
 * 순수 변환. `readRaw(path)` → 문자열 또는 null. 반환 `writes`는 추출기가 원본 폴더에 쓸 확인 값 파일.
 */
export function observe({ plan, rows, readRaw, builds, profileRef, tool }) {
  const runs = []
  const observations = []
  const writes = []
  for (const row of rows) {
    if (!row.runId || !row.startedAt || !row.endedAt || !row.traceFile) continue
    const side = row.side
    const cells = plan.cells.filter(
      (c) =>
        (c.side === 'pair' ? ['before', 'after'] : [c.side]).includes(side) &&
        slotOf(c, side) ===
          [
            row.owner,
            row.scenario,
            row.operation,
            row.load,
            row.harness,
            row.build,
            side,
            row.sha
          ].join('|')
    )
    if (!cells.length) continue
    const c0 = cells[0]
    const build = builds[row.sha]
    const traceText = readRaw(row.traceFile)
    const run = {
      runId: row.runId,
      sample: c0.owner === '0330' ? 'w' : 'owner',
      pairId: c0.pair.id,
      side,
      runtime: 'win32-electron',
      runRef: {
        path: row.traceFile,
        sha256: traceText == null ? '' : sha256(traceText),
        kind: 'trace'
      },
      profileRef,
      sha: row.sha,
      tool,
      appSource: { commit: row.sha, tree: null, dirty: true, diffSha256: build?.diffSha256 ?? '' },
      binarySha256: build?.binarySha256 ?? '',
      ...Object.fromEntries(runFields.map((k) => [k, c0[k]])),
      repeat: Number(row.repeat),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      tools: { 'chrome-trace': { version: 'devtools-performance', environment: 'win32-electron' } }
    }
    runs.push(run)
    let trace = null
    if (traceText != null) {
      const events = traceEvents(traceText)
      const thread = mainThread(events)
      if (thread)
        trace = {
          events,
          thread,
          tasks: taskDurations(events, thread),
          frames: frameStates(events, thread.pid),
          timings: eventTimings(events)
        }
    }
    const checks = parseChecks(row.checks)
    const checkLines = [...checks.entries()].map(([k, v]) => `${k}=${v}`)
    const checkFile = row.runId + '.checks.txt'
    if (checkLines.length) writes.push({ path: checkFile, text: checkLines.join('\n') + '\n' })
    const seen = new Set()
    for (const c of cells) {
      const names =
        c.rule.aggregate === 'ratio' ? [c.rule.numerator, c.rule.denominator] : [c.metric]
      for (const metric of names) {
        const key = metric + '|' + c.interval
        if (seen.has(key)) continue
        seen.add(key)
        const derive = TRACE_METRICS[metric]
        if (derive && trace) {
          const d = derive(trace)
          const s = span(d.used) ?? span(trace.tasks) ?? { start: 0, end: 0 }
          observations.push({
            runId: run.runId,
            metric,
            interval: c.interval,
            unit: c.rule.inputUnit,
            values: d.values,
            rawRef: {
              path: run.runRef.path,
              sha256: run.runRef.sha256,
              range: { kind: 'trace-ts', start: s.start, end: s.end }
            }
          })
        } else if (checks.has(metric)) {
          const line = checkLines.indexOf(`${metric}=${checks.get(metric)}`) + 1
          const text = checkLines.join('\n') + '\n'
          observations.push({
            runId: run.runId,
            metric,
            interval: c.interval,
            unit: c.rule.inputUnit,
            values: [checks.get(metric)],
            rawRef: {
              path: checkFile,
              sha256: sha256(text),
              range: { kind: 'lines', start: line, end: line }
            }
          })
        }
      }
    }
  }
  return { manifest: { runs }, observations, writes }
}

function cli(argv) {
  const arg = (n) => {
    const i = argv.indexOf(n)
    return i < 0 ? undefined : argv[i + 1]
  }
  const need = [
    '--plan',
    '--runsheet',
    '--raw-root',
    '--builds',
    '--profile-ref',
    '--tool',
    '--out-manifest',
    '--out-observations'
  ]
  const missing = need.filter((n) => !arg(n))
  if (missing.length) {
    console.error('필요: ' + missing.join(' '))
    return 2
  }
  const root = arg('--raw-root')
  const readRaw = (p) => {
    try {
      return readFileSync(join(root, p), 'utf8')
    } catch {
      return null
    }
  }
  const out = observe({
    plan: JSON.parse(readFileSync(arg('--plan'), 'utf8')),
    rows: parseRunsheet(readFileSync(arg('--runsheet'), 'utf8')),
    readRaw,
    builds: JSON.parse(readFileSync(arg('--builds'), 'utf8')),
    profileRef: { path: arg('--profile-ref'), sha256: sha256(readRaw(arg('--profile-ref')) ?? '') },
    tool: arg('--tool')
  })
  for (const w of out.writes) writeFileSync(join(root, w.path), w.text)
  writeFileSync(arg('--out-manifest'), JSON.stringify(out.manifest, null, 1) + '\n')
  writeFileSync(
    arg('--out-observations'),
    out.observations.map((o) => JSON.stringify(o)).join('\n') +
      (out.observations.length ? '\n' : '')
  )
  console.log(
    JSON.stringify({
      runs: out.manifest.runs.length,
      observations: out.observations.length,
      checkFiles: out.writes.length
    })
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = cli(process.argv.slice(2))
