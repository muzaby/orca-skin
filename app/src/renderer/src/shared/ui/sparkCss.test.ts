// `styles/app.css` 의 `spark-*` 트랙과 `styles/tokens.css` 의 고정색은 원본 SVG 의 **사본**이다.
// CSS 는 문자열이라 lint·typecheck 가 어긋남을 보지 못한다 — 이름이 갈라지면 그 마크는
// 애니메이션 없이 계속 보이거나(마크 두 개가 겹친다) 아예 안 보이는데 게이트는 초록으로 남는다.
// 그래서 app.css·tokens.css 를 원문으로 읽어 **원본에서 파생한 기대값**과 대조한다.
//
// 여기서 함께 잠그는 것이 성능 계약이다. 아트워크를 바꾸면서 늘어난 것은 정적 SVG 노드뿐이어야
// 한다 — 인스턴스당 애니메이션은 오히려 8 → 5 로 줄고, 애니메이션 속성은 transform·opacity 뿐,
// 원본 asset 은 프로덕션 그래프에 0건이다.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SPARK_MARKS,
  SPARK_PERIOD_MS,
  SPARK_REDUCED_MOTION_MARK,
  SPARK_STEP_HZ,
  SPARK_TRACK_CLASS
} from './sparkTracks'
import {
  normalizeTimingFunction,
  parseSpinnerReference,
  readSpinnerReferenceText
} from './sparkReference.testlib'
import { codeOf, walkSourceFiles } from './sourceScan.testlib'

const REFERENCE_TEXT = readSpinnerReferenceText()
const REF = parseSpinnerReference(REFERENCE_TEXT)

const RENDERER_SRC = fileURLToPath(new URL('../../', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url))
const read = (rel: string): string => readFileSync(join(RENDERER_SRC, rel), 'utf8')
const css = read('styles/app.css')
const tokensCss = read('styles/tokens.css')
const constantsSrc = read('shared/ui/sparkTracks.ts')

const ALL_TRACKS = SPARK_MARKS.map((m) => SPARK_TRACK_CLASS[m])

/** `@utility <name> { … }` 블록 본문. */
function utility(name: string): string {
  const at = css.indexOf(`@utility ${name} {`)
  expect(at, `${name} 유틸리티가 app.css 에 없다`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

/** `@keyframes <name>` 의 `[키타임, transform, opacity]` 전수 — CSS 원문에서 읽는다. */
function keyframeStops(name: string): [string, string, string][] {
  const at = css.indexOf(`@keyframes ${name} {`)
  expect(at, `${name} 키프레임이 app.css 에 없다`).toBeGreaterThan(-1)
  const block = css.slice(at, css.indexOf('\n}', at))
  const re = /([\d.]+)% \{\s*transform: ([^;]+);\s*opacity: ([^;]+);/g
  return [...block.matchAll(re)].map((m) => [m[1], m[2], m[3]])
}

/** `@keyframes <name>` 에서 stop 별 `animation-timing-function` — 없는 stop 은 담지 않는다. */
function keyframeTimings(name: string): Map<string, string> {
  const at = css.indexOf(`@keyframes ${name} {`)
  expect(at, `${name} 키프레임이 app.css 에 없다`).toBeGreaterThan(-1)
  const block = css.slice(at, css.indexOf('\n}', at))
  const re = /([\d.]+)% \{([^}]*)\}/g
  const out = new Map<string, string>()
  for (const [, at2, body] of block.matchAll(re)) {
    const fn = /animation-timing-function:\s*([^;]+);/.exec(body)?.[1]
    if (fn) out.set(at2, fn.trim())
  }
  return out
}

/**
 * 원본에서 파생한 "계단이 필요한 구간" — 값이 **바뀌는** 구간만이다(D-211).
 *
 * 기대 단계 수를 손으로 적지 않는다. 구간 길이를 원본 키타임에서 재고 30Hz 로 나눈다 —
 * 원본이 바뀌면 기대값도 따라 움직여야 하고, 전사한 상수는 그러지 못한다.
 */
function expectedSteps(mark: (typeof REF.marks)[number]): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < mark.stops.length - 1; i++) {
    const from = mark.stops[i]
    const to = mark.stops[i + 1]
    if (from.transform === to.transform && from.opacity === to.opacity) continue
    const spanMs = ((Number(to.at) - Number(from.at)) / 100) * REF.periodMs
    out.set(from.at, Math.max(1, Math.round(spanMs / (1000 / SPARK_STEP_HZ))))
  }
  return out
}

describe('spark 원본 — 바이트 자체가 계약이다', () => {
  it('커밋된 원본이 첨부본과 같은 바이트다', () => {
    const bytes = readFileSync(
      join(REPO_ROOT, 'docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg')
    )
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'f94d5f7b40db6183de9eef999dface8153090cace9e3f802cba029d1cb753d7b'
    )
    expect(bytes.byteLength).toBe(14401)
    // CRLF 로 체크아웃되면 같은 내용이 다른 바이트가 되고 위 해시가 체크아웃 설정에 좌우된다.
    expect(REFERENCE_TEXT).not.toContain('\r')
  })

  it('`.gitattributes` 가 원본 경로의 줄바꿈을 고정한다', () => {
    const attrs = readFileSync(join(REPO_ROOT, '.gitattributes'), 'utf8')
    expect(attrs).toContain(
      'docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg text eol=lf'
    )
  })
})

describe('spark CSS — 원본 kA~kE 가 CSS 트랙에 그대로 있다', () => {
  it('마크 5종의 stop 이 원본의 키타임·배율·불투명도와 같다', () => {
    for (const mark of REF.marks) {
      const name = SPARK_TRACK_CLASS[mark.id].replace(/^animate-/, '')
      expect(keyframeStops(name), mark.id).toEqual(
        mark.stops.map((s) => [s.at, s.transform, s.opacity])
      )
    }
    // 양성 짝 — 마크 5종을 전부 돌았고 구간이 비어 있지 않다.
    expect(REF.marks.map((m) => m.id)).toEqual([...SPARK_MARKS])
    expect(REF.marks.reduce((n, m) => n + m.stops.length, 0)).toBe(41)
  })

  it('트랙 5개가 전부 원본의 한 바퀴·타이밍·공통 선언을 쓴다', () => {
    expect(SPARK_PERIOD_MS).toBe(REF.periodMs)
    for (const cls of ALL_TRACKS) {
      const block = utility(cls)
      expect(block, cls).toContain(`${REF.periodMs}ms`)
      expect(normalizeTimingFunction(block), cls).toContain(REF.timingFunction)
      expect(block, cls).toContain(`transform-box: ${REF.transformBox}`)
      expect(block, cls).toContain(`transform-origin: ${REF.transformOrigin}`)
      expect(block, cls).toContain(`opacity: ${REF.baseOpacity}`)
      // 음수 delay 로 주기를 접으면 마크끼리 위상이 어긋난다.
      expect(block, cls).not.toMatch(/-\d+ms/)
    }
  })

  it('값이 바뀌는 구간 전수에 30Hz 계단이 걸려 있다', () => {
    // D-211 — 여기만 원본의 연속 보간을 이탈한다. 이 단언이 없으면 `steps()` 가 통째로
    // 사라져도 위 stop 비교가 green 이다(transform·opacity 만 읽으므로). r2 실측이 그랬다.
    let total = 0
    for (const mark of REF.marks) {
      const name = SPARK_TRACK_CLASS[mark.id].replace(/^animate-/, '')
      const expectedMap = expectedSteps(mark)
      const actual = keyframeTimings(name)
      const expected = new Map([...expectedMap].map(([at, n]) => [at, `steps(${n}, end)`] as const))
      // 차집합으로 센다 — 빠진 구간과 남는 구간을 함께 본다.
      expect(new Map(actual), `${mark.id} 의 계단 구간`).toEqual(expected)
      total += expectedMap.size
    }
    // 내역 합 = 총계. 원본이 바뀌면 이 수도 함께 움직인다.
    expect(total, '계단이 걸린 구간 전수').toBe(16)
    expect(SPARK_STEP_HZ).toBe(30)
  })

  it('트랙마다 같은 이름의 @keyframes 가 전역에 하나씩 있다', () => {
    for (const cls of ALL_TRACKS) {
      const keyframe = cls.replace(/^animate-/, '')
      expect(css.split(`@keyframes ${keyframe} {`), cls).toHaveLength(2)
      expect(utility(cls), cls).toContain(`animation: ${keyframe} `)
    }
  })
})

describe('spark CSS — 고정색이 두 테마에서 같다', () => {
  it('원본 색이 tokens.css 에 정확히 한 번 정의된다', () => {
    const defs = tokensCss.match(/--color-spinner:\s*([^;]+);/g) ?? []
    expect(defs).toHaveLength(1)
    expect(defs[0]).toBe(`--color-spinner: ${REF.color};`)
    // 테마 스코프가 다시 정의하면 light 에서 원본과 다른 색이 된다.
    const themeScope = tokensCss.slice(tokensCss.indexOf("[data-theme='dark']"))
    expect(themeScope).not.toContain('--color-spinner')
  })

  it('소비자가 rust 가 아니라 전용 토큰을 준다', () => {
    // 코드 줄만 본다 — 주석이 `text-rust` 를 설명으로 언급해도 그건 회귀가 아니다.
    const statusLine = codeOf(read('features/chat/components/StatusLine.tsx'))
    expect(statusLine).toContain('text-spinner')
    expect(statusLine).not.toContain('text-rust')
    // 컴포넌트는 색을 모른다 — raw hex 0건, currentColor 만.
    const spinner = codeOf(read('shared/ui/SparkSpinner.tsx'))
    expect(spinner).not.toMatch(/#[0-9a-fA-F]{6}/)
    expect(spinner).toContain('currentColor')
  })
})

describe('spark CSS — 감속 모션이 트랙 전수를 덮는다', () => {
  it('트랙 5개가 전부 prefers-reduced-motion 블록에 있고 마크 하나만 남는다', () => {
    const at = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
    const reduced = css.slice(at)
    // 총계가 아니라 차집합으로 센다: 빠진 트랙만 계속 도는 것이 이 행의 실패 모드다.
    const missing = ALL_TRACKS.filter((cls) => !reduced.includes(`.${cls}`))
    expect(missing).toEqual([])
    expect(ALL_TRACKS).toHaveLength(5)
    // 원본도 감속 모션에서 멈추고 마크 하나만 남긴다 — 같은 동작·같은 마크다.
    expect(REF.reducedMotionStops).toBe(true)
    expect(SPARK_REDUCED_MOTION_MARK).toBe(REF.reducedMotionMark)
    const survivor = SPARK_TRACK_CLASS[REF.reducedMotionMark]
    expect(reduced).toMatch(new RegExp(`\\.${survivor}\\s*\\{\\s*opacity: 1;`))
  })
})

describe('spark — 241슬롯 인코딩이 저장소에서 사라졌다', () => {
  it('옛 프레임 모델의 심볼이 소스 전수에서 0건이다', () => {
    // 조각으로 조립한다 — 여기 리터럴로 적으면 이 파일 자신이 술어에 걸려, 스윕의 분모에서
    // 자기를 빼는 예외를 만들어야 한다. 그 예외는 이 파일의 실제 회귀도 함께 가린다.
    const dead = [
      `spark-${'scale'}`,
      `spark-${'spoke'}`,
      `SPARK_FRAME${'_SCALES'}`,
      `scaleAt${'Frame'}`,
      `shapeAt${'Frame'}`,
      `ten-${'spoked'}`
    ]
    const files = walkSourceFiles(RENDERER_SRC)
    const offenders = files.flatMap((f) => {
      const code = read(f)
      return dead.filter((sym) => code.includes(sym)).map((sym) => `${f}:${sym}`)
    })
    expect(offenders).toEqual([])
    // 양성 짝 — 술어가 살아 있다면 새 트랙 이름은 실제로 찾힌다.
    expect(files.some((f) => read(f).includes('animate-spark-a'))).toBe(true)
    expect(css).not.toContain(`@keyframes ${dead[0]}`)
  })
})

describe('spark 성능 — 아트워크를 바꿔도 런타임 비용이 늘지 않는다', () => {
  it('애니메이션되는 속성이 transform·opacity 뿐이고 타이밍 선언은 steps() 뿐이다', () => {
    // layout 속성(width/height/top/…)이 끼면 매 프레임 리플로우가 난다. 그래서 allowlist 를
    // 총계가 아니라 차집합으로 센다.
    //
    // `animation-timing-function` 은 예외지만 **구멍이 아니다**: 값이 `steps()` 일 때만
    // 허용한다. cubic-bezier 를 stop 에 적으면 그 구간이 다시 매 프레임 값을 만들어
    // D-211 이 조용히 풀린다 — 속성 이름만 통과시키면 그것을 보지 못한다.
    const blocks = [...css.matchAll(/@keyframes (spark-[a-z0-9]+) \{([\s\S]*?)\n\}/g)]
    expect(blocks).toHaveLength(5)
    const offenders = blocks.flatMap(([, name, bodyText]) =>
      [...bodyText.matchAll(/^\s+([a-z-]+):\s*([^;]+);/gm)]
        .filter(([, prop, value]) => {
          if (prop === 'transform' || prop === 'opacity') return false
          if (prop === 'animation-timing-function') return !/^steps\(\d+, end\)$/.test(value.trim())
          return true
        })
        .map(([, prop]) => `${name}:${prop}`)
    )
    expect(offenders).toEqual([])
  })

  it('전역 stop 이 41개고 컴포넌트는 프레임 표를 렌더에 쓰지 않는다', () => {
    const stops = SPARK_MARKS.reduce(
      (n, m) => n + keyframeStops(SPARK_TRACK_CLASS[m].replace(/^animate-/, '')).length,
      0
    )
    expect(stops).toBe(41)
    const spinner = codeOf(read('shared/ui/SparkSpinner.tsx'))
    // 프레임 진행이 JS 로 올라오면 스트리밍 경로가 스피너 때문에 다시 그려진다.
    expect(spinner).not.toContain('style=')
    expect(spinner).not.toContain('<style')
    expect(spinner).not.toContain('useState')
    expect(spinner).not.toContain('setInterval')
    // 양성 짝 — 그래도 트랙 클래스는 실제로 소비한다.
    expect(spinner).toContain('SPARK_TRACK_CLASS')
  })

  it('원본 asset 과 그 파서가 프로덕션 그래프에 0건이다', () => {
    // 원본은 14,401 bytes 이고 c2pa manifest 를 통째로 들고 있다. 한 곳이라도 import 하면
    // 번들에 그대로 실린다. 술어는 **코드 줄만** 본다 — 주석의 경로 언급에 반응하는 술어는
    // 실제 import 회귀를 구분하지 못한다.
    const files = walkSourceFiles(RENDERER_SRC)
    const production = files.filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.testlib.ts'))
    expect(production.length).toBeGreaterThan(100)
    const leaked = production.filter((f) => /spinner-reference|\.testlib/.test(codeOf(read(f))))
    expect(leaked).toEqual([])
    // 양성 짝 — 같은 술어를 테스트 쪽에 대면 실제로 걸린다.
    const inTests = files
      .filter((f) => f.endsWith('.test.ts') || f.endsWith('.testlib.ts'))
      .filter((f) => /spinner-reference|\.testlib/.test(codeOf(read(f))))
    expect(inTests.length).toBeGreaterThan(0)
  })
})

describe('spark CSS — Tailwind 가 유틸리티를 방출하는 전제', () => {
  // `@utility` 는 클래스 리터럴이 스캔 대상 소스에 있을 때만 방출된다. 이름을 템플릿으로
  // 조립하면 CSS 가 통째로 사라지는데, 그때 렌더 테스트는 클래스 문자열만 보므로 green 이고
  // 스피너만 조용히 멈춘다. 그래서 "리터럴이다" 를 여기서 직접 잠근다.
  it('트랙 클래스 5개가 상수 파일에 따옴표 리터럴로 있다', () => {
    const notLiteral = ALL_TRACKS.filter((cls) => !constantsSrc.includes(`'${cls}'`))
    expect(notLiteral).toEqual([])
  })

  it('코드 줄의 animate-spark 등장이 전부 따옴표 리터럴이다', () => {
    // 주석은 뺀다 — 산문의 백틱에 반응하는 술어는 조립 회귀를 보지 못한다.
    const codeLines = codeOf(constantsSrc)
    const all = codeLines.match(/animate-spark-[a-z0-9]+/g) ?? []
    const quoted = codeLines.match(/'animate-spark-[a-z0-9]+'/g) ?? []
    expect(all).toHaveLength(ALL_TRACKS.length)
    expect(quoted).toHaveLength(all.length)
  })
})
