// 0208 — Meter 의 `title` 은 **호출자 소유**다. shared/ 는 도메인 문구를 모른다.
// 미전달 경로를 함께 잠근다 — 장치가 문구를 지웠을 때 실패해야 방향이 잡힌다(AT-18).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Meter } from './Meter'

const render = (props: Parameters<typeof Meter>[0]): string =>
  renderToStaticMarkup(createElement(Meter, props))

describe('Meter — 툴팁 prop (AT-18)', () => {
  it('title 을 트랙 요소에 건다', () => {
    const html = render({ ratio: 0.5, title: '안내 문구' })
    expect(html).toMatch(/<div class="[^"]*rounded-full bg-border[^"]*" title="안내 문구"/)
  })

  it('title 미전달이면 title 속성이 아예 없다', () => {
    const html = render({ ratio: 0.5 })
    expect(html).not.toContain('title=')
    // 양성 짝 — 같은 출력에 막대는 그대로 있다.
    expect(html).toContain('rounded-full bg-border')
  })
})
