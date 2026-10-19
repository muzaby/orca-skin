import { describe, it, expect, vi } from 'vitest'
import { AdapterRegistry } from './registry'
import type { Backend, SessionAdapter } from './types'
import type { ProviderDescriptor } from '../../../shared/ipc'

function adapter(id: Backend): SessionAdapter {
  return {
    id,
    close: vi.fn(),
    agentSpawnEnv: vi.fn<SessionAdapter['agentSpawnEnv']>(),
    isInstalled: vi.fn<SessionAdapter['isInstalled']>(),
    install: vi.fn<SessionAdapter['install']>(),
    complete: vi.fn<SessionAdapter['complete']>(),
    sendMessage: vi.fn<SessionAdapter['sendMessage']>(),
    classifyError: vi.fn<SessionAdapter['classifyError']>(),
    describe: () => ({ provider: id, cancellation: { sessionAbort: true } }) as ProviderDescriptor
  }
}
const makeRegistry = (): AdapterRegistry => new AdapterRegistry([adapter('claude')], 'claude')

describe('AdapterRegistry capability 서술', () => {
  it('registers an injected OpenCode adapter and closes its owned server pool', () => {
    const close = vi.fn()
    const selected = adapter('opencode')
    selected.close = close
    const reg = new AdapterRegistry([selected], 'opencode')
    expect(reg.get('opencode')).toBe(selected)
    expect(reg.describeAll().opencode.provider).toBe('opencode')
    reg.close()
    expect(close).toHaveBeenCalledOnce()
  })
  it('does not create any implicit adapter or choose an implicit default', () => {
    const reg = new AdapterRegistry([], null)
    expect(reg.list()).toEqual([])
    expect(reg.getActive()).toBeNull()
    expect(() => reg.select('claude')).toThrow('Unknown backend: claude')
  })
  it('describeActive() 는 활성 백엔드(claude)의 서술자를 반환', () => {
    const reg = makeRegistry()
    const desc = reg.describeActive()
    expect(desc).not.toBeNull()
    expect(desc?.provider).toBe('claude')
  })

  it('describeAll() 은 등록된 모든 백엔드의 서술자를 키로 보유', () => {
    const reg = makeRegistry()
    const all = reg.describeAll()
    expect(all['claude'].provider).toBe('claude')
    expect(all['claude'].cancellation.sessionAbort).toBe(true)
  })
})
