import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { DiffRequirementAnchor } from '../../../shared/ipc'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import {
  SessionChainLeaseRegistry,
  clientLeaseKey,
  sessionLeaseKey
} from '../../features/sessions/session-chain-lease'
import { normalizeAttachments } from '../../features/chat/attachments'
import { sendChatEvent } from '../../infra/ipc/send'
import { handleChatSend } from './send'
import type { ChatRuntimeDeps, NormalizedAttachments } from './deps'

vi.mock('../../features/chat/attachments', () => ({ normalizeAttachments: vi.fn() }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('./resolve-turn', () => ({ resolveTurn: vi.fn(), resolveTurnProvider: vi.fn() }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('handleChatSend busy submission', () => {
  it.each([undefined, 'work'] as const)(
    'accepts an inherited/equal Work request while preparing (%s)',
    async (agentKind) => {
      const owner = {} as WebContents
      const queue = new PendingMessageQueue()
      const leases = new SessionChainLeaseRegistry<WebContents>()
      const key = clientLeaseKey('draft1')
      const first = leases.acquire({
        logicalKey: key,
        sessionId: null,
        owner,
        requestedProviderKey: null,
        agentKind: 'work'
      }).lease
      const acquireChain = vi.fn((input) => leases.acquire(input))
      vi.mocked(normalizeAttachments).mockResolvedValueOnce({
        attachmentTexts: [],
        attachmentImages: []
      })
      const deps = {
        ctx: {
          mockAdapter: null,
          debugMock: { enabled: false },
          registry: { getActive: () => ({ id: 'claude' }) }
        },
        supervisor: { acquireChain, getChainByKey: (value: string) => leases.getByKey(value) },
        pendingMessages: queue,
        listenRelease: new Map(),
        isUpdateInstallPending: () => false
      } as unknown as ChatRuntimeDeps
      await handleChatSend(deps, { sender: owner } as IpcMainInvokeEvent, {
        sessionId: null,
        projectId: null,
        text: 'follow-up',
        clientRequestId: 'draft1',
        agentKind
      })
      expect(acquireChain).toHaveBeenCalledWith(expect.objectContaining({ agentKind: 'work' }))
      expect(leases.getByKey(key)).toBe(first)
      expect(queue.pending('draft1')).toEqual([expect.objectContaining({ text: 'follow-up' })])
      expect(sendChatEvent).toHaveBeenLastCalledWith(
        owner,
        expect.objectContaining({ type: 'message.queued' })
      )
    }
  )
  it.each(['sessionId', 'forkFrom', 'handoffFrom'] as const)(
    'rejects explicit mismatch with the %s DB identity before any lease is created',
    async (sourceField) => {
      const owner = {} as WebContents
      const acquireChain = vi.fn()
      const dbRead = vi.fn(() => ({ agent_kind: 'work' }))
      vi.mocked(normalizeAttachments).mockResolvedValueOnce({
        attachmentTexts: [],
        attachmentImages: []
      })
      const deps = {
        ctx: {
          mockAdapter: null,
          debugMock: { enabled: false },
          registry: { getActive: () => ({ id: 'claude' }) },
          db: { getSessionById: dbRead }
        },
        supervisor: { acquireChain, getChainByKey: vi.fn() },
        isUpdateInstallPending: () => false
      } as unknown as ChatRuntimeDeps
      await handleChatSend(deps, { sender: owner } as IpcMainInvokeEvent, {
        sessionId: null,
        projectId: null,
        text: 'different kind',
        [sourceField]: 'source',
        agentKind: 'code'
      })
      expect(dbRead).toHaveBeenCalledWith('source')
      expect(acquireChain).not.toHaveBeenCalled()
      expect(sendChatEvent).toHaveBeenLastCalledWith(
        owner,
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ category: 'schema_validation_error' })
        })
      )
    }
  )
  it.each([false, true])(
    'rejects mismatched birth before lease admission and queue mutation (confirmed=%s)',
    async (confirmed) => {
      const owner = {} as WebContents
      const queue = new PendingMessageQueue()
      const leases = new SessionChainLeaseRegistry<WebContents>()
      const sessionId = confirmed ? 's1' : null
      const logicalKey = confirmed ? sessionLeaseKey('s1') : clientLeaseKey('draft1')
      leases.acquire({
        logicalKey,
        sessionId,
        owner,
        requestedProviderKey: null,
        agentKind: 'work'
      })
      const acquireChain = vi.fn((input) => leases.acquire(input))
      const snapshot = leases.all()
      vi.mocked(normalizeAttachments).mockResolvedValueOnce({
        attachmentTexts: [],
        attachmentImages: []
      })
      const deps = {
        ctx: {
          mockAdapter: null,
          debugMock: { enabled: false },
          registry: { getActive: () => ({ id: 'claude' }) },
          db: { getSessionById: () => (confirmed ? { agent_kind: 'work' } : undefined) }
        },
        supervisor: { acquireChain, getChainByKey: (key: string) => leases.getByKey(key) },
        pendingMessages: queue,
        listenRelease: new Map(),
        isUpdateInstallPending: () => false
      } as unknown as ChatRuntimeDeps
      await handleChatSend(deps, { sender: owner } as IpcMainInvokeEvent, {
        sessionId,
        projectId: null,
        text: 'must not queue',
        clientRequestId: 'draft1',
        agentKind: 'code'
      })
      expect(acquireChain).not.toHaveBeenCalled()
      expect(queue.pending(sessionId ?? 'draft1')).toEqual([])
      expect(leases.all()).toEqual(snapshot)
      expect(sendChatEvent).toHaveBeenLastCalledWith(
        owner,
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ category: 'schema_validation_error' })
        })
      )
    }
  )
  it('normalizes before admission, then synchronously queues the full payload and releases listen', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    const owner = {} as WebContents
    const queue = new PendingMessageQueue()
    const leases = new SessionChainLeaseRegistry<WebContents>()
    const leaseInput = {
      logicalKey: sessionLeaseKey('s1'),
      sessionId: 's1',
      owner,
      requestedProviderKey: null
    }
    leases.acquire(leaseInput)
    const order: string[] = []
    const listenRelease = new Map([['s1', () => order.push('listen-released')]])
    let completeNormalization!: (value: NormalizedAttachments) => void
    vi.mocked(normalizeAttachments).mockReturnValueOnce(
      new Promise((resolve) => {
        completeNormalization = resolve
      })
    )
    const acquireChain = vi.fn((input) => {
      order.push('admitted')
      // An await between admission and enqueue lets the active chain observe an empty queue.
      queueMicrotask(() => order.push(`next-microtask:${queue.pending('s1').length}`))
      return leases.acquire(input)
    })
    const deps = {
      ctx: {
        mockAdapter: null,
        debugMock: { enabled: false },
        registry: { getActive: () => ({ id: 'claude' }) },
        db: { getSessionById: () => ({ agent_kind: 'code' }) }
      },
      supervisor: { acquireChain, getChainByKey: (key: string) => leases.getByKey(key) },
      pendingMessages: queue,
      listenRelease,
      isUpdateInstallPending: () => false
    } as unknown as ChatRuntimeDeps
    const requirement: DiffRequirementAnchor = {
      sessionId: 's1',
      baselineCommit: 'base',
      filePath: 'a.ts',
      oldLine: null,
      newLine: 2,
      hunkHeader: '@@ -0,0 +2 @@',
      contextBefore: [],
      contextAfter: [],
      comment: 'preserve',
      createdAt: 1
    }
    const attachmentViews = [
      { id: 'attachment', name: 'note.txt', mimeType: 'text/plain', kind: 'file' as const }
    ]
    const request = handleChatSend(deps, { sender: owner } as IpcMainInvokeEvent, {
      sessionId: 's1',
      projectId: null,
      text: 'queued text',
      clientRequestId: 'queued-1',
      requirements: [requirement],
      attachmentViews
    })
    expect(acquireChain).not.toHaveBeenCalled()
    const attachmentTexts: NormalizedAttachments['attachmentTexts'] = [
      {
        id: 'attachment',
        name: 'note.txt',
        mimeType: 'text/plain',
        text: 'file content',
        charsOriginal: 12,
        charsIncluded: 12,
        truncated: false,
        sourceKind: 'dialog'
      }
    ]
    const storedViews = attachmentViews.map((view) => ({
      ...view,
      path: 'C:/tmp/input.txt',
      sha256: 'a'.repeat(64)
    }))
    completeNormalization({ attachmentTexts, attachmentImages: [], attachmentViews: storedViews })
    await request
    expect(order).toEqual(['admitted', 'listen-released', 'next-microtask:1'])
    expect(queue.pending('s1')).toEqual([
      expect.objectContaining({
        id: 'queued-1',
        text: 'queued text',
        createdAt: 101,
        attachmentTexts,
        requirements: [requirement],
        attachmentViews: storedViews
      })
    ])
    expect(sendChatEvent).toHaveBeenCalledExactlyOnceWith(owner, {
      type: 'message.queued',
      sessionId: 's1',
      id: 'queued-1',
      text: 'queued text',
      requirements: [requirement],
      attachmentViews: storedViews,
      createdAt: 101
    })
  })
})
