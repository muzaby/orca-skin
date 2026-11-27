// VP-43: the standalone --perf runner consumes exactly these 30 independent records.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { findVisibleTarget } from './transcript-body/find-target.mjs'
import { bodyCorpora, fixture } from './transcript-body/fixtures.mjs'
import { judgeBodyMatrix } from './transcript-body/perf.mjs'
import { overlapsMeasurement } from './transcript-body/observation.mjs'

const calibration = { calibration: true, supported: true, lost: 0 }
const inputs = ['B1', 'B2', 'B3', 'B4', 'B5']
const counts = {
  B1: { paragraphs: 1 },
  B2: { regular: 3000, fences: 40, tables: 2, list: 30000, structure: 1, cells: 1, footnote: 1 },
  B3: { paragraphs: 1 },
  B4: { paragraphs: 1, inline: 25001 },
  B5: { paragraphs: 2443, checked: 2443 }
}

function records() {
  return ['claude-code', 'opencode-code'].flatMap((screen) =>
    inputs.flatMap((input) =>
      [0, 1, 2].map((run) => {
        const corpus = bodyCorpora[input]
        return {
          screen,
          input,
          run,
          ...corpus,
          complete: true,
          stable: 10,
          delivered: input === 'B3' ? corpus.characters : corpus.bytes,
          pending: 0,
          lateMutation: false,
          supported: true,
          lost: 0,
          start: 100,
          end: 250,
          longtask: [],
          longAnimationFrame: [],
          sourceMatches: true,
          formattedBodyMatches: true,
          selectionMatches: true,
          searchTarget: true,
          nativeFind: true,
          nativeMatches: 1,
          findRect: { x: 10, y: 20, width: 22, height: 12 },
          markerRect: { x: 25, y: 19, width: 20, height: 14 },
          phases: [
            { name: 'first input', at: 100 },
            { name: input === 'B3' ? 'last delta' : 'last page', at: 130 },
            { name: 'markdown mounted', at: 190 },
            { name: 'final render', at: 235 }
          ],
          bodyCounts: { ...counts[input] },
          viewport: [1000, 600],
          dpr: 1,
          electron: '40.2.1',
          chrome: '144.0.0',
          os: 'linux',
          sha: 'b'.repeat(40)
        }
      })
    )
  )
}

test('locks the exact bytes, logical characters and SHA-256 of each measured input', () => {
  for (const input of inputs) {
    const source = fixture(input)
    const json = JSON.stringify([{ type: 'text', text: source }])
    assert.deepEqual(
      bodyCorpora[input],
      {
        characters: source.length,
        utf8Bytes: Buffer.byteLength(source),
        bytes: Buffer.byteLength(json),
        fixtureSha: createHash('sha256').update(json).digest('hex')
      },
      input
    )
  }
})

test('accepts thirty complete distinct coordinates independent of report ordering', () => {
  assert.deepEqual(judgeBodyMatrix(records().reverse(), calibration), { ok: true, errors: [] })
})

test('requires all independent identities, an observed positive control, and decodable records', () => {
  const all = records()
  for (const [label, rows] of [
    ['missing row', all.slice(1)],
    ['duplicated run with 30 rows', [all[1], ...all.slice(1)]],
    ['unknown input', [{ ...all[0], input: 'B0' }, ...all.slice(1)]],
    ['unknown run', [{ ...all[0], run: '0' }, ...all.slice(1)]],
    ['out of range', [{ ...all[0], run: 3 }, ...all.slice(1)]],
    ['wrong view', [{ ...all[0], screen: 'claude-work' }, ...all.slice(1)]],
    ['array missing', null],
    ['malformed array', {}],
    ['missing record', [null, ...all.slice(1)]],
    ['extra row', [...all, all[0]]]
  ])
    assert.equal(judgeBodyMatrix(rows, calibration).ok, false, label)
  for (const bad of [
    null,
    {},
    { ...calibration, calibration: false },
    { ...calibration, supported: false },
    { ...calibration, lost: 1 }
  ])
    assert.equal(judgeBodyMatrix(all, bad).ok, false, JSON.stringify(bad))
})

const invalid = {
  'incomplete render': { complete: false },
  'string completion flag': { complete: 'true' },
  'missing stable frame': { stable: 9 },
  'unfinished worker': { pending: 1 },
  'mutated after cutoff': { lateMutation: true },
  'observer unsupported': { supported: false },
  'observer lost events': { lost: 1 },
  'nonfinite start': { start: NaN },
  'end before start': { end: 99 },
  'wrong input bytes': { bytes: 1 },
  'truncated input': { delivered: 1 },
  'same size wrong corpus': { fixtureSha: 'x'.repeat(64) },
  'missing long-task data': { longtask: null },
  'invalid raw event': { longtask: [null] },
  'missing frame data': { longAnimationFrame: null },
  'invalid raw animation frame': { longAnimationFrame: [null] },
  'missing source': { sourceMatches: false },
  'wrong rendered format': { formattedBodyMatches: false },
  'wrong clipboard': { selectionMatches: false },
  'wrong source reveal': { searchTarget: false },
  'native search miss': { nativeFind: false },
  'missing find result': { nativeMatches: 0 },
  'duplicate native target': { nativeMatches: 2 },
  'offscreen marker': { markerRect: { x: 10, y: 55, width: 22, height: 12 } },
  'empty native target': { findRect: { x: 10, y: 20, width: 0, height: 12 } },
  'unmeasured marker geometry': { markerRect: null },
  'wrong frame dimensions': { viewport: [1000, 0] },
  'missing DPR': { dpr: NaN },
  'missing build revision': { sha: '' },
  'missing phase': { phases: [{ name: 'first input', at: 100 }] },
  'timeout with otherwise complete fields': { error: 'Renderer exceeded watchdog' },
  'renderer crash': { error: 'renderer crashed' }
}
for (const [description, patch] of Object.entries(invalid))
  test('rejects ' + description, () => {
    const rows = records()
    Object.assign(rows[0], patch)
    assert.equal(judgeBodyMatrix(rows, calibration).ok, false)
  })

test('rejects swapped phase timestamps even when all named phases and coordinates remain present', () => {
  const rows = records()
  const phases = rows[0].phases
  ;[phases[1].at, phases[2].at] = [phases[2].at, phases[1].at]
  assert.equal(judgeBodyMatrix(rows, calibration).ok, false)
})

test('requires the measured DOM counts independently of the completion marker and boolean flags', () => {
  for (const [input, expected] of Object.entries(counts)) {
    for (const field of Object.keys(expected)) {
      const rows = records()
      const row = rows.find((r) => r.input === input)
      row.bodyCounts[field]--
      assert.equal(judgeBodyMatrix(rows, calibration).ok, false, input + ' ' + field)
    }
  }
})

test('retains the whole 80ms entry at either edge and excludes disjoint tasks', () => {
  const rows = records()
  const { start, end } = rows[0]
  for (const [time, expected] of [
    [start - 80, false],
    [start - 79, true],
    [start, true],
    [end - 1, true],
    [end, false],
    [end + 10, false]
  ]) {
    const entry = { startTime: time, duration: 80 }
    const raw = [entry].filter((e) => overlapsMeasurement(e, start, end))
    assert.deepEqual(raw, expected ? [entry] : [])
    rows[0].longtask = raw.map(({ startTime, duration }) => ({ start: startTime, duration }))
    assert.equal(judgeBodyMatrix(rows, calibration).ok, !expected)
  }
})
test('fails closed on invalid raw observer timestamps and observation windows', () => {
  for (const [start, duration, lo, hi] of [
    [NaN, 80, 100, 250],
    [20, Infinity, 100, 250],
    [20, 0, 100, 250],
    [20, 80, 251, 250]
  ]) {
    assert.throws(() => overlapsMeasurement({ startTime: start, duration }, lo, hi), RangeError)
  }
})

test('requires a fresh native rectangle intersecting the same visible target after the viewport moves', async () => {
  const wc = { executeJavaScript: async () => [1000, 600] }
  const before = { x: 400, y: 8468, width: 25, height: 18 }
  const after = { ...before, y: 517 }
  async function sample(second, matches = 1) {
    const rects = [before, after, after, after]
    const requests = []
    const result = await findVisibleTarget(
      wc,
      async (_wc, _needle, first) => {
        requests.push(first)
        return { matches, selectionArea: first ? before : second }
      },
      'end',
      async () => rects.shift()
    )
    return { result, requests }
  }
  const valid = await sample(after)
  assert.equal(valid.result.nativeFind, true)
  assert.deepEqual(valid.requests, [true, false])
  assert.equal((await sample(before)).result.nativeFind, false)
  assert.equal((await sample({ ...after, x: 700 })).result.nativeFind, false)
  assert.equal((await sample(after, 2)).result.nativeFind, false)
})

test('an offscreen target that intersects an offscreen native rectangle cannot pass', async () => {
  const wc = { executeJavaScript: async () => [1000, 600] }
  const rect = { x: 10, y: 1200, width: 25, height: 18 }
  const result = await findVisibleTarget(
    wc,
    async () => ({ matches: 1, selectionArea: rect }),
    'end',
    async () => rect
  )
  assert.equal(result.nativeFind, false)
})
