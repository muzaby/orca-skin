// `measure-spinner-perf.mjs` 의 순수 부분 — 페이지 생성 · 차분 · 요약 · 판정.
//
// **Electron 을 띄우지 않는다.** 이 파일은 `npm test` 의 `node --test scripts/*.test.mjs` 안에서
// 도므로 60초짜리 측정을 여기 넣으면 매 테스트 실행이 그만큼 길어진다. 측정 자체는
// `npm run measure:spinner-perf` 가 한다.
//
// 여기서 잠그는 것: 하네스가 **무엇을 재는지**가 조용히 바뀌지 않는다는 것이다. 판정 함수가
// 방향을 잃으면(신이 더 비싼데 PASS) 측정은 계속 돌아가고 숫자도 그럴듯한데 결론만 뒤집힌다.

import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  BUDGET_MS_PER_SEC,
  STABILITY_MS_PER_SEC,
  MODES,
  INSTANCES,
  excessByRep,
  buildPage,
  buildPages,
  buildSpinnerMarkup,
  deutility,
  diffMetrics,
  formatTable,
  parseLegacyFixture,
  summarize,
  verdict
} from './measure-spinner-perf.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../..')
const REFERENCE = readFileSync(
  join(REPO, 'docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg'),
  'utf8'
)
const LEGACY = readFileSync(join(HERE, 'fixtures/spinner-legacy-0208.html'), 'utf8')

const metrics = (o) => ({ metrics: Object.entries(o).map(([name, value]) => ({ name, value })) })

test('deutility 가 @utility 를 클래스 규칙으로 바꾼다', () => {
  assert.equal(
    deutility('@utility animate-spark-a {\n  opacity: 0;\n}'),
    '.animate-spark-a {\n  opacity: 0;\n}'
  )
  // 선언 본문은 건드리지 않는다 — 값이 바뀌면 두 조건이 다른 CSS 를 재게 된다.
  assert.ok(deutility('@utility x {\n  animation: spark-a 4800ms;\n}').includes('4800ms'))
})

test('동결 fixture 에서 구 CSS 와 마크업을 꺼낸다', () => {
  const { css, svg } = parseLegacyFixture(LEGACY)
  assert.ok(css.includes('@keyframes spark-scale'), '구 241슬롯 트랙이 있어야 한다')
  assert.ok(css.includes('.animate-spark-spoke {'), '@utility 가 클래스로 바뀌어야 한다')
  assert.ok(svg.startsWith('<svg width="18" height="18"'), '구 스피너는 18×18 이다')
  assert.equal((svg.match(/<text/g) ?? []).length, 5, '구 마크는 글리프 5개를 갖는다')
})

test('구 fixture 가 새 트랙을 갖지 않는다 — 두 조건이 섞이면 비교가 무의미하다', () => {
  const { css, svg } = parseLegacyFixture(LEGACY)
  for (const track of ['spark-a', 'spark-b', 'spark-c', 'spark-d', 'spark-e']) {
    // 술어에 경계를 준다 — 부분 문자열로 재면 `animate-spark-dot` 이 `spark-d` 에 걸려
    // 구 fixture 가 신 트랙을 가진 것처럼 보인다.
    const boundary = new RegExp(`animate-${track}(?![a-z0-9-])`)
    assert.ok(
      !new RegExp(`@keyframes ${track}(?![a-z0-9-])`).test(css),
      `${track} 가 구 fixture 에 있다`
    )
    assert.ok(!boundary.test(svg), `${track} 가 구 마크업에 있다`)
  }
})

test('원본 SVG 에서 신 마크업을 파생한다', () => {
  const svg = buildSpinnerMarkup(REFERENCE)
  assert.ok(svg.startsWith('<svg width="14" height="14" viewBox="0 0 100 100"'))
  assert.ok(svg.includes('fill="currentColor" stroke="currentColor"'), '색은 상속한다')
  assert.equal((svg.match(/animate-spark-[a-e]/g) ?? []).length, 5)
  // 내역 합 = 총계. 하나라도 어긋나면 원본과 다른 그림을 재고 있다.
  assert.equal((svg.match(/<line[ />]/g) ?? []).length, 16)
  assert.equal((svg.match(/<circle[ />]/g) ?? []).length, 3)
  assert.equal((svg.match(/<path[ />]/g) ?? []).length, 13)
  // 원본의 리터럴 색이 새어 나오면 currentColor 상속이 깨진 것이다.
  assert.ok(!svg.includes('#C15F3C'))
})

test('마크 그룹이 5개가 아니면 던진다 — 조용히 빈 페이지를 재지 않는다', () => {
  assert.throws(() => buildSpinnerMarkup('<svg></svg>'), /마크 그룹 5개/)
})

test('세 조건 페이지가 각각 스피너 3개(또는 0개)를 담는다', () => {
  const pages = buildPages({ legacyHtml: LEGACY, referenceSvg: REFERENCE })
  assert.deepEqual(Object.keys(pages).sort(), [...MODES].sort())
  assert.equal((pages.none.match(/<svg/g) ?? []).length, 0, 'none 은 스피너가 없다')
  assert.equal((pages.old.match(/<svg/g) ?? []).length, INSTANCES)
  assert.equal((pages.new.match(/<svg/g) ?? []).length, INSTANCES)
  // rAF 카운터가 빠지면 측정 유효성 전제를 잴 수 없다.
  for (const html of Object.values(pages)) assert.ok(html.includes('window.__frames'))
})

test('페이지가 서로의 CSS 를 갖지 않는다', () => {
  const pages = buildPages({ legacyHtml: LEGACY, referenceSvg: REFERENCE })
  assert.ok(!pages.old.includes('@keyframes spark-a '), '구 페이지에 신 트랙이 있다')
  assert.ok(!pages.new.includes('@keyframes spark-scale'), '신 페이지에 구 트랙이 있다')
})

test('차분이 누적값의 증분이고 시간은 ms 다', () => {
  const m0 = metrics({
    RecalcStyleCount: 10,
    RecalcStyleDuration: 0.1,
    LayoutCount: 2,
    LayoutDuration: 0.02,
    TaskDuration: 0.5
  })
  const m1 = metrics({
    RecalcStyleCount: 310,
    RecalcStyleDuration: 0.19,
    LayoutCount: 146,
    LayoutDuration: 0.031,
    TaskDuration: 0.8
  })
  const d = diffMetrics(m0, m1, 300)
  assert.equal(d.recalcCount, 300)
  assert.equal(+d.recalcMs.toFixed(1), 90)
  assert.equal(d.layoutCount, 144)
  assert.equal(+d.taskMs.toFixed(0), 300)
  assert.equal(d.fps, 60)
  assert.equal(d.valid, true)
})

test('rAF 가 멈춘 창은 무효 행이다 — 0 을 "비용 없음" 으로 읽지 않는다', () => {
  const zero = metrics({ RecalcStyleCount: 0, TaskDuration: 0 })
  const d = diffMetrics(zero, zero, 0)
  assert.equal(d.fps, 0)
  assert.equal(d.valid, false)
})

const rowsOf = (perMode) =>
  MODES.flatMap((mode) =>
    [0, 1, 2].map((rep) => ({ mode, rep, frames: 300, fps: 60, valid: true, ...perMode[mode] }))
  )

const BASE = { recalcCount: 0, recalcMs: 0, layoutCount: 0, layoutMs: 0 }

/** verdict 는 요약과 원본 행을 함께 본다 — 평균만으로는 rep 산포가 보이지 않는다. */
const judge = (rows) => verdict(summarize(rows), rows)

test('요약이 none 기준선 대비 순증가를 ms/s 로 낸다', () => {
  const s = summarize(
    rowsOf({
      none: { ...BASE, taskMs: 90 },
      old: { ...BASE, taskMs: 240 },
      new: { ...BASE, taskMs: 300 }
    })
  )
  assert.equal(s.find((r) => r.mode === 'none').netMsPerSec, 0)
  assert.equal(s.find((r) => r.mode === 'old').netMsPerSec, 30)
  assert.equal(s.find((r) => r.mode === 'new').netMsPerSec, 42)
  assert.equal(s.find((r) => r.mode === 'new').reps, 3)
})

test('판정이 예산을 본다 — 초과하면 FAIL, 이내면 PASS', () => {
  // 예산 축이 방향을 잃으면(초과인데 PASS) 측정은 계속 돌고 숫자도 그럴듯한데 결론만 뒤집힌다.
  const over = judge(
    rowsOf({
      none: { ...BASE, taskMs: 90 },
      old: { ...BASE, taskMs: 240 },
      // 구 30 ms/s · 신 42 ms/s → 초과분 12 > 예산 5
      new: { ...BASE, taskMs: 300 }
    })
  )
  assert.equal(over.pass, false)
  assert.equal(over.excess, 12)
  assert.ok(over.reasons.some((r) => r.includes('예산')))

  const within = judge(
    rowsOf({
      none: { ...BASE, taskMs: 90 },
      old: { ...BASE, taskMs: 240 },
      // 구 30 ms/s · 신 33 ms/s → 초과분 3 ≤ 예산 5 (30Hz 실측이 이 자리다)
      new: { ...BASE, taskMs: 255 }
    })
  )
  assert.equal(within.pass, true)
  assert.equal(within.excess, 3)
  assert.deepEqual(within.reasons, [])
})

test('예산 경계에서 갈린다 — 같으면 통과, 0.1 넘으면 실패', () => {
  const at = (newTaskMs) =>
    judge(
      rowsOf({
        none: { ...BASE, taskMs: 90 },
        old: { ...BASE, taskMs: 240 },
        new: { ...BASE, taskMs: newTaskMs }
      })
    )
  // 구 순증가 30 ms/s. 예산 5.0 → 신 35.0 까지 통과.
  assert.equal(BUDGET_MS_PER_SEC, 5)
  assert.equal(at(265).excess, 5)
  assert.equal(at(265).pass, true)
  assert.equal(at(265.5).excess, 5.1)
  assert.equal(at(265.5).pass, false)
})

test('신이 구보다 싸도 통과한다 — 예산은 상한이지 하한이 아니다', () => {
  const better = judge(
    rowsOf({
      none: { ...BASE, taskMs: 90 },
      old: { ...BASE, taskMs: 300 },
      new: { ...BASE, taskMs: 240 }
    })
  )
  assert.equal(better.pass, true)
  assert.equal(better.excess, -12)
})

test('layout 이 늘어도 예산 안이면 통과한다 — rev.4 에서 layout 단독 축을 뺐다', () => {
  // 구 구현은 꺼진 마크를 visibility 로 빼내 layout 이 0 이다. `신 ≤ 구` 를 layout 에 걸면
  // 구조상 영원히 통과할 수 없으므로 예산 한 축으로 합쳤다(D-211).
  const v = judge(
    rowsOf({
      none: { ...BASE, taskMs: 90 },
      old: { ...BASE, taskMs: 240 },
      new: { ...BASE, layoutCount: 66, layoutMs: 5.3, taskMs: 255 }
    })
  )
  assert.equal(v.pass, true)
  assert.deepEqual(v.reasons, [])
})

test('rep 사이 초과분을 rep 안에서만 뺀다 — 기준선 드리프트에 흔들리지 않는다', () => {
  // none 은 두 항에서 상쇄된다. rep 마다 기준선이 달라도 같은 rep 의 구/신 차이는 공정하다.
  const rows = [
    { mode: 'none', rep: 0, taskMs: 90, valid: true },
    { mode: 'old', rep: 0, taskMs: 240, valid: true },
    { mode: 'new', rep: 0, taskMs: 255, valid: true },
    { mode: 'none', rep: 1, taskMs: 180, valid: true },
    { mode: 'old', rep: 1, taskMs: 480, valid: true },
    { mode: 'new', rep: 1, taskMs: 495, valid: true }
  ]
  // 두 rep 의 기준선이 2배 차이인데 초과분은 둘 다 3.0 이다.
  assert.deepEqual(excessByRep(rows), [3, 3])
})

test('rep 산포가 크면 평균이 좋아도 판정하지 않는다', () => {
  // 실측 사례 — 기계가 바빠 세 조건이 60fps 를 지키면서 rep2 에서 구/신 순서가 뒤집혔다.
  // 평균만 보면 이 실행도 숫자를 하나 내놓는다.
  const observed = [
    { none: 144.1, old: 362.1, new: 608.0 },
    { none: 143.3, old: 510.6, new: 665.7 },
    { none: 261.3, old: 595.9, new: 567.8 }
  ]
  const rows = observed.flatMap((r, rep) =>
    MODES.map((mode) => ({ mode, rep, fps: 60, valid: true, ...BASE, taskMs: r[mode] }))
  )
  const v = judge(rows)
  assert.deepEqual(v.perRep, [49.2, 31, -5.6])
  assert.equal(v.spread, 54.8)
  assert.equal(v.pass, false)
  assert.ok(v.reasons.some((r) => r.includes('rep 산포')))
})

test('조용한 실행의 산포는 임계 안이다 — 가드가 정상 실행을 막지 않는다', () => {
  // 관측된 조용한 실행 4회의 산포는 2.5·3.5·4.3·5.8 이었다. 임계 12 는 그 위다.
  assert.equal(STABILITY_MS_PER_SEC, 12)
  const rows = [
    { none: 90, old: 240, new: 250.5 },
    { none: 92, old: 245, new: 262 },
    { none: 91, old: 242, new: 253 }
  ].flatMap((r, rep) =>
    MODES.map((mode) => ({ mode, rep, fps: 60, valid: true, ...BASE, taskMs: r[mode] }))
  )
  const v = judge(rows)
  assert.ok(v.spread <= STABILITY_MS_PER_SEC, `산포 ${v.spread}`)
  assert.equal(v.pass, true)
})

test('무효 행이 있으면 수치가 좋아도 판정하지 않는다', () => {
  const rows = rowsOf({
    none: { ...BASE, taskMs: 90 },
    old: { ...BASE, taskMs: 300 },
    new: { ...BASE, taskMs: 240 }
  })
  rows[4].valid = false
  const v = judge(rows)
  assert.equal(v.pass, false)
  assert.ok(v.reasons.some((r) => r.includes('무효 행')))
})

test('fps 가 60 에 못 미치면 FAIL 이다', () => {
  const rows = rowsOf({
    none: { ...BASE, taskMs: 90 },
    old: { ...BASE, taskMs: 300 },
    new: { ...BASE, taskMs: 240 }
  })
  for (const r of rows) if (r.mode === 'new') r.fps = 52
  const v = judge(rows)
  assert.equal(v.pass, false)
  assert.ok(v.reasons.some((r) => r.includes('fps')))
})

test('표에 세 모드가 모두 나온다', () => {
  const table = formatTable(
    summarize(
      rowsOf({
        none: { ...BASE, taskMs: 90 },
        old: { ...BASE, taskMs: 240 },
        new: { ...BASE, taskMs: 300 }
      })
    )
  )
  for (const mode of MODES) assert.ok(table.includes(`| ${mode} |`))
})

test('buildPage 가 인스턴스 수를 그대로 반영한다', () => {
  assert.equal(
    (buildPage({ css: '', svg: '<svg></svg>', count: 7, color: '#000' }).match(/<svg/g) ?? [])
      .length,
    7
  )
})
