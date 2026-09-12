import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskContextContent } from './TaskContextContent'

let session: ChatState
let busy = false
let picking = false
let activeKey = 'work'
const callbacks = vi.hoisted(() => ({
  sourceClick: undefined as undefined | ((event: { preventDefault: () => void }) => void),
  attachmentClicks: new Map<string, () => void>(),
  openPath: vi.fn(async () => ({ ok: true }))
}))
vi.mock('../../../../shared/api/ipc', () => ({ fileApi: { openPath: callbacks.openPath } }))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (s: ChatState) => unknown) => select(session),
  useChatStore: Object.assign((select: (s: unknown) => unknown) => select({ activeKey }), {
    getState: () => ({ activeKey, sessions: { work: { session } } })
  }),
  useChatBusy: () => busy,
  chatActions: {}
}))
vi.mock('../../hooks/useDirectoryPicker', () => ({
  useDirectoryPicker: () => ({ picking, disabled: picking || busy, pick: vi.fn(), errorKey: null })
}))
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const props = args[1] as Record<string, unknown>
      if (props['data-surface'] === 'context-web-source')
        callbacks.sourceClick = props.onClick as typeof callbacks.sourceClick
      if (props['data-surface'] === 'context-attachment-source')
        callbacks.attachmentClicks.set(String(props.title), props.onClick as () => void)
      return actual.jsxDEV(...args)
    }
  }
})

describe('Work context directory controls', () => {
  beforeEach(() => {
    busy = false
    picking = false
    activeKey = 'work'
    callbacks.sourceClick = undefined
    callbacks.attachmentClicks.clear()
    callbacks.openPath.mockClear()
    session = {
      ...initialChatState,
      sessionId: 'work',
      agentKind: 'work',
      cwd: 'C:/implicit',
      extraDirs: ['C:/References']
    }
  })
  it('exposes the actual working directory and explicitly added directories as named keyboard buttons', () => {
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    const chip = $('button[data-surface="context-directory"]')
    expect(chip.length).toBe(2)
    expect(chip.first().attr('type')).toBe('button')
    expect(chip.first().attr('aria-label')).toBe('폴더 열기: implicit')
    expect(chip.first().attr('title')).toBe('현재 작업 폴더: C:/implicit')
    expect(chip.last().attr('title')).toContain('C:/References')
    expect(chip.first().attr('disabled')).toBeUndefined()
  })
  it('requires a persisted session to open a directory', () => {
    session = { ...session, sessionId: null }
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    expect($('[data-surface="context-directory"]').is('[disabled]')).toBe(true)
  })
  it('omits internal Claude sources while retaining ordinary files and configured directories', () => {
    const internal = 'C:/Users/Tester/AppData/Local/Temp/orcinus-orca/claude/tasks/task.output'
    const visible = 'C:/Work/input.md'
    session = {
      ...session,
      messages: [
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'internal',
              toolName: 'Read',
              args: { file_path: internal }
            },
            {
              type: 'tool_result',
              toolRunId: 'internal',
              result: 'internal result',
              isError: false
            },
            {
              type: 'tool_call',
              toolRunId: 'visible',
              toolName: 'Read',
              args: { file_path: visible }
            },
            { type: 'tool_result', toolRunId: 'visible', result: 'input', isError: false }
          ]
        }
      ]
    }
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    expect($.html()).not.toContain('task.output')
    expect($.text()).toContain('input.md')
    expect($('[data-surface="context-directory"]').length).toBe(2)
    expect(session.messages[0].parts).toHaveLength(4)
  })
  it('allows opening an existing folder while work is active without allowing scope changes', () => {
    busy = true
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    expect($('[data-surface="context-directory"]').attr('disabled')).toBeUndefined()
    expect($('button[aria-label="폴더 추가"]').is('[disabled]')).toBe(true)
  })
  it('keeps folder picking disabled without rendering a transient picking label', () => {
    picking = true
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    expect($('button[aria-label="폴더 추가"]').is('[disabled]')).toBe(true)
    expect($.text()).not.toContain('폴더 선택 중')
  })
  it('renders successful web sources through the existing external-link path and prevents stale-session clicks', () => {
    session = {
      ...session,
      cwd: null,
      extraDirs: [],
      messages: [
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'fetch',
              toolName: 'WebFetch',
              args: { url: 'https://docs.example/guide' }
            },
            { type: 'tool_result', toolRunId: 'fetch', result: 'read page', isError: false }
          ]
        }
      ]
    }
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    const link = $('[data-surface="context-web-source"]')
    expect(link.attr('href')).toBe('https://docs.example/guide')
    expect(link.attr('target')).toBe('_blank')
    expect(link.attr('rel')).toBe('noopener noreferrer')
    expect(link.text()).toBe('docs.example/guide')
    expect($.text()).not.toContain('이 작업에 사용할 폴더를 추가하세요.')
    const preventDefault = vi.fn()
    callbacks.sourceClick!({ preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    activeKey = 'other'
    callbacks.sourceClick!({ preventDefault })
    expect(preventDefault).toHaveBeenCalledExactlyOnceWith()
    session = { ...session, sessionId: 'other', messages: [] }
    expect(
      load(renderToStaticMarkup(createElement(TaskContextContent)))(
        '[data-surface="context-web-source"]'
      ).length
    ).toBe(0)
  })
  it('shows all composer attachments by original name and reveals stored files within the originating session', async () => {
    session = {
      ...session,
      messages: [
        {
          role: 'user',
          createdAt: 1,
          parts: [
            {
              type: 'attachment',
              attachments: [
                {
                  id: 'file',
                  name: '센서 자료.pdf',
                  kind: 'file',
                  mimeType: 'application/pdf',
                  path: 'C:/tmp/input-file.pdf'
                },
                {
                  id: 'image',
                  name: '화면 캡처.png',
                  kind: 'image',
                  mimeType: 'image/png',
                  path: 'C:/tmp/clipboard.png'
                },
                { id: 'legacy', name: '이전 첨부.txt', kind: 'file', mimeType: 'text/plain' }
              ]
            }
          ]
        }
      ]
    }
    const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
    const attachments = $('[data-surface="context-attachment-source"]')
    expect(attachments.length).toBe(3)
    expect(attachments.map((_, element) => $(element).text()).get()).toEqual([
      '센서 자료.pdf',
      '화면 캡처.png',
      '이전 첨부.txt'
    ])
    expect(attachments.first().attr('disabled')).toBeUndefined()
    expect(attachments.last().is('[disabled]')).toBe(true)
    callbacks.attachmentClicks.get('C:/tmp/input-file.pdf')!()
    await Promise.resolve()
    expect(callbacks.openPath).toHaveBeenCalledExactlyOnceWith({
      path: 'C:/tmp/input-file.pdf',
      mode: 'reveal',
      sessionId: 'work'
    })
    activeKey = 'other'
    callbacks.attachmentClicks.get('C:/tmp/clipboard.png')!()
    expect(callbacks.openPath).toHaveBeenCalledTimes(1)
  })
})
