import { vi } from 'vitest'
import type { ConcurrencyEvent } from '../../../../../shared/ipc'
import { initialChatState } from '../reducer/chatReducer'
import { bootstrapChat, NEW_CHAT_KEY, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

// Real store subscriptions/actions; only the preload boundary is replaced.
export function installConcurrencyHarness(
  options: {
    newSession?: boolean
    isolation?: 'managed' | 'intent' | 'recover'
    handoffSource?: boolean
  } = {}
): {
  emit: (event: ConcurrencyEvent) => void
  cleanup: () => void
  chatSend: ReturnType<typeof vi.fn>
} {
  const { chatSend } = installChatStoreHarness()
  let emit!: (event: ConcurrencyEvent) => void
  Object.assign(window.orca, {
    concurrency: {
      onEvent: (handler: typeof emit) => {
        emit = handler
        return () => {}
      }
    },
    session: { cwd: async () => '/repo', onTitle: () => () => {} },
    settings: { get: async () => ({}), set: vi.fn(async () => ({})) }
  })
  window.orca.chat.onEvent = vi.fn(() => () => {})
  const key = options.newSession ? NEW_CHAT_KEY : options.handoffSource ? 'source' : 's1'
  useChatStore.setState({
    sessions: {
      [key]: {
        session: {
          ...initialChatState,
          sessionId: options.newSession ? null : key,
          projectId: options.newSession ? null : 'p1',
          pendingProjectId: options.newSession ? 'p1' : null,
          cwd: '/repo',
          messages: options.handoffSource
            ? [
                { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'first' }] },
                { role: 'user', createdAt: 2, parts: [{ type: 'text', text: 'second' }] }
              ]
            : [],
          worktree:
            options.isolation === 'managed' || options.isolation === 'recover'
              ? { sourceCwd: '/repo', repoRoot: '/repo' }
              : null,
          worktreeIsolation: options.isolation === 'intent' || options.isolation === 'recover'
        },
        live: { text: '', reasoning: '' },
        subagentMeta: {}
      }
    },
    activeKey: key
  })
  const cleanup = bootstrapChat()
  return { emit: (event) => emit(event), cleanup, chatSend }
}
