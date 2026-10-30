import { describe, expect, it, vi } from 'vitest'
import { createHostHarnessPort } from './harness-host'
import type { SessionAdapter } from '../adapters/common/types'

function registry(adapters: Partial<Record<string, Partial<SessionAdapter>>>): {
  get: (id: string) => SessionAdapter | null
} {
  return { get: (id: string) => (adapters[id] as SessionAdapter | undefined) ?? null }
}

describe('createHostHarnessPort (0291 AR-02)', () => {
  it('installed uses the adapter install state and missing harnesses are not installed', async () => {
    const isInstalled = vi.fn(async () => ({
      installed: true,
      version: '1.18.27',
      binPath: '/opt/opencode'
    }))
    const host = createHostHarnessPort(registry({ opencode: { isInstalled } }) as never)
    expect(await host.installed('opencode')).toEqual({ installed: true, version: '1.18.27' })
    expect(isInstalled).toHaveBeenCalledOnce()
    expect(await host.installed('claude')).toEqual({ installed: false })
  })

  it('listModels delegates to the adapter and rejects unsupported harnesses', async () => {
    const models = [{ id: 'corp/a' }]
    const listProviderModels = vi.fn(async () => models)
    const host = createHostHarnessPort(
      registry({ opencode: { listProviderModels }, claude: {} }) as never
    )
    const signal = new AbortController().signal
    expect(await host.listModels('opencode', 'corp', { signal, env: { A: '1' } })).toBe(models)
    expect(listProviderModels).toHaveBeenCalledExactlyOnceWith('corp', { signal, env: { A: '1' } })
    await expect(host.listModels('claude', 'corp', { signal })).rejects.toThrow(
      'claude 하네스는 모델 목록 조회를 지원하지 않습니다.'
    )
  })
})
