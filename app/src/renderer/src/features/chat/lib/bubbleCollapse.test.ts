// 0257 AC9·AC10 · VP-11 — 버블 접기 판정 순수부.
import { describe, expect, it } from 'vitest'
import {
  USER_BUBBLE_COLLAPSED_CLASS,
  USER_BUBBLE_COLLAPSED_LINES,
  bubbleOverflows,
  bubbleView,
  lineHeightPx,
  shouldScrollAfterCollapse
} from './bubbleCollapse'

describe('lineHeightPx', () => {
  it('px · 배수 · normal 을 px 로 바꾼다', () => {
    expect(lineHeightPx('21.75px', '14.5px')).toBe(21.75)
    expect(lineHeightPx('1.5', '14px')).toBe(21)
    expect(lineHeightPx('normal', '10px')).toBe(12)
  })
})

describe('bubbleOverflows — 10줄 경계', () => {
  const lh = 20
  it('정확히 10줄(소수 1px 여유 포함)은 접지 않는다', () => {
    expect(bubbleOverflows({ scrollHeight: lh * 10, lineHeightPx: lh })).toBe(false)
    expect(bubbleOverflows({ scrollHeight: lh * 10 + 1, lineHeightPx: lh })).toBe(false)
  })
  it('10줄을 넘으면 접는다', () => {
    expect(bubbleOverflows({ scrollHeight: lh * 10 + 2, lineHeightPx: lh })).toBe(true)
    expect(bubbleOverflows({ scrollHeight: lh * 11, lineHeightPx: lh })).toBe(true)
  })
  it('접힘 클래스의 줄 수가 판정 상수와 같다', () => {
    expect(USER_BUBBLE_COLLAPSED_CLASS).toContain(`max-h-[${USER_BUBBLE_COLLAPSED_LINES}lh]`)
    expect(USER_BUBBLE_COLLAPSED_CLASS).toContain('mask-image')
  })
})

describe('bubbleView', () => {
  it('넘치지 않으면 버튼이 없다', () => {
    expect(bubbleView({ overflowing: false, expanded: false })).toEqual({
      collapsed: false,
      toggleLabelKey: null
    })
  })
  it('넘치고 접힌 상태 = 접힘 + 더 보기 · 펼친 상태 = 전체 + 간략히 보기', () => {
    expect(bubbleView({ overflowing: true, expanded: false })).toEqual({
      collapsed: true,
      toggleLabelKey: 'chat.transcript.showMore'
    })
    expect(bubbleView({ overflowing: true, expanded: true })).toEqual({
      collapsed: false,
      toggleLabelKey: 'chat.transcript.showLess'
    })
  })
})

describe('shouldScrollAfterCollapse (D-012)', () => {
  it('버블 위쪽이 스크롤 영역 위에 있을 때만 스크롤한다', () => {
    expect(shouldScrollAfterCollapse(-40, 0)).toBe(true)
    expect(shouldScrollAfterCollapse(120, 100)).toBe(false)
    expect(shouldScrollAfterCollapse(100, 100)).toBe(false)
  })
})
