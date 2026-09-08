import { describe, expect, it, vi } from 'vitest'
import { createDraftSnapshot, applyDraftUpdate, setDraftComposition } from './draftSnapshot'
import { chatActions, ingestChatEvent, useChatStore } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'

describe('Work task question draft edits', () => {
  it.each(['', 'draft', 'draft\n', 'draft\n\n'])(
    'appends a quoted task after %j without replacing existing text',
    (text) => {
      const next = applyDraftUpdate(createDraftSnapshot(text), {
        id: 1,
        text: '> task\n\n',
        mode: 'append'
      })
      expect(next.text).toBe(text === '' ? '> task\n\n' : 'draft\n\n> task\n\n')
      expect(next.selectionStart).toBe(next.text.length)
      expect(next.selectionEnd).toBe(next.text.length)
    }
  )
  it('keeps cancellation restoration as replacement and waits for composition completion', () => {
    const current = createDraftSnapshot('existing draft')
    expect(applyDraftUpdate(current, { id: 2, text: 'cancelled feedback' }).text).toBe(
      'cancelled feedback'
    )
    const composing = setDraftComposition(current, true)
    expect(applyDraftUpdate(composing, { id: 3, text: '> task', mode: 'append' })).toBe(composing)
  })
  it('emits distinct edit ids in the same millisecond and sends no chat message', () => {
    const harness = installChatStoreHarness({ agentKind: 'work' })
    vi.spyOn(Date, 'now').mockReturnValue(1)
    chatActions.restoreComposerDraft('s', '> first\n\n', 'append')
    const first = useChatStore.getState().draftRestore!
    chatActions.restoreComposerDraft('s', '> second\n\n', 'append')
    const second = useChatStore.getState().draftRestore!
    expect(first).toMatchObject({ key: 's', text: '> first\n\n', mode: 'append' })
    expect(second.seq).toBeGreaterThan(first.seq)
    expect(harness.chatSend).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
  it('ignores a captured question action after another session becomes active', () => {
    installChatStoreHarness({ agentKind: 'work' })
    const entry = useChatStore.getState().sessions.s
    useChatStore.setState({ activeKey: 'other', sessions: { s: entry, other: entry } })
    chatActions.restoreComposerDraft('s', '> stale task\n\n', 'append')
    expect(useChatStore.getState().draftRestore).toBeNull()
  })
  it('orders explicit edits and cancelled-message restoration using one sequence', () => {
    installChatStoreHarness({ agentKind: 'work' })
    chatActions.restoreComposerDraft('s', '> task\n\n', 'append')
    const first = useChatStore.getState().draftRestore!
    const entry = useChatStore.getState().sessions.s
    useChatStore.setState({
      sessions: {
        s: { ...entry, pendingSteer: [{ id: 'pending', text: 'restore me', createdAt: 0 }] }
      }
    })
    ingestChatEvent({ type: 'message.cancelled', sessionId: 's', ids: ['pending'] })
    const restored = useChatStore.getState().draftRestore!
    expect(restored.seq).toBeGreaterThan(first.seq)
    expect(restored).toMatchObject({ key: 's', text: 'restore me' })
    expect(restored.mode).toBeUndefined()
  })
})
