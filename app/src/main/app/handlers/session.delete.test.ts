import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { RouterContext } from '../context'

const handlers = vi.hoisted(
  () => new Map<string, (request: { sessionId: string }) => Promise<unknown>>()
)
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _options: unknown,
    run: (req: { sessionId: string }) => Promise<unknown>
  ) => handlers.set(channel, run),
  handlePlain: vi.fn()
}))
import { registerSessionHandlers } from './session'

describe('session removal preserves native storage', () => {
  it('disposes execution then hides the session and clears the selected ID without removing resources', async () => {
    const order: string[] = []
    const db = { hideSession: vi.fn(() => order.push('hide')), deleteSession: vi.fn() }
    const patch = vi.fn()
    const getCwd = vi.fn()
    registerSessionHandlers(
      {
        db,
        getCwd,
        settings: { getAll: () => ({ lastSessionId: 's' }), patch }
      } as unknown as RouterContext,
      {
        onSessionDisposed: (id) => {
          expect(id).toBe('s')
          order.push('dispose')
        }
      }
    )
    await expect(handlers.get(CHANNELS.sessionDelete)!({ sessionId: 's' })).resolves.toEqual({
      ok: true
    })
    expect(order).toEqual(['dispose', 'hide'])
    expect(db.hideSession).toHaveBeenCalledWith('s')
    expect(db.deleteSession).not.toHaveBeenCalled()
    expect(getCwd).not.toHaveBeenCalled()
    expect(patch).toHaveBeenCalledWith({ lastSessionId: null })
  })

  it('does not alter a different selected session and does not hide if disposal fails', async () => {
    const hideSession = vi.fn()
    const patch = vi.fn()
    const ctx = {
      db: { hideSession },
      settings: { getAll: () => ({ lastSessionId: 'other' }), patch }
    } as unknown as RouterContext
    registerSessionHandlers(ctx)
    await handlers.get(CHANNELS.sessionDelete)!({ sessionId: 's' })
    expect(hideSession).toHaveBeenCalledWith('s')
    expect(patch).not.toHaveBeenCalled()
    hideSession.mockClear()
    registerSessionHandlers(ctx, {
      onSessionDisposed: () => {
        throw new Error('dispose failure')
      }
    })
    await expect(handlers.get(CHANNELS.sessionDelete)!({ sessionId: 's' })).rejects.toThrow(
      'dispose failure'
    )
    expect(hideSession).not.toHaveBeenCalled()
  })
})
