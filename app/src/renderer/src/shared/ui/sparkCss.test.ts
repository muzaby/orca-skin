// 0208 — `styles/app.css` 의 `spark-*` 트랙과 `styles/tokens.css` 의 고정색은 원본 SVG 의
// **사본**이다. CSS 는 문자열이라 lint·typecheck 가 어긋남을 보지 못한다 — 이름이 갈라지면 그
// 마크는 애니메이션 없이 항상 보이고(마크 두 개가 겹친다) 게이트는 초록으로 남는다.
// 그래서 app.css·tokens.css 를 원문으로 읽어 **원본에서 파생한 기대값**과 대조한다.
//
// 여기서 함께 잠그는 것이 성능 계약(D-003 · AT-24 · §10 EP-11)이다. 정확도를 241 슬롯으로
// 올리면서 늘어난 것은 **전역 CSS stop** 뿐이어야 한다 — 인스턴스당 애니메이션 8개, 애니메이션
// 속성은 transform·visibility 뿐, 원본 asset 은 프로덕션 그래프에 0건.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SPARK_PERIOD_MS,
  SPARK_SCALE_CLASS,
  SPARK_SHAPES,
  SPARK_TRACK_CLASS,
  type SparkShape
} from './sparkFrames'
import { parseSpinnerReference, readSpinnerReferenceText } from './sparkReference.testlib'
import { codeOf } from './sourceScan.testlib'

const REF = parseSpinnerReference(readSpinnerReferenceText())

const RENDERER_SRC = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel: string): string => readFileSync(join(RENDERER_SRC, rel), 'utf8')
const css = read('styles/app.css')
const tokensCss = read('styles/tokens.css')
const constantsSrc = read('shared/ui/sparkFrames.ts')

const ALL_TRACKS = [SPARK_SCALE_CLASS, ...Object.values(SPARK_TRACK_CLASS)]

/** `@utility <name> { … }` 블록 본문. */
function utility(name: string): string {
  const at = css.indexOf(`@utility ${name} {`)
  expect(at, `${name} 유틸리티가 app.css 에 없다`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

/** `@keyframes <name>` 의 `[키타임, 값]` 전수 — CSS 원문에서 읽는다. */
function keyframeStops(name: string, property: string): [string, string][] {
  const at = css.indexOf(`@keyframes ${name} {`)
  expect(at, `${name} 키프레임이 app.css 에 없다`).toBeGreaterThan(-1)
  const block = css.slice(at, css.indexOf('\n}', at))
  const re = new RegExp(`([\\d.]+)% \\{\\s*${property}: ([^;]+);`, 'g')
  return [...block.matchAll(re)].map((m) => [m[1], m[2]])
}

/** 원본에서 파생한 scale stop 기대값 — 원본의 key time 문자열을 그대로 쓴다. */
function expectedScaleStops(): [string, string][] {
  return REF.frames.map((f, i) => [REF.keyTimesPct[i], `scale(${f.scale})`])
}

/** 원본에서 파생한 visibility stop 기대값 — 값이 바뀌는 슬롯에만 stop 이 선다. */
function expectedVisibilityStops(shape: SparkShape): [string, string][] {
  const visible = REF.frames.map((f) => f.shape === shape)
  const stops: [string, string][] = [[REF.keyTimesPct[0], visible[0] ? 'visible' : 'hidden']]
  for (let i = 1; i < visible.length; i++) {
    if (visible[i] !== visible[i - 1]) {
      stops.push([REF.keyTimesPct[i], visible[i] ? 'visible' : 'hidden'])
    }
  }
  return stops
}

describe('spark CSS — 원본 241 슬롯이 CSS 트랙에 그대로 있다 (AT-22 · IT-05)', () => {
  it('scale 트랙이 원본의 241 stop 을 같은 키타임·배율로 갖는다', () => {
    const actual = keyframeStops('spark-scale', 'transform')
    expect(actual).toHaveLength(241)
    expect(actual).toEqual(expectedScaleStops())
  })

  it('마크 7종의 visibility 트랙이 원본 구간 경계와 같다', () => {
    for (const shape of SPARK_SHAPES) {
      const name = SPARK_TRACK_CLASS[shape].replace(/^animate-/, '')
      expect(keyframeStops(name, 'visibility'), shape).toEqual(expectedVisibilityStops(shape))
    }
    // 양성 짝 — 마크 7종을 전부 돌았고 구간이 비어 있지 않다.
    expect(SPARK_SHAPES).toHaveLength(7)
    expect(expectedVisibilityStops('spoke').length).toBeGreaterThan(1)
  })

  it('트랙 8개가 전부 원본의 한 바퀴·계단 타이밍을 쓴다', () => {
    expect(SPARK_PERIOD_MS).toBe(REF.periodMs)
    for (const cls of ALL_TRACKS) {
      const block = utility(cls)
      expect(block, cls).toContain(`${REF.periodMs}ms`)
      // 원본의 steps(1, end) 는 CSS 에서 step-end 다 — 보간이 생기면 시퀀스가 달라진다.
      expect(block, cls).toContain('step-end')
      // 24 프레임 주기 반복의 흔적(음수 delay)이 남아 있으면 마지막 슬롯에서 위상이 어긋난다.
      expect(block, cls).not.toMatch(/-\d+ms/)
    }
  })

  it('트랙마다 같은 이름의 @keyframes 가 전역에 하나씩 있다', () => {
    for (const cls of ALL_TRACKS) {
      const keyframe = cls.replace(/^animate-/, '')
      expect(css.split(`@keyframes ${keyframe} {`), cls).toHaveLength(2)
      expect(utility(cls), cls).toContain(`animation: ${keyframe} `)
    }
  })
})

describe('spark CSS — 고정색이 두 테마에서 같다 (AT-22)', () => {
  it('원본 색이 tokens.css 에 정확히 한 번 정의된다', () => {
    const defs = tokensCss.match(/--color-spinner:\s*([^;]+);/g) ?? []
    expect(defs).toHaveLength(1)
    expect(defs[0]).toBe(`--color-spinner: ${REF.color};`)
    // 테마 스코프가 다시 정의하면 light 에서 원본과 다른 색이 된다 — 그것이 r1 의 결함이었다.
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
  it('트랙 8개가 전부 prefers-reduced-motion 블록에 있다 — 차집합 0', () => {
    const at = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
    const reduced = css.slice(at)
    // 총계가 아니라 차집합으로 센다: 빠진 트랙만 계속 도는 것이 이 행의 실패 모드다.
    const missing = ALL_TRACKS.filter((cls) => !reduced.includes(`.${cls}`))
    expect(missing).toEqual([])
    expect(ALL_TRACKS).toHaveLength(8)
    // 원본도 감속 모션에서 멈춘다 — 같은 동작이다.
    expect(REF.reducedMotionStops).toBe(true)
  })
})

describe('spark 성능 — 정확도를 올려도 런타임 비용이 늘지 않는다 (AT-24 · EP-11)', () => {
  it('애니메이션 속성이 transform·visibility 뿐이다', () => {
    // layout 속성(width/height/top/…)이 끼면 매 슬롯 리플로우가 난다. 241 슬롯이면 그 비용이
    // 그대로 241 배다 — 그래서 allowlist 를 총계가 아니라 차집합으로 센다.
    const blocks = [...css.matchAll(/@keyframes (spark-[a-z0-9]+) \{([\s\S]*?)\n\}/g)]
    expect(blocks).toHaveLength(8)
    const offenders = blocks.flatMap(([, name, body]) =>
      [...body.matchAll(/^\s+([a-z-]+):/gm)]
        .map((m) => m[1])
        .filter((prop) => prop !== 'transform' && prop !== 'visibility')
        .map((prop) => `${name}:${prop}`)
    )
    expect(offenders).toEqual([])
  })

  it('241 stop 은 전역 CSS 에만 있고 컴포넌트·상수는 프레임 표를 렌더에 쓰지 않는다', () => {
    const spinner = codeOf(read('shared/ui/SparkSpinner.tsx'))
    // 프레임 진행이 JS 로 올라오면 D-003 이 깨진다 — 컴포넌트는 두 함수를 부르지 않는다.
    expect(spinner).not.toContain('scaleAtFrame')
    expect(spinner).not.toContain('shapeAtFrame')
    expect(spinner).not.toContain('SPARK_FRAME_SCALES')
    expect(spinner).not.toContain('style=')
    // 양성 짝 — 그래도 트랙 클래스는 실제로 소비한다.
    expect(spinner).toContain('SPARK_SCALE_CLASS')
    expect(spinner).toContain('SPARK_TRACK_CLASS')
  })

  it('원본 asset 과 그 파서가 프로덕션 그래프에 0건이다', () => {
    // 원본은 54,552 bytes·~1,767 노드다. 한 곳이라도 import 하면 번들에 통째로 들어간다.
    // 술어는 **코드 줄만** 본다 — 주석의 경로 언급에 반응하는 술어는 실제 import 회귀를
    // 구분하지 못한다(r1 의 리터럴 가드가 같은 자리에서 한 번 틀렸다).
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const e of readdirSync(join(RENDERER_SRC, dir), { withFileTypes: true })) {
        const rel = join(dir, e.name)
        if (e.isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(e.name)) files.push(rel)
      }
    }
    walk('.')
    const production = files.filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.testlib.ts'))
    expect(production.length).toBeGreaterThan(100)
    // 술어는 원본 경로·내용뿐 아니라 **모든 `.testlib`** 를 본다 — 테스트 전용 모듈이 하나라도
    // 프로덕션 그래프에 들어가면 그 모듈이 끌고 오는 것까지 번들에 실린다.
    const leaked = production.filter((f) =>
      /spinner-reference|\.testlib|spark-strip|ten-spoked/.test(codeOf(read(f)))
    )
    expect(leaked).toEqual([])
    // 양성 짝 — 술어가 살아 있다. 같은 술어를 테스트 쪽에 대면 실제로 걸린다.
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
  it('트랙 클래스 8개가 상수 파일에 따옴표 리터럴로 있다', () => {
    const notLiteral = ALL_TRACKS.filter((cls) => !constantsSrc.includes(`'${cls}'`))
    expect(notLiteral).toEqual([])
  })

  it('코드 줄의 animate-spark 등장이 전부 따옴표 리터럴이다', () => {
    // 주석은 뺀다 — 산문의 백틱에 반응하는 술어는 조립 회귀를 보지 못한다.
    const codeLines = constantsSrc
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    const all = codeLines.match(/animate-spark-[a-z0-9]+/g) ?? []
    const quoted = codeLines.match(/'animate-spark-[a-z0-9]+'/g) ?? []
    expect(all).toHaveLength(ALL_TRACKS.length)
    expect(quoted).toHaveLength(all.length)
  })
})
