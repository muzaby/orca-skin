// 0208 — `sparkFrames.ts` 상수와 `styles/app.css` 의 `spark-*` 트랙은 **손으로 동기화하는 두
// 사본**이다. CSS 쪽은 문자열이라 lint·typecheck 가 어긋남을 보지 못한다 — 이름이 갈라지면
// 그 마크는 애니메이션 없이 항상 보이고(마크 두 개가 겹친다) 게이트는 초록으로 남는다.
// 그래서 app.css 를 원문으로 읽어 대조한다(선례: CwdPanel.landing.test.ts 가 .tsx 를 원문으로 읽는다).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  SPARK_PERIOD_MS,
  SPARK_PULSE_CLASS,
  SPARK_SEGMENT_FRAMES,
  SPARK_SEGMENT_MS,
  SPARK_TRACK_CLASS
} from './sparkFrames'

const css = readFileSync(fileURLToPath(new URL('../../styles/app.css', import.meta.url)), 'utf8')
const constantsSrc = readFileSync(
  fileURLToPath(new URL('./sparkFrames.ts', import.meta.url)),
  'utf8'
)

/** `@utility <name> { … }` 블록 본문. */
function utility(name: string): string {
  const at = css.indexOf(`@utility ${name} {`)
  expect(at, `${name} 유틸리티가 app.css 에 없다`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

/** `@keyframes <name> { … }` 블록의 stop 개수. */
function keyframeStops(name: string): number {
  const at = css.indexOf(`@keyframes ${name} {`)
  expect(at, `${name} 키프레임이 app.css 에 없다`).toBeGreaterThan(-1)
  const block = css.slice(at, css.indexOf('\n}', at))
  return block.match(/^\s+[\d.]+% \{/gm)?.length ?? 0
}

const ALL_TRACKS = [SPARK_PULSE_CLASS, ...Object.values(SPARK_TRACK_CLASS)]

describe('spark CSS — TS 상수와 트랙 타이밍이 같다 (AT-07)', () => {
  it('pulse 트랙이 세그먼트 길이·프레임 수를 그대로 쓴다', () => {
    const block = utility(SPARK_PULSE_CLASS)
    expect(block).toContain(`${SPARK_SEGMENT_MS}ms`)
    // 원본은 steps(1, end) = step-end 로 보간 없이 계단으로 뛴다. 여기서도 같아야 한다.
    expect(block).toContain('step-end')
    // stop 이 세그먼트 프레임 수와 다르면 시퀀스가 원본과 어긋난다 — 개수를 실제로 센다.
    expect(keyframeStops('spark-pulse')).toBe(SPARK_SEGMENT_FRAMES)
  })

  it('dot 트랙이 pulse 와 같은 주기·위상이다', () => {
    const pulse = utility(SPARK_PULSE_CLASS)
    const dot = utility(SPARK_TRACK_CLASS.dot)
    expect(dot).toContain(`${SPARK_SEGMENT_MS}ms`)
    const delay = /(-\d+ms)/.exec(pulse)?.[1]
    expect(delay, 'pulse 에 음수 delay 가 없다').toBeTruthy()
    expect(dot).toContain(delay as string)
  })

  it('마크 구간 트랙 6종이 한 바퀴 주기를 쓴다', () => {
    const perCycle = ALL_TRACKS.filter(
      (c) => c !== SPARK_PULSE_CLASS && c !== SPARK_TRACK_CLASS.dot
    )
    expect(perCycle).toHaveLength(6)
    for (const cls of perCycle) {
      expect(utility(cls), cls).toContain(`${SPARK_PERIOD_MS}ms`)
    }
  })

  it('트랙마다 같은 이름의 @keyframes 가 있다', () => {
    for (const cls of ALL_TRACKS) {
      const keyframe = cls.replace(/^animate-/, '')
      expect(css, cls).toContain(`@keyframes ${keyframe} {`)
      expect(utility(cls), cls).toContain(`animation: ${keyframe} `)
    }
  })
})

describe('spark CSS — 감속 모션이 트랙 전수를 덮는다 (AT-08)', () => {
  it('트랙 8개가 전부 prefers-reduced-motion 블록에 있다 — 차집합 0', () => {
    const at = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
    const reduced = css.slice(at)
    // 총계가 아니라 차집합으로 센다: 빠진 트랙만 계속 도는 것이 이 행의 실패 모드다.
    const missing = ALL_TRACKS.filter((cls) => !reduced.includes(`.${cls}`))
    expect(missing).toEqual([])
    expect(ALL_TRACKS).toHaveLength(8)
  })
})

describe('spark CSS — Tailwind 가 유틸리티를 방출하는 전제 (AT-07 근거)', () => {
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
