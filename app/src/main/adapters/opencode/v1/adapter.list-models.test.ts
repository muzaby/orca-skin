import { describe, expect, it, vi } from 'vitest'
import type { OpenCodeServer } from '../implementation'
import { OpenCodeAdapter } from './adapter'

describe('OpenCodeAdapter.listProviderModels (0291 EP-08 ⑦)', () => {
  it('listProviderModels delegates to the server pool', async () => {
    const models = [{ id: 'corp/a', name: 'A' }]
    const listModels = vi.fn(async () => models)
    const servers = {
      acquire: vi.fn(),
      installed: vi.fn(),
      close: vi.fn(),
      listModels
    } as unknown as OpenCodeServer
    const adapter = new OpenCodeAdapter(servers, vi.fn<typeof fetch>())
    const signal = new AbortController().signal
    expect(await adapter.listProviderModels('corp', { signal, env: { A: '1' } })).toBe(models)
    expect(listModels).toHaveBeenCalledExactlyOnceWith('corp', { signal, env: { A: '1' } })
    expect(servers.acquire).not.toHaveBeenCalled()
  })
})
