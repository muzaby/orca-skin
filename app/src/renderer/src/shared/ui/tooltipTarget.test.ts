// 0257 VP-10 — 툴팁 대상 찾기 · title 이동/원복 순수부.
import { describe, expect, it } from 'vitest'
import { TOOLTIP_ATTR, claimTitle, findTooltipAnchor, releaseTitle } from './tooltipTarget'
import { FakeNode } from './tooltipTarget.testlib'

describe('findTooltipAnchor', () => {
  const body = new FakeNode('BODY')
  it('부모로 올라가며 가장 안쪽 title 요소를 고른다', () => {
    const outer = new FakeNode('DIV', body, { title: 'outer' })
    const inner = new FakeNode('BUTTON', outer, { title: 'inner' })
    const icon = new FakeNode('svg', inner)
    expect(findTooltipAnchor(icon)).toBe(inner)
    expect(findTooltipAnchor(new FakeNode('SPAN', outer))).toBe(outer)
  })
  it('이미 옮긴 요소(이동 속성)도 대상이다 — hover 중 재진입', () => {
    const el = new FakeNode('BUTTON', body, { [TOOLTIP_ATTR]: 'x' })
    expect(findTooltipAnchor(new FakeNode('SPAN', el))).toBe(el)
  })
  it('빈 title 은 조상 툴팁을 끈다 · iframe 은 대상이 아니다 · body 에서 멈춘다', () => {
    const outer = new FakeNode('DIV', body, { title: 'outer' })
    expect(findTooltipAnchor(new FakeNode('SPAN', outer, { title: '' }))).toBeNull()
    expect(findTooltipAnchor(new FakeNode('IFRAME', outer, { title: 'frame' }))).toBe(outer)
    expect(findTooltipAnchor(new FakeNode('DIV', body))).toBeNull()
    expect(findTooltipAnchor(null)).toBeNull()
  })
})

describe('claimTitle / releaseTitle', () => {
  it('title 을 옮겨 OS 툴팁을 막고, 떠나면 되돌린다', () => {
    const el = new FakeNode('BUTTON', null, { title: '복사' })
    expect(claimTitle(el)).toBe('복사')
    expect(el.hasAttribute('title')).toBe(false)
    expect(el.getAttribute(TOOLTIP_ATTR)).toBe('복사')
    expect(claimTitle(el)).toBe('복사')
    releaseTitle(el)
    expect(el.getAttribute('title')).toBe('복사')
    expect(el.hasAttribute(TOOLTIP_ATTR)).toBe(false)
  })
  it('그 사이 컴포넌트가 단 새 title 은 덮지 않는다', () => {
    const el = new FakeNode('BUTTON', null, { title: 'old' })
    claimTitle(el)
    el.setAttribute('title', 'new')
    releaseTitle(el)
    expect(el.getAttribute('title')).toBe('new')
    expect(el.hasAttribute(TOOLTIP_ATTR)).toBe(false)
  })
})
