import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { DiffRequirementAnchor } from '../../../shared/ipc'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import {
  SessionChainLeaseRegistry,
  sessionLeaseKey
} from '../../features/sessions/session-chain-lease'
import { normalizeAttachments } from '../../features/chat/attachments'
import { sendChatEvent } from '../../infra/ipc/send'
import { handleChatSend } from './send'
import type { ChatRuntimeDeps, NormalizedAttachments } from './deps'

vi.mock('../../features/chat/attachments', () => ({ normalizeAttachments: vi.fn() }))
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('./resolve-turn', () => ({ resolveTurn: vi.fn(), resolveTurnProvider: vi.fn() }))

afterEach(() => vi.restoreAllMocks())

describe('handleChatSend busy submission', () => {
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
        registry: { getActive: () => ({ id: 'claude' }) }
      },
      supervisor: { acquireChain },
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
    completeNormalization({ attachmentTexts, attachmentImages: [] })
    await request
    expect(order).toEqual(['admitted', 'listen-released', 'next-microtask:1'])
    expect(queue.pending('s1')).toEqual([
      expect.objectContaining({
        id: 'queued-1',
        text: 'queued text',
        createdAt: 101,
        attachmentTexts,
        requirements: [requirement],
        attachmentViews
      })
    ])
    expect(sendChatEvent).toHaveBeenCalledExactlyOnceWith(owner, {
      type: 'message.queued',
      sessionId: 's1',
      id: 'queued-1',
      text: 'queued text',
      requirements: [requirement],
      attachmentViews,
      createdAt: 101
    })
  })
})
