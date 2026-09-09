import { describe, expect, it, vi } from 'vitest'
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
import { createApprovalRequester } from './approval'
describe('r4 Main plan approval target', () => {
  it.each(['work', 'coding'] as const)(
    '%s keeps plan request and settles expected mode',
    async (agentKind) => {
      const setMode = vi.fn()
      const register = vi.fn().mockResolvedValue({ behavior: 'allow' })
      const turn = { agentKind, dbSessionId: 's', controller: new AbortController() }
      const request = createApprovalRequester({
        wc: {},
        approvals: { register },
        permissionModes: { setMode },
        persistence: {},
        beginApprovalPause: () => undefined,
        getActiveTurn: () => turn
      } as never)
      expect(
        await request({ kind: 'plan_review', request: { requestId: '', plan: '# Original' } })
      ).toEqual({ behavior: 'allow' })
      expect(register).toHaveBeenCalledWith(expect.any(String), turn, expect.any(AbortSignal))
      expect(setMode).toHaveBeenCalledWith('s', agentKind === 'work' ? 'default' : 'accept_edits')
    }
  )
})
