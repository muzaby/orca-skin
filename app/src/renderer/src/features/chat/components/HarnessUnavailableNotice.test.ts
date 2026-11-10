import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'
vi.mock('../../../shared/i18n', async () => {
  const { ko } = await import('../../../shared/i18n/resources/ko')
  return {
    useI18n: () => ({
      tr: (key: string) =>
        ko.harnessUnavailable[key.split('.')[1] as keyof typeof ko.harnessUnavailable]
    })
  }
})
import { HarnessUnavailableNotice } from './HarnessUnavailableNotice'
const buttons = (node: FakeNode): FakeNode[] => [
  ...(node.tag === 'button' ? [node] : []),
  ...node.children.flatMap(buttons)
]
let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it.each([
  ['unsupported', '지원하지 않는 OpenCode 버전입니다'],
  ['failed', 'OpenCode 설치 상태를 확인하지 못했습니다']
] as const)(
  'shows the %s reason and rechecks that harness once while disabling the pending button',
  async (reason, text) => {
    vi.useFakeTimers()
    dom = installFakeDom({ innerWidth: 1000, innerHeight: 700 })
    const pending = Promise.withResolvers<void>()
    const recheck = vi.fn(() => pending.promise)
    Object.assign(window, { oo: { harness: { recheck } } })
    dom.render(
      createElement(HarnessUnavailableNotice, {
        backend: 'opencode',
        availability: { id: 'opencode', installed: false, usable: false, unavailableReason: reason }
      })
    )
    expect(dom.body.textContent).toContain(text)
    dom.click(buttons(dom.body)[0])
    expect(recheck).toHaveBeenCalledExactlyOnceWith('opencode')
    expect(buttons(dom.body)[0].props.disabled).toBe(true)
    dom.click(buttons(dom.body)[0])
    expect(recheck).toHaveBeenCalledOnce()
    pending.resolve()
    await vi.waitFor(() => {
      dom!.act(() => {})
      expect(buttons(dom!.body)[0].props.disabled).toBe(false)
    })
  }
)
