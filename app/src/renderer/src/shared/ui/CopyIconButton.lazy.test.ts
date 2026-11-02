import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom } from './renderHarness.testfixture'
import { CopyIconButton } from './CopyIconButton'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./renderHarness.testfixture')).fakeHooks
}))
vi.mock('../i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('computes copy text only on click and forwards the exact string to the clipboard', async () => {
  vi.useFakeTimers()
  const text = vi.fn(() => 'first paragraph\n\nsecond paragraph'),
    writeText = vi.fn(async () => {})
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  try {
    dom.render(createElement(CopyIconButton, { text }))
    expect(text).not.toHaveBeenCalled()
    dom.click(dom.query('[aria-label="common.copyMessage"]')!)
    await Promise.resolve()
    expect(text).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledExactlyOnceWith('first paragraph\n\nsecond paragraph')
  } finally {
    dom.unmount()
  }
})
