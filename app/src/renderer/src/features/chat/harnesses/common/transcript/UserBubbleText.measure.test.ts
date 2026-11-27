import { createElement, type ComponentProps, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({
  calls: [] as Array<{ content: unknown; scale: number; bubbleVariant: string }>
}))

vi.mock('../../../lib/bubbleMeasure', () => ({
  useBubbleOverflow: (
    _ref: unknown,
    input: { content: unknown; scale: number; bubbleVariant: string }
  ) => {
    captured.calls.push(input)
    return false
  }
}))

import { UserBubbleText } from './UserBubbleText'

const Bubble = UserBubbleText as ComponentType<
  Omit<ComponentProps<typeof UserBubbleText>, 'children'>
>

describe('UserBubbleText.measure (EP-18 · VP-30)', () => {
  it('passes content, scale, and bubbleVariant (including className & contentClassName) to useBubbleOverflow', () => {
    captured.calls = []
    renderToStaticMarkup(
      createElement(
        Bubble,
        {
          className: 'surface-a',
          contentClassName: 'body-b'
        },
        'hello bubble'
      )
    )
    expect(captured.calls).toHaveLength(1)
    expect(captured.calls[0].content).toBe('hello bubble')
    expect(captured.calls[0].scale).toBeGreaterThan(0)
    expect(captured.calls[0].bubbleVariant).toContain('surface-a')
    expect(captured.calls[0].bubbleVariant).toContain('body-b')
  })

  it('produces distinct bubbleVariant keys when className or contentClassName changes', () => {
    captured.calls = []
    renderToStaticMarkup(createElement(Bubble, { className: 'v1', contentClassName: 'c1' }, 'same'))
    renderToStaticMarkup(createElement(Bubble, { className: 'v2', contentClassName: 'c1' }, 'same'))
    expect(captured.calls[0].bubbleVariant).not.toBe(captured.calls[1].bubbleVariant)
  })

  it('contains no direct ResizeObserver or getComputedStyle calls in UserBubbleText.tsx', () => {
    const src = readFileSync(
      fileURLToPath(new URL('./UserBubbleText.tsx', import.meta.url)),
      'utf8'
    )
    expect(src).not.toMatch(/new ResizeObserver/)
    expect(src).not.toMatch(/getComputedStyle/)
    expect(src).not.toMatch(/scrollIntoView/)
  })
})
