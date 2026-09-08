import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChatTile } from './ChatTile'
import { TranscriptView } from './transcript/TranscriptView'
import { Composer } from './Composer'
import { initialChatState } from '../reducer/chatReducer'

const harness = vi.hoisted(() => ({
  activeKey: 'first',
  kind: 'work' as 'work' | 'coding',
  draftRestore: null as {
    key: string
    seq: number
    text: string
    mode?: 'append' | 'replace'
  } | null,
  restoreComposerDraft: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: () => [undefined, vi.fn()]
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (selector: (state: typeof initialChatState) => unknown) =>
    selector({ ...initialChatState, agentKind: harness.kind, sessionId: harness.activeKey }),
  useChatStore: (selector: (state: unknown) => unknown) =>
    selector({ activeKey: harness.activeKey, draftRestore: harness.draftRestore }),
  chatActions: { restoreComposerDraft: harness.restoreComposerDraft },
  useChatBusy: () => false,
  usePendingSteer: () => []
}))
vi.mock('../hooks/useScrollAnchor', () => ({
  useScrollAnchor: () => ({
    scrollRef: { current: null },
    contentRef: { current: null },
    onScroll: vi.fn(),
    showJump: false,
    scrollToBottom: vi.fn(),
    anchored: false
  })
}))
vi.mock('./ChatTitleBar', () => ({ ChatTitleBar: () => null }))
vi.mock('./transcript/LineageBanner', () => ({ LineageBanner: () => null }))
vi.mock('./transcript/TranscriptView', () => ({ TranscriptView: () => null }))
vi.mock('./Composer', () => ({ Composer: () => null }))
vi.mock('./rightpanel/RightPanel', () => ({ RightPanel: () => null }))

function find(node: ReactNode, type: unknown): ReactElement | undefined {
  if (!isValidElement(node)) return undefined
  if (node.type === type) return node
  let found: ReactElement | undefined
  Children.forEach((node.props as { children?: ReactNode }).children, (child) => {
    found ??= find(child, type)
  })
  return found
}
describe('actual ChatTile Work session lifetime wiring', () => {
  it('keys only the Work transcript to its session, leaving Composer and Coding lifetime unchanged', () => {
    harness.kind = 'work'
    harness.activeKey = 'first'
    const first = ChatTile({ backendLabel: 'Claude', canAbort: true })
    harness.activeKey = 'fork-with-copied-boundary'
    const fork = ChatTile({ backendLabel: 'Claude', canAbort: true })
    expect(find(first, TranscriptView)?.key).toBe('first')
    expect(find(fork, TranscriptView)?.key).toBe('fork-with-copied-boundary')
    expect(find(first, Composer)?.key).toBeNull()
    expect(find(fork, Composer)?.key).toBeNull()
    harness.kind = 'coding'
    expect(
      find(ChatTile({ backendLabel: 'Claude', canAbort: true }), TranscriptView)?.key
    ).toBeNull()
  })
})

describe('actual ChatTile draft update forwarding', () => {
  it('forwards append mode only to the targeted active session', () => {
    harness.activeKey = 'first'
    harness.draftRestore = { key: 'first', seq: 9, text: '> task\n\n', mode: 'append' }
    const ownComposer = find(ChatTile({ backendLabel: 'Claude', canAbort: true }), Composer)
    expect((ownComposer?.props as { restoredDraft?: unknown }).restoredDraft).toEqual({
      id: 9,
      text: '> task\n\n',
      mode: 'append'
    })
    harness.activeKey = 'other'
    const otherComposer = find(ChatTile({ backendLabel: 'Claude', canAbort: true }), Composer)
    expect((otherComposer?.props as { restoredDraft?: unknown }).restoredDraft).toBeUndefined()
    harness.draftRestore = null
  })
  it('routes cancelled feedback through the same scoped producer without append mode', () => {
    harness.activeKey = 'first'
    const transcript = find(ChatTile({ backendLabel: 'Claude', canAbort: true }), TranscriptView)
    ;(transcript?.props as { onRestoreSteerDraft: (text: string) => void }).onRestoreSteerDraft(
      'cancelled'
    )
    expect(harness.restoreComposerDraft).toHaveBeenLastCalledWith('first', 'cancelled')
  })
})
