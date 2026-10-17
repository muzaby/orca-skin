import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleChatSend } from './send'
import { resolveTurn } from './resolve-turn'
import { normalizeAttachments } from '../../features/chat/attachments'
import { sendChatEvent } from '../../infra/ipc/send'
import {
  SessionChainLeaseRegistry,
  clientLeaseKey,
  sessionLeaseKey
} from '../../features/sessions/session-chain-lease'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
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
  leases: SessionChainLeaseRegistry<unknown>
  pendingMessages: PendingMessageQueue
  db: { getSessionById: ReturnType<typeof vi.fn> }
} {
  const sender = new EventEmitter()
  const adapters = { claude: { id: 'claude' as const }, opencode: { id: 'opencode' as const } }
  const leases = new SessionChainLeaseRegistry()
  const acquire = vi.fn((input) => leases.acquire(input))
  const pendingMessages = new PendingMessageQueue()
  const db = {
    getSessionById: vi.fn(() => (stored ? { backend: stored, agent_kind: 'code' } : undefined))
  }
  return {
    adapters,
    acquire,
    leases,
    pendingMessages,
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
      pendingMessages,
      listenRelease: new Map(),
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
  it.each(['claude', 'opencode'] as const)(
    'includes only the saved %s harness instructions in the recovery budget input',
    async (backend) => {
      const f = fixture(backend)
      const instructions = {
        claude: 'Claude 복구에 포함할 지시',
        opencode: 'OpenCode 복구에 포함할 다른 지시'
      }
      Object.assign(f.deps.ctx, {
        settings: {
          getAll: () => ({
            harnesses: {
              claude: { instructions: instructions.claude },
              opencode: { instructions: instructions.opencode }
            }
          })
        }
      })
      const attachments = {
        attachmentTexts: [
          {
            id: 'document',
            name: '첨부 문서',
            mimeType: 'text/plain',
            sourceKind: 'dialog' as const,
            path: '/repo/document.txt'
          }
        ],
        attachmentImages: [
          {
            id: 'image',
            name: 'image.png',
            data: 'aW1hZ2U=',
            mimeType: 'image/png',
            sourceKind: 'clipboard' as const
          }
        ]
      }
      vi.mocked(normalizeAttachments).mockResolvedValueOnce(attachments)

      await handleChatSend(f.deps, f.event, { ...payload, sessionId: 's' })

      expect(resolveTurn).toHaveBeenCalledExactlyOnceWith(
        f.deps.ctx,
        f.deps.supervisor,
        f.adapters[backend],
        expect.objectContaining({ sessionId: 's', text: 'hello' }),
        JSON.stringify(attachments) + instructions[backend]
      )
    }
  )
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
  it.each([
    ['claude', 'opencode', null],
    ['opencode', 'claude', null],
    ['claude', 'opencode', 's'],
    ['opencode', 'claude', 's']
  ] as const)(
    'rejects %s input on an existing %s lease before reservation (session=%s)',
    async (backend, leasedBackend, sessionId) => {
      const f = fixture(sessionId ? backend : undefined)
      const logicalKey = sessionId ? sessionLeaseKey(sessionId) : clientLeaseKey('draft')
      const { lease } = f.leases.acquire({
        logicalKey,
        backend: leasedBackend,
        agentKind: 'code',
        sessionId,
        owner: f.event.sender,
        requestedProviderKey: null
      })

      await handleChatSend(f.deps, f.event, { ...payload, sessionId, backend })

      expect(f.acquire).not.toHaveBeenCalled()
      expect(resolveTurn).not.toHaveBeenCalled()
      expect(f.pendingMessages.pending(sessionId ?? 'draft')).toEqual([])
      expect(f.leases.getByKey(logicalKey)).toBe(lease)
      expect(lease.controller.signal.aborted).toBe(false)
      expect(sendChatEvent).toHaveBeenCalledExactlyOnceWith(
        f.event.sender,
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ category: 'schema_validation_error' })
        })
      )
    }
  )
  it.each(['claude', 'opencode'] as const)(
    'keeps same-harness %s input on the preparing lease queue',
    async (backend) => {
      const f = fixture()
      const { lease } = f.leases.acquire({
        logicalKey: clientLeaseKey('draft'),
        backend,
        agentKind: 'code',
        sessionId: null,
        owner: f.event.sender,
        requestedProviderKey: null
      })
      await handleChatSend(f.deps, f.event, { ...payload, backend })
      expect(f.pendingMessages.pending('draft')).toEqual([
        expect.objectContaining({ text: 'hello' })
      ])
      expect(resolveTurn).not.toHaveBeenCalled()
      expect(f.leases.getByKey(clientLeaseKey('draft'))).toBe(lease)
      expect(sendChatEvent).not.toHaveBeenCalledWith(
        f.event.sender,
        expect.objectContaining({ type: 'error' })
      )
    }
  )
})
