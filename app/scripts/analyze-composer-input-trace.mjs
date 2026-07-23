import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const INPUT_EVENT_NAME = 'EventDispatch'
const INPUT_EVENT_TYPE = 'input'
const PAINT_EVENT_NAME = 'Paint'
const LONG_TASK_EVENT_NAME = 'RunTask'
const LONG_TASK_THRESHOLD_US = 50_000

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function nearestRank(values, percentile) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  return sorted[index]
}

function milliseconds(microseconds) {
  return Math.round((microseconds / 1000) * 1000) / 1000
}

export function traceEventsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (payload != null && Array.isArray(payload.traceEvents)) return payload.traceEvents
  throw new TypeError('trace JSON must be an event array or an object with traceEvents')
}

export function analyzeComposerInputTrace(payload, label = 'composer-input') {
  const events = traceEventsFrom(payload)
  const inputs = events.filter(
    (event) =>
      event?.name === INPUT_EVENT_NAME &&
      event?.args?.data?.type === INPUT_EVENT_TYPE &&
      numeric(event.ts) != null
  )
  const paintsByThread = new Map()

  for (const event of events) {
    if (event?.name !== PAINT_EVENT_NAME || numeric(event.ts) == null) continue
    const key = `${event.pid}:${event.tid}`
    const paints = paintsByThread.get(key) ?? []
    paints.push(event)
    paintsByThread.set(key, paints)
  }
  for (const paints of paintsByThread.values()) paints.sort((a, b) => a.ts - b.ts)

  const samples = []
  for (const input of inputs) {
    const inputStart = input.ts
    const inputEnd = input.ts + (numeric(input.dur) ?? 0)
    const paints = paintsByThread.get(`${input.pid}:${input.tid}`) ?? []
    const paint = paints.find((candidate) => candidate.ts >= inputEnd)
    if (paint == null) continue
    samples.push({
      inputTs: inputStart,
      paintTs: paint.ts,
      latencyUs: paint.ts - inputStart,
      pid: input.pid,
      tid: input.tid
    })
  }

  const latenciesUs = samples.map((sample) => sample.latencyUs)
  const firstInputTs =
    samples.length === 0 ? null : Math.min(...samples.map((sample) => sample.inputTs))
  const lastPaintTs =
    samples.length === 0 ? null : Math.max(...samples.map((sample) => sample.paintTs))
  const sampledThreads = new Set(samples.map((sample) => `${sample.pid}:${sample.tid}`))
  const longTasks = events.filter((event) => {
    const start = numeric(event?.ts)
    const duration = numeric(event?.dur)
    if (
      event?.name !== LONG_TASK_EVENT_NAME ||
      start == null ||
      duration == null ||
      duration < LONG_TASK_THRESHOLD_US ||
      firstInputTs == null ||
      lastPaintTs == null ||
      !sampledThreads.has(`${event.pid}:${event.tid}`)
    ) {
      return false
    }
    return start <= lastPaintTs && start + duration >= firstInputTs
  })

  const p50Us = nearestRank(latenciesUs, 50)
  const p95Us = nearestRank(latenciesUs, 95)
  const maxUs = latenciesUs.length === 0 ? null : Math.max(...latenciesUs)

  return {
    label,
    metric: 'EventDispatch(input) start to next same-thread Paint start',
    inputEvents: inputs.length,
    matchedSamples: samples.length,
    unmatchedSamples: inputs.length - samples.length,
    p50Ms: p50Us == null ? null : milliseconds(p50Us),
    p95Ms: p95Us == null ? null : milliseconds(p95Us),
    maxMs: maxUs == null ? null : milliseconds(maxUs),
    longTasksOver50Ms: longTasks.length,
    longestTaskMs:
      longTasks.length === 0 ? null : milliseconds(Math.max(...longTasks.map((task) => task.dur)))
  }
}

function usage() {
  return [
    'Usage: node scripts/analyze-composer-input-trace.mjs <trace.json> [--label <name>]',
    '',
    'The trace must come from Chromium DevTools Performance and include devtools.timeline.',
    'Capture idle typing and typing-during-streaming as separate traces.'
  ].join('\n')
}

export function runCli(argv = process.argv.slice(2)) {
  let tracePath = null
  let label = 'composer-input'

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--label') {
      label = argv[index + 1]
      if (label == null) throw new Error('--label requires a value')
      index += 1
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write(`${usage()}\n`)
      return 0
    } else if (tracePath == null) {
      tracePath = argument
    } else {
      throw new Error(`unexpected argument: ${argument}`)
    }
  }

  if (tracePath == null) throw new Error(usage())
  const absolutePath = resolve(tracePath)
  const payload = JSON.parse(readFileSync(absolutePath, 'utf8'))
  const result = analyzeComposerInputTrace(payload, label)
  if (result.matchedSamples === 0) {
    throw new Error(
      'no input-to-paint samples found; include EventDispatch(input) and Paint events'
    )
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = runCli()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
