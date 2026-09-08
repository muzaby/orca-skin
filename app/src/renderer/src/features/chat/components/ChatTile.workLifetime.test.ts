import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChatTile } from './ChatTile'
import { TranscriptView } from './transcript/TranscriptView'
import { Composer } from './Composer'
import { initialChatState } from '../reducer/chatReducer'

const harness = vi.hoisted(() => ({ activeKey: 'first', kind: 'work' as 'work' | 'coding' }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: () => [undefined, vi.fn()]
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (selector: (state: typeof initialChatState) => unknown) =>
    selector({ ...initialChatState, agentKind: harness.kind, sessionId: harness.activeKey }),
  useChatStore: (selector: (state: unknown) => unknown) =>
    selector({ activeKey: harness.activeKey, draftRestore: null }),
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
