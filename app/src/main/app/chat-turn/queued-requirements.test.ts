import { describe, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { DiffRequirementAnchor } from '../../../shared/ipc'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { SessionChainLeaseRegistry } from '../../features/sessions/session-chain-lease'
import { sendChatEvent } from '../../infra/ipc/send'
import { enqueueTurnPrompt } from './enqueue'
import { reserveOnBusySession } from './busy-reserve'

vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))

const requirements: DiffRequirementAnchor[] = [
  {
    sessionId: 's1',
    baselineCommit: 'base',
    filePath: 'a.ts',
    oldLine: null,
    newLine: 2,
    hunkHeader: '@@ -0,0 +2 @@',
    contextBefore: [],
    contextAfter: [],
    comment: 'keep me',
    createdAt: 1
  }
]
const attachments = { attachmentTexts: [], attachmentImages: [] }

describe('queued requirement display payload', () => {
  it('turn-open queued event preserves the same anchors delivered to the provider batch', () => {
    const sender = {} as WebContents
    const result = enqueueTurnPrompt({
      wc: sender,
      pendingMessages: new PendingMessageQueue(),
      queueKey: 's1',
      chainId: 'chain',
      channelAlive: true,
      sessionId: 's1',
      text: 'apply',
      requirements,
      attachments,
      attachmentViews: [],
      admittedAt: 1,
      clientRequestId: 'request'
    })
    expect(result.mainBatch.requirements).toEqual(requirements)
    expect(sendChatEvent).toHaveBeenLastCalledWith(
      sender,
      expect.objectContaining({
        type: 'message.queued',
        id: 'request',
        requirements
      })
    )
  })

  it('busy queued event preserves comments while the unchanged provider queue waits', () => {
    const sender = {} as WebContents
    const pendingMessages = new PendingMessageQueue()
    const { lease } = new SessionChainLeaseRegistry<WebContents>().acquire({
      logicalKey: 's1',
      sessionId: 's1',
      owner: sender,
      requestedProviderKey: null
    })
    reserveOnBusySession(
      { pendingMessages, listenRelease: new Map() },
      { sender } as IpcMainInvokeEvent,
      's1',
      's1',
      lease,
      { text: 'apply', requirements, clientRequestId: 'busy' },
      attachments
    )
    expect(pendingMessages.pending('s1')[0]?.requirements).toEqual(requirements)
    expect(sendChatEvent).toHaveBeenLastCalledWith(
      sender,
      expect.objectContaining({
        type: 'message.queued',
        id: 'busy',
        requirements
      })
    )
  })
})
