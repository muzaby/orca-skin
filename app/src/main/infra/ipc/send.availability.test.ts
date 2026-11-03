import { expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ sendA: vi.fn(), sendB: vi.fn(), destroyed: vi.fn() }))
vi.mock('electron', () => ({
  webContents: {
    getAllWebContents: () => [
      { isDestroyed: () => false, send: fixture.sendA },
      { isDestroyed: () => true, send: fixture.destroyed },
      { isDestroyed: () => false, send: fixture.sendB }
    ]
  }
}))
import { broadcastHarnessAvailability } from './send'
it('broadcasts the availability payload on its channel to every living renderer', () => {
  const state = {
    id: 'opencode' as const,
    installed: true,
    version: '2.0.0',
    usable: false,
    unavailableReason: 'unsupported' as const
  }
  broadcastHarnessAvailability(state)
  for (const send of [fixture.sendA, fixture.sendB])
    expect(send).toHaveBeenCalledExactlyOnceWith('orca:harness:availability', state)
  expect(fixture.destroyed).not.toHaveBeenCalled()
})
