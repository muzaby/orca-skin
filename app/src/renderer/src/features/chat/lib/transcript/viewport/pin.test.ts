import { describe, expect, it } from 'vitest'
import { CLAUDE_PIN_POLICY, OPENCODE_PIN_POLICY, pinPolicy } from './pin'

describe('viewport/pin (EP-11 · p1, p2, p6, p9)', () => {
  const claude = pinPolicy(CLAUDE_PIN_POLICY)
  const opencode = pinPolicy(OPENCODE_PIN_POLICY)

  it('p1: pins within 24px of bottom and unpins when scrolled up', () => {
    expect(claude.onScroll({ scrollTop: 976, clientHeight: 500, scrollHeight: 1500 }).pinned).toBe(
      true
    )
    expect(
      claude.onScroll({ scrollTop: 975.9, clientHeight: 500, scrollHeight: 1500 }).pinned
    ).toBe(false)
    expect(claude.onScroll({ scrollTop: 980, clientHeight: 500, scrollHeight: 1500 }).pinned).toBe(
      true
    )
    expect(claude.onScroll({ scrollTop: 950, clientHeight: 500, scrollHeight: 1500 }).pinned).toBe(
      false
    )
  })

  it('p2/p6: Claude follows growth only when pinned & generating; OpenCode follows any growth when pinned; unpinned never follows', () => {
    expect(claude.shouldFollowGrowth({ pinned: true }, true)).toBe(true)
    expect(claude.shouldFollowGrowth({ pinned: true }, false)).toBe(false)
    expect(claude.shouldFollowGrowth({ pinned: false }, true)).toBe(false)

    expect(opencode.shouldFollowGrowth({ pinned: true }, true)).toBe(true)
    expect(opencode.shouldFollowGrowth({ pinned: true }, false)).toBe(true)
    expect(opencode.shouldFollowGrowth({ pinned: false }, true)).toBe(false)
  })

  it('p9: upward wheel / PageUp / Home / ArrowUp unpins immediately without waiting for scroll event', () => {
    expect(claude.onUserInput({ pinned: true }, { type: 'wheel', deltaY: -10 }).pinned).toBe(false)
    expect(claude.onUserInput({ pinned: true }, { type: 'wheel', deltaY: 10 }).pinned).toBe(true)
    expect(claude.onUserInput({ pinned: false }, { type: 'wheel', deltaY: 10 }).pinned).toBe(false)
    expect(claude.onUserInput({ pinned: true }, { type: 'key', key: 'PageUp' }).pinned).toBe(false)
    expect(claude.onUserInput({ pinned: true }, { type: 'key', key: 'Home' }).pinned).toBe(false)
    expect(claude.onUserInput({ pinned: true }, { type: 'key', key: 'ArrowUp' }).pinned).toBe(false)
    expect(claude.onUserInput({ pinned: true }, { type: 'key', key: 'ArrowDown' }).pinned).toBe(
      true
    )
  })
})
