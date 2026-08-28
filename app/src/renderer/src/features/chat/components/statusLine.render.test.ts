// 0208 — 대기 표시의 스피너를 렌더 출력으로 잠근다.
//
// 두 축이다. (1) 옛 글리프 루프가 남지 않았다 — 다만 `✢`·`✶` 은 새 마크에도 있으므로
// 술어에서 빼고 옛 전용 글리프만 본다. (2) **스트립을 펼치지 않았다** — 원본을 1:1 인라인하면
// <line> 1160 · <text> 115 가 되므로 노드 개수 등호가 곧 성능 계약이다(plan D-003 · AT-04).
//
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 라 `.tsx` 를 잡지 않는다(0204 선례).
// useI18n 은 모듈 임포트 시 동기 초기화라 Provider 없이 렌더된다(shared/i18n/index.ts).

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusLine } from './StatusLine'

const render = (turnStartedAt: number | null): string =>
  renderToStaticMarkup(createElement(StatusLine, { turnStartedAt }))

const count = (html: string, tag: string): number =>
  html.match(new RegExp(`<${tag}[ />]`, 'g'))?.length ?? 0

describe('StatusLine — 스피너 교체 (AT-01)', () => {
  it('턴 진행 중 SVG 스피너 하나가 서고 옛 전용 글리프는 없다', () => {
    const html = render(Date.now())
    expect(count(html, 'svg')).toBe(1)
    for (const glyph of ['✣', '✦', '✧', '★']) {
      expect(html, glyph).not.toContain(glyph)
    }
    // 양성 짝 — 같은 출력에 상태 문구가 함께 있다(음성 술어만으로는 빈 출력도 통과한다).
    expect(html).toMatch(/aria-label="[^"]+"/)
  })

  it('턴이 없으면 아무것도 그리지 않는다', () => {
    expect(render(null)).toBe('')
    expect(render(Date.now())).not.toBe('')
  })
})

describe('StatusLine — 스트립을 펼치지 않는다 (AT-04)', () => {
  it('마크 7개 규모로 고정된다', () => {
    const html = render(Date.now())
    expect(count(html, 'line')).toBe(10)
    expect(count(html, 'text')).toBe(5)
    expect(count(html, 'circle')).toBe(1)
  })

  it('애니메이션 트랙 클래스가 실제로 붙어 있다', () => {
    const html = render(Date.now())
    // 클래스를 지우면 스피너가 정지한다 — 존재만 보는 단언은 그것을 통과시킨다.
    expect(html).toContain('animate-spark-pulse')
    expect(html).toContain('animate-spark-spoke')
  })
})

describe('StatusLine — 테마 (AT-09)', () => {
  it('스피너 색이 상속되고 raw hex 가 없다', () => {
    const html = render(Date.now())
    expect(html).toContain('text-rust')
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
