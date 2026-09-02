// 0211 ΔV3 AT-40 / §10 EP-26 — depth 전환의 **정의**를 CSS 원문에서 읽는다.
//
// vitest 가 `environment: 'node'` 라 실제 애니메이션은 볼 수 없다. 볼 수 있는 것은 셋이다:
// 두 연출이 **서로 다른가**(방향) · `prefers-reduced-motion` 에서 **꺼지는가** · 시간축이
// 저장소의 기존 마운트 연출과 **같은가**. 부드러움 자체는 §19 사람 실기다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const RENDERER_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const css = readFileSync(join(RENDERER_SRC, 'styles/app.css'), 'utf8')

/** `@utility <name> { … }` 블록 본문 — `sparkCss.test.ts` 와 같은 방식이다. */
function utility(name: string): string {
  const at = css.indexOf(`@utility ${name} {`)
  expect(at, `${name} 유틸리티가 app.css 에 없다`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

function keyframeBlock(name: string): string {
  const at = css.indexOf(`@keyframes ${name} {`)
  expect(at, `${name} 키프레임이 app.css 에 없다`).toBeGreaterThan(-1)
  return css.slice(at, css.indexOf('\n}', at))
}

describe('depth 전환 연출 (AT-40 · EP-26)', () => {
  it('두 방향이 **서로 다른** 시작 변위를 갖는다', () => {
    const forward = keyframeBlock('depth-in')
    const back = keyframeBlock('depth-out')

    expect(forward).toContain('translateX(8px)')
    expect(back).toContain('translateX(-8px)')
    // 방향이 계약이다 — 같은 값이면 뒤로 가는 것이 앞으로 가는 것처럼 보인다.
    expect(forward).not.toEqual(back)
  })

  it('시간축·이징이 기존 마운트 연출과 같다 — 새 상수를 발명하지 않았다', () => {
    const tile = utility('animate-tile-in')
    const duration = /(\d+)ms/.exec(tile)?.[1]
    expect(duration).toBeDefined()

    for (const name of ['animate-depth-in', 'animate-depth-out']) {
      expect(utility(name)).toContain(`${duration}ms`)
      expect(utility(name)).toContain('ease-out')
    }
  })

  it('prefers-reduced-motion 에서 두 연출이 모두 꺼진다', () => {
    // 가드 블록 전수에서 두 클래스를 찾는다 — 하나만 걸린 구현이 red 다.
    const guards = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
      .map((m) => m[1])
      .filter((body) => body.includes('animation: none'))
    const guarded = guards.join('\n')

    expect(guarded).toContain('.animate-depth-in')
    expect(guarded).toContain('.animate-depth-out')
  })
})
