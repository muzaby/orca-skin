// `measure-ui-inputs.mjs` 의 순수 부분 — 입력 생성 · 결정성 · N/A · 요약 · `--src` 번들 (0325 VP-33 m1~m5 · EP-10).
//
// m5는 임시 소스 트리, J8은 현재 reducer와 블록 모델을 번들한다. 여기서 잠그는 것은 AC19 의 재현 입력과 요약이 **무엇을 재는지**가 조용히
// 바뀌지 않는다는 것이다 — 입력이 실행마다 달라지면 전후 비교가 입력 차이를 잰다.

import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  addedPatchLines,
  draftText,
  emptySessionMessages,
  exchangeHistory,
  formatCell,
  formatJ10Rows,
  gitFileContent,
  inputFiles,
  jOpenFenceStream,
  jTranscriptMessages,
  loadTree,
  longLinePair,
  measureCase,
  measureJ10Virtualizer,
  measurementCases,
  MEASURED_RUNS,
  multiEditCall,
  patchFiles,
  pngImage,
  summarize,
  transcriptMeasurementCases,
  WARMUP_RUNS
} from './measure-ui-inputs.mjs'

const lineCount = (text) => text.split('\n').length

test('m1 입력 크기·개수가 §19 표와 같다', () => {
  const session = emptySessionMessages()
  assert.equal(session.length, 200_000)
  assert.ok(session.every((message) => message.parts.length === 0))
  const patch = addedPatchLines()
  assert.equal(patch.length, 50_000)
  assert.ok(patch.every((line) => line.type === 'added'))
  assert.equal(draftText('large').length, 400_000)
  assert.equal(draftText('edge').length, 20_000)
  assert.equal(draftText('over').length, 20_001)
  const edits = multiEditCall().input.edits
  assert.equal(edits.length, 50)
  assert.ok(
    edits.every((edit) => lineCount(edit.old_string) === 200 && lineCount(edit.new_string) === 200)
  )
  const [a, b] = longLinePair()
  assert.deepEqual(
    [a.length, b.length, a.includes('\n'), b.includes('\n')],
    [5_000_000, 5_000_000, false, false]
  )
  const files = patchFiles()
  assert.equal(files.length, 3)
  assert.ok(files.every((file) => file.patch.length === 404_045))
  const history = exchangeHistory()
  assert.equal(history.base.length, 20_000)
  assert.equal(history.next.length, 20_001)
  assert.deepEqual(history.next.slice(0, -1), history.base)
  const png = pngImage(4032, 3024, 0)
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG')
  assert.equal(png.readUInt32BE(16), 4032)
  assert.equal(png.readUInt32BE(20), 3024)
  assert.equal(lineCount(gitFileContent().trimEnd()), 50_000)
  const names = Object.keys(inputFiles()).sort()
  assert.deepEqual(names, [
    'draft-20000.txt',
    'draft-20001.txt',
    'draft-400000.txt',
    'git-50000/generated.ts',
    'image-1.png',
    'image-2.png',
    'image-3.png',
    'image-4.png',
    'image-5.png'
  ])
  // 측정 행 I1~I9 — 모듈이 비면 모두 함수 없음이다.
  const empty = {
    dataHost: {},
    patchLines: {},
    diffHunks: {},
    decoration: {},
    toolMeta: {},
    inline: {},
    filePresentation: {},
    turns: {}
  }
  assert.deepEqual(
    measurementCases(empty).map((item) => item.id),
    ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9']
  )
})

test('m2 같은 인자 두 번 → 산출 바이트가 같다', () => {
  const first = inputFiles()
  const second = inputFiles()
  for (const name of Object.keys(first)) assert.ok(first[name].equals(second[name]), name)
  assert.deepEqual(emptySessionMessages(10), emptySessionMessages(10))
  assert.equal(JSON.stringify(exchangeHistory(5)), JSON.stringify(exchangeHistory(5)))
  assert.ok(!pngImage(8, 8, 1).equals(pngImage(8, 8, 2)))
})

test('m3 던지는 측정 → `N/A(실패: 메시지)` · 없는 함수 → `N/A(함수 없음)`', () => {
  assert.equal(
    measureCase(() => {
      throw new RangeError('Maximum call stack size exceeded')
    }),
    'N/A(실패: Maximum call stack size exceeded)'
  )
  assert.equal(measureCase(undefined), 'N/A(함수 없음)')
  const empty = {
    dataHost: {},
    patchLines: {},
    diffHunks: {},
    decoration: {},
    toolMeta: {},
    inline: {},
    filePresentation: {},
    turns: {}
  }
  for (const item of measurementCases(empty))
    assert.equal(measureCase(item.run, { prepare: item.prepare }), 'N/A(함수 없음)', item.id)
  assert.equal(formatCell('N/A(함수 없음)'), 'N/A(함수 없음)')
})

test('m4 요약 = 예열 1회를 뺀 9회의 중앙값·최대', () => {
  assert.equal(WARMUP_RUNS + MEASURED_RUNS, 10)
  // 예열(1,000)이 가장 크다 — 요약에 들어가면 최대가 1,000 이 된다.
  const times = [1_000, 9, 1, 8, 2, 7, 3, 6, 4, 5]
  assert.deepEqual(summarize(times), { median: 5, max: 9 })
  assert.throws(() => summarize([1, 2, 3]))
  // measureCase 는 주어진 시계로 10회를 재고 같은 요약을 낸다 — 시작·끝 시각을 번갈아 낸다.
  let now = 0
  let call = 0
  const clock = () => {
    if (call % 2 === 1) now += times[(call - 1) / 2]
    call++
    return now
  }
  assert.deepEqual(
    measureCase(() => {}, { clock }),
    { median: 5, max: 9 }
  )
  assert.equal(call, 20)
  assert.equal(formatCell({ median: 5, max: 9 }), '5.00ms / 9.00ms')
})

test('m5 `--src` 트리의 소스만 번들해 부르고 없는 모듈은 빈 모듈이다(EP-10 ④)', async () => {
  const tree = mkdtempSync(join(tmpdir(), 'measure-tree-'))
  try {
    mkdirSync(join(tree, 'src/shared'), { recursive: true })
    // 대상 트리의 의존(`diff`)은 실행하는 app 의 node_modules 로 해석한다.
    writeFileSync(
      join(tree, 'src/shared/data-host.ts'),
      "import { diffLines } from 'diff'\nexport function splitSessionMessages(): string { return 'tree:' + diffLines('a', 'b').length }\n"
    )
    const modules = await loadTree(tree)
    assert.equal(modules.dataHost.splitSessionMessages(), 'tree:2')
    assert.deepEqual(Object.keys(modules.turns), [])
    const cases = measurementCases(modules)
    assert.equal(measureCase(cases[0].run), 'N/A(함수 없음)') // assembleSession 이 없는 트리
    assert.equal(measureCase(cases[8].run, { prepare: cases[8].prepare }), 'N/A(함수 없음)')
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
})

test('j2 0326 J1~J8 입력 생성기는 같은 인자에서 결정적 동일 결과를 낸다', () => {
  assert.deepEqual(jTranscriptMessages(5), jTranscriptMessages(5))
  assert.deepEqual(jOpenFenceStream(500, 50), jOpenFenceStream(500, 50))
})

test('j1 J6 measures 10,000 separate parts and preserves the earlier part range on each branch', () => {
  const reads = []
  const items = transcriptMeasurementCases({
    segmentCache: {
      createSegmentCache: () => ({
        segmentsFor(message, from) {
          reads.push([message, from])
        }
      })
    }
  })
  for (const [prefix, initialCount, nextCount, changedFrom] of [
    ['J6', 10000, 10001, 10000],
    ['J6(withdraw)', 10000, 10000, 1],
    ['J6(different-kind)', 10000, 10001, 10000]
  ]) {
    for (const branch of ['coldBuild', 'incremental', 'cacheHit']) {
      reads.length = 0
      const item = items.find((item) => item.id === prefix + ':' + branch)
      item.run(item.prepare())
      assert.equal(reads[0][0].parts.length, initialCount)
      assert.equal(reads.length, branch === 'coldBuild' ? 1 : 2)
      if (branch === 'incremental') {
        assert.equal(reads[1][0].parts.length, nextCount)
        assert.equal(reads[1][1], changedFrom)
      } else if (branch === 'cacheHit') {
        assert.equal(reads[1][0], reads[0][0])
      }
    }
  }
})

test('j3 J1~J8 각 항목은 coldBuild · incremental · cacheHit 세 갈래를 가진다', () => {
  const jCases = transcriptMeasurementCases({})
  const ids = jCases.map((c) => c.id)
  const variants = [
    'J1',
    'J1(work)',
    'J2',
    'J3',
    'J4',
    'J5',
    'J5(1000)',
    'J6',
    'J6(withdraw)',
    'J6(different-kind)',
    'J7',
    'J7(list)',
    'J7(paragraph)',
    'J8',
    'J8(100)'
  ]
  assert.deepEqual(
    ids.sort(),
    [
      ...variants.flatMap((id) =>
        ['coldBuild', 'incremental', 'cacheHit'].map((branch) => id + ':' + branch)
      ),
      'J7:code',
      'J7:dom'
    ].sort()
  )
})

test('j3/j7 each sample prepares a fresh input before the measured interval', () => {
  let elapsed = 0
  let prepared = 0
  const seen = []
  const summary = measureCase(
    (sample) => {
      seen.push(sample)
      elapsed += sample === 1 ? 100 : 3
    },
    {
      prepare() {
        elapsed += 20
        return ++prepared
      },
      clock: () => elapsed
    }
  )
  assert.deepEqual(
    seen,
    Array.from({ length: WARMUP_RUNS + MEASURED_RUNS }, (_, i) => i + 1)
  )
  assert.deepEqual(summary, { median: 3, max: 3 })
})

test('j4 setup failure reports its string value and skips the sample', () => {
  let ran = false
  const reason = { toString: () => 'fixture unavailable' }
  const result = measureCase(
    () => {
      ran = true
    },
    {
      prepare() {
        throw reason
      }
    }
  )
  assert.equal(result, 'N/A(실패: fixture unavailable)')
  assert.equal(ran, false)
})

test('j4 없는 모듈 트리에서 J1~J8 측정은 N/A(함수 없음) 를 반환한다', () => {
  const jCases = transcriptMeasurementCases({})
  for (const item of jCases) {
    assert.equal(measureCase(item.run), 'N/A(함수 없음)', item.id)
  }
})

test('J1–J7 exercise the specified transcript edits, board sizes, segment edits and stream lengths', async () => {
  const modules = await loadTree(fileURLToPath(new URL('..', import.meta.url)))
  let change
  const cases = transcriptMeasurementCases({
    ...modules,
    reducer: {
      ...modules.reducer,
      chatReducer(state, action) {
        const result = modules.reducer.chatReducer(state, action)
        change = result.transcriptChanges.log.at(-1)
        return result
      }
    }
  })
  const byId = new Map(cases.map((item) => [item.id, item]))
  const run = (id) => {
    const item = byId.get(id)
    return item.run(item.prepare?.())
  }
  for (const name of ['J1', 'J1(work)', 'J2', 'J3', 'J4']) {
    const item = byId.get(name + ':incremental')
    const ctx = item.prepare()
    assert.equal(ctx.state.messages.length, 20_000)
    const value = item.run(ctx)
    assert.deepEqual(change, {
      kind: 'replace',
      id: name === 'J3' || name === 'J4' ? 'a:j-0' : 'a:j-9999',
      partsFrom: 3
    })
    if (name === 'J4') assert.equal(value.length, 9)
    else assert.ok(value.count >= 20_000)
  }
  for (const [name, size] of [
    ['J5', 100],
    ['J5(1000)', 1000]
  ]) {
    const result = run(name + ':incremental')
    assert.equal(result.length, size)
    assert.equal(result.find((item) => item.id === '1').status, 'completed')
  }
  assert.equal(run('J6:incremental')[0].text, 'x'.repeat(10_000) + 'new')
  assert.equal(run('J6(withdraw):coldBuild')[0].calls[0].result.output, 'old')
  assert.equal(run('J6(withdraw):incremental')[0].calls[0].result, undefined)
  assert.equal(run('J6(different-kind):incremental').at(-1).kind, 'reasoning')
  for (const name of ['J7', 'J7(list)', 'J7(paragraph)'])
    assert.equal(run(name + ':incremental'), 100_000)
  const { full, deltas } = jOpenFenceStream()
  assert.equal(deltas.length, 2000)
  assert.ok(deltas.every((delta) => delta.length === 50))
  const expectedCode = full.slice(full.indexOf('\n') + 1).replace(/\n$/, '')
  assert.equal(run('J7:code'), expectedCode)
  assert.equal(run('J7:dom'), expectedCode)
})

test('J8 prepends a turn through the production reducer and reuses the loaded state on cache hits', async () => {
  const modules = await loadTree(fileURLToPath(new URL('..', import.meta.url)))
  const cases = transcriptMeasurementCases(modules)
  for (const [prefix, turns] of [
    ['J8', 1],
    ['J8(100)', 100]
  ]) {
    for (const branch of ['coldBuild', 'incremental', 'cacheHit']) {
      const item = cases.find((row) => row.id === `${prefix}:${branch}`)
      const context = item.prepare()
      const before = context.model.snapshot()
      const measured = item.run(context)
      assert.equal(measured.messages, (turns + Number(branch === 'incremental')) * 2)
      assert.ok(measured.blocks > 0)
      if (branch === 'cacheHit') assert.equal(context.model.snapshot().revision, before.revision)
    }
  }
})

test('j5 J10 compares equal-sized updates with callback invalidation and key reordering', async () => {
  const rows = await measureJ10Virtualizer([500])
  const byId = new Map(rows.map((row) => [row.id, row]))
  const row = (name) => byId.get(`J10(500:${name})`)
  assert.equal(rows.length, 6)
  assert.ok(rows.every((item) => Number.isFinite(item.result.median)))
  assert.equal(row('content').firstKey, 'k:0')
  assert.equal(row('callback').firstKey, 'k:0')
  assert.equal(row('reorder').firstKey, 'k:1')
  assert.equal(row('content').getItemKeyCalls, 0)
  assert.ok(row('callback').getItemKeyCalls >= 500)
  assert.ok(row('reorder').getItemKeyCalls >= 500)
  assert.equal(row('count+1').getItemKeyCalls, row('callback').getItemKeyCalls + 1)
  assert.equal(row('reorder').getItemKeyCalls, row('callback').getItemKeyCalls)
  assert.ok(row('topResize').getItemKeyCalls > row('lastResize').getItemKeyCalls)
})

test('j7 J10 Virtualizer getItemKey counts and measured times accompany every row', async (t) => {
  let tick = 0
  t.mock.method(performance, 'now', () => ++tick)
  const j10 = await measureJ10Virtualizer()
  assert.deepEqual(
    j10.map((r) => r.count),
    [...Array(6).fill(5000), ...Array(6).fill(100000)]
  )
  for (const row of j10) {
    assert.ok(Number.isInteger(row.getItemKeyCalls) && row.getItemKeyCalls >= 0)
    assert.ok(row.result.median > 0 && row.result.max >= row.result.median)
  }
})

test('j7 report rows keep the sample size, timing and key count of each measured operation together', () => {
  const j10 = [
    { id: 'J10(37:content)', count: 37, getItemKeyCalls: 0, result: { median: 2, max: 3 } },
    { id: 'J10(71:reorder)', count: 71, getItemKeyCalls: 88, result: { median: 21, max: 32 } }
  ]
  assert.deepEqual(formatJ10Rows(j10), [
    '| J10(37:content) | Virtualizer (37블록, getItemKey=0) | 2.00ms / 3.00ms |',
    '| J10(71:reorder) | Virtualizer (71블록, getItemKey=88) | 21.00ms / 32.00ms |'
  ])
})
