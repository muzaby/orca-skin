// `measure-ui-inputs.mjs` 의 순수 부분 — 입력 생성 · 결정성 · N/A · 요약 · `--src` 번들 (0325 VP-33 m1~m5 · EP-10).
//
// git 은 실행하지 않는다(번들은 m5 의 임시 트리만). 여기서 잠그는 것은 AC19 의 재현 입력과 요약이 **무엇을 재는지**가 조용히
// 바뀌지 않는다는 것이다 — 입력이 실행마다 달라지면 전후 비교가 입력 차이를 잰다.

import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  addedPatchLines,
  draftText,
  emptySessionMessages,
  exchangeHistory,
  formatCell,
  gitFileContent,
  inputFiles,
  J9_SIZES,
  jOpenFenceStream,
  jTranscriptMessages,
  loadTree,
  longLinePair,
  measureCase,
  measureJ10Virtualizer,
  measureJ9CopyCap,
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

test('j1~j7 0326 J1~J10 입력 결정성 · 세 갈래 요약 · J9 상한 탐색(100~2,000) · J10 Virtualizer getItemKey 계수', async () => {
  // j1/j2: deterministic inputs
  assert.deepEqual(jTranscriptMessages(5), jTranscriptMessages(5))
  assert.deepEqual(jOpenFenceStream(500, 50), jOpenFenceStream(500, 50))
  assert.equal(J9_SIZES.length, 20)
  assert.equal(J9_SIZES[0], 100)
  assert.equal(J9_SIZES[19], 2000)

  // j3/j4: 3 branches per J1..J8 + N/A on empty modules
  const jCases = transcriptMeasurementCases({})
  const ids = jCases.map((c) => c.id)
  for (const prefix of ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8']) {
    assert.ok(ids.includes(`${prefix}:coldBuild`), `${prefix}:coldBuild`)
    assert.ok(ids.includes(`${prefix}:incremental`), `${prefix}:incremental`)
    assert.ok(ids.includes(`${prefix}:cacheHit`), `${prefix}:cacheHit`)
  }
  assert.equal(measureCase(jCases[0].run), 'N/A(함수 없음)')

  // j6: J9 sweep + assemble tasks + '통과 표본 없음' when budget is 0
  const j9 = measureJ9CopyCap([100, 200], { budgetMs: 50 })
  assert.equal(j9.samples.length, 2)
  assert.equal(j9.assembleTasks.length, 2)
  assert.equal(typeof j9.cap, 'number')

  let tick = 0
  const slowClock = () => (tick += 100)
  const j9Fail = measureJ9CopyCap([100, 200], { budgetMs: 50, clock: slowClock })
  assert.equal(j9Fail.cap, '통과 표본 없음')

  // j5/j7: J10 Virtualizer with pinned getItemKey
  const j10 = await measureJ10Virtualizer([500])
  assert.equal(j10.length, 3)
  assert.ok(j10.every((row) => typeof row.getItemKeyCalls === 'number'))
})
