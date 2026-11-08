import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'
import { useChatStore } from '../store/chatStore'
import { initialChatState } from '../reducer/chatReducer'
import { i18n } from '../../../shared/i18n'

const harness = vi.hoisted(() => ({
  responding: false,
  backend: 'claude' as 'claude' | 'opencode',
  pendingAsks: [] as typeof initialChatState.pendingAsks
}))
vi.mock('../store/chatStore', async (original) => ({
  ...(await original<typeof import('../store/chatStore')>()),
  useChatSession: (selector: (state: typeof initialChatState) => unknown) =>
    selector({
      ...initialChatState,
      agentKind: 'work',
      sessionId: 's',
      cwd: '/work',
      projectId: 'p1',
      backend: harness.backend,
      pendingAsks: harness.pendingAsks,
      pendingRequestOrder: harness.pendingAsks.map((ask) => ({
        kind: 'ask_question' as const,
        requestId: ask.requestId
      }))
    }),
  useChatBusy: () => true,
  useChatResponding: () => harness.responding,
  useChatResidualSteer: () => 0,
  useNewChatPending: () => false
}))
vi.mock('../../../shared/ui/UsageCircle', () => ({ UsageCircle: () => null }))
vi.mock('./CwdPanel', () => ({
  CwdPanel: ({ inflight }: { inflight: boolean }) =>
    createElement('div', { 'data-cwd-busy': String(inflight) })
}))

beforeEach(() => {
  harness.backend = 'claude'
  harness.pendingAsks = []
})

describe('C1 Composer real identity selector', () => {
  it.each([
    ['own', false, false, false],
    ['other', true, false, true],
    ['both', true, false, true],
    ['other', false, true, false],
    ['empty', false, false, false]
  ] as const)(
    '%s responding=%s isolated=%s renders notice=%s',
    (kind, responding, isolated, visible) => {
      harness.responding = responding
      const own = { sessionId: 's', clientKey: null }
      const other = { sessionId: 'other', clientKey: 'draft:other' }
      useChatStore.setState({
        sessions: {
          s: {
            session: {
              ...initialChatState,
              sessionId: 's',
              projectId: 'p1',
              worktreeIsolation: isolated
            },
            live: { text: '', reasoning: '' },
            subagentMeta: {}
          }
        },
        activeKey: 's',
        concurrencyByProjectId: {
          p1:
            kind === 'own'
              ? [own]
              : kind === 'other'
                ? [other]
                : kind === 'both'
                  ? [own, other]
                  : []
        }
      })
      Object.assign(useChatStore.getInitialState(), useChatStore.getState())
      // useChatSession above is an unrelated Composer view seam; the actual selector reads the seeded store.
      const markup = renderToStaticMarkup(
        createElement(Composer, { backendLabel: 'Claude', canAbort: true })
      )
      expect(load(markup).text().includes(i18n.t('chat.composer.concurrencyNoticeTitle'))).toBe(
        visible
      )
    }
  )
})
