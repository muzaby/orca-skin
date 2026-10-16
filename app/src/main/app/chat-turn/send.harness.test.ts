import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleChatSend } from './send'
import { resolveTurn } from './resolve-turn'
import { normalizeAttachments } from '../../features/chat/attachments'
import { sendChatEvent } from '../../infra/ipc/send'
import { SessionChainLeaseRegistry } from '../../features/sessions/session-chain-lease'
import type { Backend } from '../../../shared/ipc'

vi.mock('../../features/chat/attachments', () => ({
  normalizeAttachments: vi.fn(async () => ({ attachmentTexts: [], attachmentImages: [] }))
}))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('./resolve-turn', () => ({
  resolveTurn: vi.fn(async () => ({
    ok: false,
    error: { category: 'stream_error', message: 'test stop after admission', retryable: false }
  })),
  resolveTurnProvider: vi.fn()
}))
afterEach(() => vi.clearAllMocks())

function fixture(stored?: Backend): {
  deps: Parameters<typeof handleChatSend>[0]
  event: Parameters<typeof handleChatSend>[1]
  adapters: Record<Backend, { id: Backend }>
  acquire: ReturnType<typeof vi.fn>
  db: { getSessionById: ReturnType<typeof vi.fn> }
} {
  const sender = new EventEmitter()
  const adapters = { claude: { id: 'claude' as const }, opencode: { id: 'opencode' as const } }
  const leases = new SessionChainLeaseRegistry()
  const acquire = vi.fn((input) => leases.acquire(input))
  const db = {
    getSessionById: vi.fn(() => (stored ? { backend: stored, agent_kind: 'code' } : undefined))
  }
  return {
    adapters,
    acquire,
    db,
    deps: {
      ctx: {
        debugMock: { enabled: false },
        registry: { getActive: () => adapters.claude, get: (id: Backend) => adapters[id] },
        db
      },
      supervisor: {
        getChainByKey: (key: string) => leases.getByKey(key),
        acquireChain: acquire,
        releaseChain: (id: string) => leases.release(id)
      },
      pendingMessages: { cancelAllHeld: () => [] },
      isUpdateInstallPending: () => false
    } as unknown as Parameters<typeof handleChatSend>[0],
    event: { sender } as unknown as Parameters<typeof handleChatSend>[1]
  }
}
const payload = {
  text: 'hello',
  sessionId: null,
  projectId: null,
  clientRequestId: 'draft',
  agentKind: 'code'
}
describe('send admission uses immutable harness identity', () => {
  it.each([null, 's'])('routes OpenCode independently of global Claude (%s)', async (sessionId) => {
    const f = fixture(sessionId ? 'opencode' : undefined)
    await handleChatSend(f.deps, f.event, {
      ...payload,
      sessionId,
      ...(sessionId ? {} : { backend: 'opencode' }),
      providerKey: 'opencode-local'
    })
    expect(resolveTurn).toHaveBeenCalledWith(
      f.deps.ctx,
      f.deps.supervisor,
      f.adapters.opencode,
      expect.objectContaining({ agentKind: 'code' }),
      JSON.stringify({ attachmentTexts: [], attachmentImages: [] })
    )
    expect(f.acquire).toHaveBeenCalledWith(expect.objectContaining({ backend: 'opencode' }))
  })
  it.each([{ backend: 'claude' }, { providerKey: 'claude-local' }, { agentKind: 'work' }])(
    'rejects cross-harness and Work requests: %j',
    async (patch) => {
      const f = fixture('opencode')
      await handleChatSend(f.deps, f.event, { ...payload, sessionId: 's', ...patch })
      expect(resolveTurn).not.toHaveBeenCalled()
      expect(f.acquire).not.toHaveBeenCalled()
      expect(sendChatEvent).toHaveBeenCalledWith(
        f.event.sender,
        expect.objectContaining({ type: 'error' })
      )
    }
  )
  it('rechecks backend after attachment normalization yields', async () => {
    const f = fixture('opencode')
    vi.mocked(normalizeAttachments).mockImplementationOnce(async () => {
      f.db.getSessionById.mockReturnValue({ backend: 'claude', agent_kind: 'code' })
      return { attachmentTexts: [], attachmentImages: [] }
    })
    await handleChatSend(f.deps, f.event, { ...payload, sessionId: 's' })
    expect(f.acquire).not.toHaveBeenCalled()
    expect(resolveTurn).not.toHaveBeenCalled()
  })
})
