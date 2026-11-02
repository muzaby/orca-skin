import { describe, expect, it, vi } from 'vitest'
import { AdapterRegistry } from './registry'
import type { SessionAdapter } from './types'
const setup = (): {
  registry: AdapterRegistry
  probe: ReturnType<typeof vi.fn<SessionAdapter['isInstalled']>>
  executableIdentity: ReturnType<typeof vi.fn<() => string | undefined>>
  identity: (value?: string) => void
} => {
  let identity: string | undefined = 'bin:1'
  const probe = vi
    .fn<SessionAdapter['isInstalled']>()
    .mockResolvedValue({ installed: false, usable: false, reason: 'missing' })
  const executableIdentity = vi.fn(() => identity)
  const registry = new AdapterRegistry(
    [{ id: 'opencode', isInstalled: probe, executableIdentity } as unknown as SessionAdapter],
    null
  )
  return {
    registry,
    probe,
    executableIdentity,
    identity: (value?: string) => {
      identity = value
    }
  }
}
describe('registry availability SSOT', () => {
  it.each([false, true])(
    'keeps Claude usable independently of its CLI installed flag (%s)',
    async (installed) => {
      const registry = new AdapterRegistry(
        [
          {
            id: 'claude',
            isInstalled: async () => ({
              installed,
              version: 'claude-sentinel',
              usable: false,
              reason: 'failed'
            })
          } as unknown as SessionAdapter
        ],
        null
      )
      await registry.refreshInstallState()
      expect(registry.availability('claude')).toEqual({
        id: 'claude',
        installed,
        usable: true,
        ...(installed ? { version: 'claude-sentinel' } : {})
      })
      registry.close()
    }
  )
  it.each(['missing', 'failed', 'unsupported'] as const)(
    'preserves installed/version and the %s reason',
    async (reason) => {
      const f = setup()
      f.probe.mockResolvedValue({
        installed: reason === 'unsupported',
        version: '2.0',
        usable: false,
        reason
      })
      await f.registry.refreshInstallState()
      expect(f.registry.list()).toEqual([
        {
          id: 'opencode',
          installed: reason === 'unsupported',
          usable: false,
          unavailableReason: reason,
          ...(reason === 'unsupported' ? { version: '2.0' } : {})
        }
      ])
    }
  )
  it('joins concurrent refresh/settled consumers, retains previous state and emits only changes', async () => {
    const f = setup(),
      changed = vi.fn()
    await f.registry.refreshInstallState()
    f.registry.onAvailabilityChange(changed)
    const gate = Promise.withResolvers<Awaited<ReturnType<SessionAdapter['isInstalled']>>>()
    f.probe.mockImplementationOnce(() => gate.promise)
    const a = f.registry.refreshInstallState('opencode'),
      b = f.registry.refreshInstallState('opencode')
    const settled = f.registry.settled('opencode')
    expect(f.registry.availability('opencode').unavailableReason).toBe('missing')
    expect(f.probe).toHaveBeenCalledTimes(2)
    gate.resolve({ installed: true, version: '1.18.27', usable: true })
    await Promise.all([a, b])
    expect(await settled).toEqual({
      id: 'opencode',
      installed: true,
      version: '1.18.27',
      usable: true
    })
    expect(changed).toHaveBeenCalledOnce()
    f.probe.mockResolvedValue({ installed: true, version: '1.18.27', usable: true })
    await f.registry.refreshInstallState('opencode')
    expect(changed).toHaveBeenCalledOnce()
  })
  it('focus probes only a changed missing/failed identity, never a ready/unsupported installation', async () => {
    const f = setup()
    await f.registry.refreshInstallState()
    f.registry.focusRecheck()
    expect(f.probe).toHaveBeenCalledOnce()
    f.identity('bin:2')
    f.probe.mockResolvedValue({ installed: true, usable: true, version: '1.18.27' })
    f.registry.focusRecheck()
    await f.registry.settled('opencode')
    expect(f.probe).toHaveBeenCalledTimes(2)
    f.executableIdentity.mockClear()
    f.registry.focusRecheck()
    expect(f.executableIdentity).not.toHaveBeenCalled()
    f.probe.mockResolvedValue({ installed: true, usable: false, reason: 'unsupported' })
    await f.registry.refreshInstallState()
    f.executableIdentity.mockClear()
    f.registry.focusRecheck()
    expect(f.executableIdentity).not.toHaveBeenCalled()
  })
  it('ignores stale identity results and shutdown results', async () => {
    const f = setup(),
      old = Promise.withResolvers<Awaited<ReturnType<SessionAdapter['isInstalled']>>>()
    f.probe.mockImplementationOnce(() => old.promise)
    const pending = f.registry.refreshInstallState()
    f.identity('bin:2')
    f.probe.mockResolvedValue({ installed: true, usable: true, version: '1.19' })
    await f.registry.refreshInstallState()
    old.resolve({ installed: false })
    await pending
    expect(f.registry.availability('opencode').usable).toBe(true)
    f.registry.close()
    await f.registry.refreshInstallState()
    expect(f.probe).toHaveBeenCalledTimes(2)
  })
})
