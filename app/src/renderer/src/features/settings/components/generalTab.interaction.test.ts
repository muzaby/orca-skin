import { createElement } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { SettingsSchema } from '../../../../../shared/protocol'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
const service = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), report: vi.fn() }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../shared/theme', () => ({
  useTweakContext: () => ({
    t: {
      theme: 'white',
      appFont: 'sans',
      uiLocale: 'ko',
      transcriptTextSize: 'medium',
      transcriptWidth: 'medium',
      notifyOnComplete: false
    },
    setTweak: vi.fn()
  })
}))
vi.mock('../../../shared/api/ipc', () => ({ settingsApi: service }))
vi.mock('../../../shared/errors', () => ({ reportError: service.report }))
vi.mock('../../../shared/i18n', async (original) => {
  const actual = await original<typeof import('../../../shared/i18n')>()
  return { ...actual, useI18n: () => ({ tr: actual.i18n.t.bind(actual.i18n), locale: 'ko' }) }
})
import { GeneralTab } from './GeneralTab'
let dom: ReturnType<typeof installFakeDom>
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.useRealTimers()
})
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}
it('saves only the chosen harness field', async () => {
  let saved = SettingsSchema.parse({
    harnesses: {
      claude: { instructions: 'keep', outputStyle: 'Learning' },
      opencode: { instructions: 'other' }
    }
  })
  service.get.mockResolvedValue(saved)
  service.set.mockImplementation(async (patch) => {
    saved = SettingsSchema.parse({
      ...saved,
      harnesses: {
        claude: { ...saved.harnesses?.claude, ...patch.harnesses?.claude },
        opencode: { ...saved.harnesses?.opencode, ...patch.harnesses?.opencode }
      }
    })
    return saved
  })
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
  dom.render(createElement(GeneralTab))
  await settle()
  const select = dom.query('[aria-label="출력 스타일"]')!
  expect(select.props.value).toBe('Learning')
  dom.act(() => (select.props.onChange as (e: unknown) => void)({ target: { value: 'Proactive' } }))
  await settle()
  expect(service.set).toHaveBeenCalledExactlyOnceWith({
    harnesses: { claude: { outputStyle: 'Proactive' } }
  })
  dom.click(dom.query('[aria-label="권한 자동 수락"]')!)
  await settle()
  expect(service.set).toHaveBeenLastCalledWith({
    harnesses: { opencode: { autoApprovePermissions: true } }
  })
  expect(dom.query('[aria-label="권한 자동 수락"]')!.props['aria-checked']).toBe(true)
  expect(dom.query('[aria-label="출력 스타일"]')!.props.value).toBe('Proactive')
  service.set.mockRejectedValueOnce(new Error('disk failure'))
  dom.click(dom.query('[aria-label="권한 자동 수락"]')!)
  await settle()
  expect(dom.query('[aria-label="권한 자동 수락"]')!.props['aria-checked']).toBe(true)
  expect(service.report).toHaveBeenCalledWith(expect.objectContaining({ title: 'saveFailed' }))
})
