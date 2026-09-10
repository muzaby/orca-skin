import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskTileContent } from './TaskTileContent'

let session: ChatState
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (s: ChatState) => unknown) => select(session),
  useChatStore: (select: (s: unknown) => unknown) => select({ activeKey: 'work' }),
  useChatBusy: () => false,
  useUnseenSettledTaskCount: () => 0,
  chatActions: {},
  getActiveChatSession: () => session
}))

describe('Work task panel sections', () => {
  beforeEach(() => {
    session = { ...initialChatState, agentKind: 'work' }
  })
  it('starts with three named sections, decorative empty progress and an actionable folder picker', () => {
    const $ = load(renderToStaticMarkup(createElement(TaskTileContent)))
    expect(
      $('section')
        .map((_, el) => $(el).attr('aria-label'))
        .get()
    ).toEqual(['진행 상황', '출력', '컨텍스트'])
    expect(
      $('section[aria-label="진행 상황"] [data-empty-progress][aria-hidden="true"]').length
    ).toBe(1)
    expect($('section[aria-label="컨텍스트"] button[aria-label="폴더 추가"]').length).toBe(1)
    expect($('section[aria-label="출력"]').text()).toContain('이 작업 중에 생성된 파일')
  })
  it('distinguishes working and user-added folders without claiming they were read', () => {
    session = { ...session, cwd: 'C:/default', extraDirs: ['C:/Downloads'] }
    const $ = load(renderToStaticMarkup(createElement(TaskTileContent)))
    const context = $('section[aria-label="컨텍스트"]')
    const directories = context.find('[data-surface="context-directory"]')
    expect(directories.map((_, el) => $(el).text()).get()).toEqual(['default', 'Downloads'])
    expect(directories.eq(0).attr('title')).toBe('현재 작업 폴더: C:/default')
    expect(directories.eq(1).attr('title')).toBe('사용자가 추가한 폴더: C:/Downloads')
    expect(context.find('[data-surface="context-file-source"]')).toHaveLength(0)
    expect(context.text()).not.toContain('출처')
  })
})
