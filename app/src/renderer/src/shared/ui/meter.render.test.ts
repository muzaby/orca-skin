// 0208 ΔV1 — `Meter` 는 도메인 문구를 모른다. r1 이 안내용으로 더했던 `title` prop 은
// 안내가 전역 설명으로 옮겨가면서 소비자가 0 이 됐고(D-019), dead API 라 함께 제거했다.
// 여기 남는 것은 Meter 고유 계약이다 — 트랙이 있고 ratio 가 0..1 로 clamp 된다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Meter } from './Meter'

const render = (props: Parameters<typeof Meter>[0]): string =>
  renderToStaticMarkup(createElement(Meter, props))

const width = (html: string): string => /width:\s*([\d.]+%)/.exec(html)?.[1] ?? ''

describe('Meter — 트랙과 채움', () => {
  it('트랙 위에 ratio 만큼 채운 바를 그린다', () => {
    const html = render({ ratio: 0.5 })
    expect(html).toContain('rounded-full bg-border')
    expect(width(html)).toBe('50%')
  })

  it('범위 밖 ratio 를 0..1 로 clamp 한다', () => {
    expect(width(render({ ratio: -3 }))).toBe('0%')
    expect(width(render({ ratio: 7 }))).toBe('100%')
  })

  it('shared 원자라 도메인 문구를 받지 않는다', () => {
    // 어떤 prop 조합으로도 title 속성이 나오지 않는다 — 안내는 호출자 화면의 문제다.
    expect(render({ ratio: 0.5, tone: 'info', className: 'mt-1.5' })).not.toContain('title=')
  })
})
