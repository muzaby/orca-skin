import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'
import { initialChatState } from '../reducer/chatReducer'
import { i18n } from '../../../shared/i18n'

const harness = vi.hoisted(() => ({ responding: false }))
vi.mock('../store/chatStore', async (original) => ({
  ...(await original<typeof import('../store/chatStore')>()),
  useChatSession: (selector: (state: typeof initialChatState) => unknown) =>
    selector({ ...initialChatState, agentKind: 'work', sessionId: 's', cwd: '/work' }),
  useChatBusy: () => true,
  useChatResponding: () => harness.responding,
  useChatResidualSteer: () => 0,
  useNewChatPending: () => false,
  useProjectConcurrencyCount: () => 0
}))
vi.mock('../../../shared/ui/UsageCircle', () => ({ UsageCircle: () => null }))
vi.mock('./CwdPanel', () => ({
  CwdPanel: ({ inflight }: { inflight: boolean }) =>
    createElement('div', { 'data-cwd-busy': String(inflight) })
}))

describe('Composer response and lease activity wiring', () => {
  it.each([false, true])(
    '채널 점유 중 responding=%s가 실제 입력/중단 표시만 전환한다',
    (responding) => {
      harness.responding = responding
      const $ = load(
        renderToStaticMarkup(
          createElement(Composer, {
            backendLabel: 'Claude',
            canAbort: true,
            showLandingCwdPanel: true
          })
        )
      )
      expect($('[data-cwd-busy]').attr('data-cwd-busy')).toBe('true')
      expect($(`button[aria-label="${i18n.t('common.stop')}"]`)).toHaveLength(responding ? 1 : 0)
      expect($(`button[aria-label="${i18n.t('chat.composer.send')}"]`)).toHaveLength(
        responding ? 0 : 1
      )
      expect($('textarea').attr('placeholder')).toBe(
        i18n.t(responding ? 'chat.composer.placeholderFeedback' : 'chat.agent.workPlaceholder')
      )
    }
  )
})
