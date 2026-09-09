import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskContextContent } from './TaskContextContent'

let session: ChatState
let busy = false
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (s: ChatState) => unknown) => select(session),
  useChatStore: (select: (s: unknown) => unknown) => select({ activeKey: 'work' }),
  useChatBusy: () => busy,
  chatActions: {}
}))

describe('Work context directory controls', () => {
  beforeEach(() => {
    busy = false
    session = {
      ...initialChatState,
      sessionId: 'work',
      agentKind: 'work',
      cwd: 'C:/implicit',
      extraDirs: ['C:/References']
    }
  })
  it('exposes only explicitly added directories as named keyboard buttons', () => {
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    const chip = $('button[data-surface="context-directory"]')
    expect(chip.length).toBe(1)
    expect(chip.attr('type')).toBe('button')
    expect(chip.attr('aria-label')).toBe('폴더 열기: References')
    expect(chip.attr('title')).toContain('C:/References')
    expect(chip.attr('disabled')).toBeUndefined()
    expect($.text()).not.toContain('implicit')
  })
  it('requires a persisted session to open a directory', () => {
    session = { ...session, sessionId: null }
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    expect($('[data-surface="context-directory"]').is('[disabled]')).toBe(true)
  })
  it('allows opening an existing folder while work is active without allowing scope changes', () => {
    busy = true
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    expect($('[data-surface="context-directory"]').attr('disabled')).toBeUndefined()
    expect($('button[aria-label="폴더 추가"]').is('[disabled]')).toBe(true)
  })
})
