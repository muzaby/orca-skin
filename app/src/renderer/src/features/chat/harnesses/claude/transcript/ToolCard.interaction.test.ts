// Claude 도구 카드 본문 헤더의 지연 복사 (0325 VP-26 y3 · EP-7 ①).
// 연 카드는 렌더 중 복사 문자열을 만들지 않고, 복사 버튼을 누를 때 한 번 만든다.
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ToolCall } from '../../../reducer/chatReducer'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import * as toolCopy from './toolCopyText'
import { ToolCard } from './ToolCard'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
// 본문 렌더러·셸 동작은 이 oracle 밖이다 — 헤더의 복사 버튼만 본다.
vi.mock('./registry', () => ({
  toolRendererRegistry: { resolve: () => ({ kind: 'generic', Body: () => null }) }
}))
vi.mock('../../common/transcript/ForegroundShellActions', () => ({
  ForegroundShellActions: () => null
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('y3 연 도구 카드 — 렌더 중 `copyText` 0 · 클릭 때 1회 · 문자열은 같은 함수의 결과', async () => {
  vi.useFakeTimers()
  const writeText = vi.fn(async () => {})
  const copy = vi.spyOn(toolCopy, 'copyText')
  const call: ToolCall = {
    toolUseId: 'b1',
    name: 'Bash',
    input: { command: 'ls' },
    result: { output: 'a.txt\nb.txt', isError: false }
  } as ToolCall
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  try {
    const render = (): void =>
      dom.render(
        createElement(ToolCard, { call, transcriptPolicy: agentUiPolicy('code').transcript })
      )
    render()
    dom.click(dom.query('[role="button"]')!)
    render()
    render()
    const button = dom.query('[aria-label="common.copy"]')!
    expect(button).not.toBeNull()
    expect(copy).not.toHaveBeenCalled()
    dom.click(button)
    await Promise.resolve()
    expect(copy).toHaveBeenCalledOnce()
    copy.mockRestore()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(toolCopy.copyText(call))
    expect(writeText).toHaveBeenCalledWith('$ ls\na.txt\nb.txt')
  } finally {
    dom.unmount()
  }
})

it.each([
  ['e1', 'onTransitionEnd'],
  ['e2', 'onTransitionCancel']
] as const)(
  '%s/e7: releases the closed body for its own grid transition (%s) and ignores child/non-grid transitions',
  (_branch, name) => {
    vi.useFakeTimers()
    const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const call: ToolCall = { toolUseId: 'close', name: 'Read', input: { file_path: 'one' } }
    const render = (): void =>
      dom.render(
        createElement(ToolCard, { call, transcriptPolicy: agentUiPolicy('code').transcript })
      )
    const toggle = (): void => {
      dom.click(dom.query('[role="button"]')!)
      render()
    }
    try {
      render()
      toggle()
      expect(dom.query('[aria-label="common.copy"]')).not.toBeNull()
      const closingTime = 1000
      vi.spyOn(performance, 'now').mockReturnValue(closingTime)
      toggle()
      const wrapper = dom.query('[data-tool-body-transition]')!
      const transition = wrapper.props[name] as (event: {
        target: unknown
        currentTarget: unknown
        propertyName: string
        timeStamp: number
      }) => void
      // e7: child target transition ignored
      transition({
        target: {},
        currentTarget: wrapper,
        propertyName: 'grid-template-rows',
        timeStamp: 0
      })
      // e7: non-grid propertyName ignored
      transition({ target: wrapper, currentTarget: wrapper, propertyName: 'opacity', timeStamp: 0 })
      render()
      expect(dom.query('[aria-label="common.copy"]')).not.toBeNull()
      transition({
        target: wrapper,
        currentTarget: wrapper,
        propertyName: 'grid-template-rows',
        timeStamp: closingTime - 1
      })
      render()
      expect(dom.query('[aria-label="common.copy"]')).not.toBeNull()
      // e1/e2: own grid-template-rows unmounts body
      transition({
        target: wrapper,
        currentTarget: wrapper,
        propertyName: 'grid-template-rows',
        timeStamp: 0
      })
      render()
      expect(dom.query('[aria-label="common.copy"]')).toBeNull()
    } finally {
      dom.unmount()
    }
  }
)

it('e3/e4/e5/e6/e8: timeout fallback (e3), reduced motion immediate unmount (e4), reopen cancels close timer (e5), copy text unchanged after unmount (e6), and stale close generation ignored (e8)', async () => {
  vi.useFakeTimers()
  let reduceMotion = false
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  Object.assign(window, { matchMedia: () => ({ matches: reduceMotion }) })
  const call: ToolCall = {
    toolUseId: 'timeout',
    name: 'Read',
    input: { file_path: 'a.ts' },
    result: { output: 'ok', isError: false }
  } as ToolCall
  const writeText = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const render = (): void =>
    dom.render(
      createElement(ToolCard, { call, transcriptPolicy: agentUiPolicy('code').transcript })
    )
  const toggle = (): void => {
    dom.click(dom.query('[role="button"]')!)
    render()
  }
  try {
    render()
    toggle() // open
    dom.click(dom.query('[aria-label="common.copy"]')!)
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledExactlyOnceWith('ok')
    const timer = vi.spyOn(globalThis, 'setTimeout')
    toggle() // close gen 1
    expect(timer.mock.lastCall?.[1]).toBe(300)
    const deadline = timer.mock.results.at(-1)?.value
    const cancel = vi.spyOn(globalThis, 'clearTimeout')
    const staleDeadline = timer.mock.lastCall?.[0]
    expect(typeof staleDeadline).toBe('function')
    vi.advanceTimersByTime(150)
    // e5: reopen before deadline keeps body mounted and cancels gen 1 timer
    toggle()
    expect(cancel).toHaveBeenCalledWith(deadline)
    vi.advanceTimersByTime(200)
    render()
    expect(dom.query('[aria-label="common.copy"]')).not.toBeNull()

    // e8: close gen 2 -> stale gen 1 deadline does not unmount; gen 2 deadline (e3) unmounts
    toggle() // close gen 2
    // Deliver a callback already taken from the host timer queue when clearTimeout ran.
    dom.act(() => {
      if (typeof staleDeadline === 'function') staleDeadline()
    })
    expect(dom.query('[aria-label="common.copy"]')).not.toBeNull()
    vi.advanceTimersByTime(150)
    render()
    expect(dom.query('[aria-label="common.copy"]')).not.toBeNull()
    vi.advanceTimersByTime(150)
    render()
    expect(dom.query('[aria-label="common.copy"]')).toBeNull()

    // e6: remount the body and click its real copy control again.
    toggle()
    dom.click(dom.query('[aria-label="common.copy"]')!)
    await Promise.resolve()
    expect(writeText.mock.calls).toEqual([['ok'], ['ok']])

    // e4: reduced motion unmounts immediately on close
    reduceMotion = true
    toggle()
    expect(dom.query('[aria-label="common.copy"]')).toBeNull()
  } finally {
    dom.unmount()
  }
})
