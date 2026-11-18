// 공통 user 턴 메타의 지연 복사 (0325 VP-26 y1·y2 · EP-7 ③).
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import { initialChatState } from '../../../reducer/chatReducer'
import * as turns from '../../../lib/turns'
import { withTranscript } from '../../registries/transcript.testfixture'
import { UserTurn } from './UserTurn'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' }),
  formatTimeFull: () => 'time',
  formatTimeShort: () => 'time'
}))
vi.mock('../../../store/chatStore', () => ({
  useChatSession: (select: (state: typeof initialChatState) => unknown) => select(initialChatState),
  chatActions: {}
}))
// 버블 본문은 이 oracle 밖이다(`useId` 를 fake 훅이 흉내 내지 않는다).
vi.mock('./UserMessage', () => ({ UserMessage: () => null }))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const render = (text: string): void => {
  if (!dom) vi.useFakeTimers()
  dom ??= installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const turn: turns.Turn = {
    role: 'user',
    startIndex: 0,
    messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text }] }]
  }
  dom.render(withTranscript(createElement(UserTurn, { turn })))
}
const copyButtons = (): ReturnType<FakeDom['queryAll']> =>
  dom!.queryAll('[aria-label="common.copyMessage"]')

describe('UserTurn 지연 복사', () => {
  it('y1 텍스트 턴 — 렌더 중 0회 · 클릭 때 1회 · 클립보드는 그 문자열', async () => {
    const writeText = vi.fn(async () => {})
    const copy = vi.spyOn(turns, 'turnCopyText')
    render('질문 본문')
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(copy).not.toHaveBeenCalled()
    dom!.click(copyButtons()[0])
    await Promise.resolve()
    expect(copy).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledExactlyOnceWith('질문 본문')
  })

  it('y2 공백 턴 — 버튼 0 · 렌더 중 0회', () => {
    const copy = vi.spyOn(turns, 'turnCopyText')
    render('  \n ')
    expect(copyButtons()).toHaveLength(0)
    expect(copy).not.toHaveBeenCalled()
  })
})
