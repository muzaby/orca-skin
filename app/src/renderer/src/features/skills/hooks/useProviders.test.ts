import { createElement, useEffect } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'

const api = vi.hoisted(() => ({
  state: vi.fn(),
  onState: vi.fn(),
  connect: vi.fn(),
  report: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../shared/api/ipc', () => ({
  providerApi: { state: api.state, onState: api.onState, connect: api.connect }
}))
vi.mock('../../../shared/errors', () => ({ reportError: api.report }))

const { useProviders } = await import('./useProviders')

let dom: FakeDom
let current: ReturnType<typeof useProviders>
function Probe(): null {
  const value = useProviders()
  useEffect(() => {
    current = value
  }, [value])
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  api.state.mockResolvedValue({ providers: [], step: null })
  api.onState.mockReturnValue(() => undefined)
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  dom.render(createElement(Probe))
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
})

// 0291 — 연결 버튼은 선택 행 id 로 `providerApi.connect` 를 부르고, 실패는 오류 보고로 남는다.
it('connect sends the provider id and reports a rejected request', async () => {
  api.connect.mockResolvedValueOnce({ state: 'connected', message: null })
  await current.connect('opencode-llm')
  expect(api.connect).toHaveBeenCalledExactlyOnceWith({ providerId: 'opencode-llm' })
  expect(api.report).not.toHaveBeenCalled()
  api.connect.mockRejectedValueOnce(new Error('ipc down'))
  await current.connect('opencode-llm')
  expect(api.report).toHaveBeenCalledWith(
    expect.objectContaining({ event: 'skills.providers.connect-failed' })
  )
})
