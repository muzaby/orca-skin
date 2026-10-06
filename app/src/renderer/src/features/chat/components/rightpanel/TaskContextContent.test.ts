import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskContextContent } from './TaskContextContent'
import { errorToastStore } from '../../../../shared/errors/errorToastStore'
import type { OpenContextFileResult } from '../../../../../../shared/ipc'

let session: ChatState
let busy = false
let picking = false
let activeKey = 'work'
const callbacks = vi.hoisted(() => ({
  sourceClick: undefined as undefined | ((event: { preventDefault: () => void }) => void),
  attachmentClicks: new Map<string, () => void>(),
  fileClicks: new Map<string, () => void>(),
  directoryClicks: new Map<string, () => void>(),
  openPath: vi.fn(async () => {}),
  openContextFile: vi
    .fn<() => Promise<OpenContextFileResult>>()
    .mockResolvedValue({ outcome: 'opened' })
}))
vi.mock('../../../../shared/api/ipc', () => ({
  fileApi: { openPath: callbacks.openPath, openContextFile: callbacks.openContextFile }
}))
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
      if (props['data-surface'] === 'context-file-source')
        callbacks.fileClicks.set(String(props.title), props.onClick as () => void)
      if (props['data-surface'] === 'context-directory')
        callbacks.directoryClicks.set(String(props['aria-label']), props.onClick as () => void)
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
    callbacks.fileClicks.clear()
    callbacks.directoryClicks.clear()
    callbacks.openPath.mockReset().mockResolvedValue(undefined)
    callbacks.openContextFile.mockReset().mockResolvedValue({ outcome: 'opened' })
    for (const toast of errorToastStore.getState().toasts)
      errorToastStore.getState().dismiss(toast.id)
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
  it('shows all composer attachments by original name and opens stored files within the originating session', async () => {
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
    expect(attachments.first().attr('title')).toBe('C:/tmp/input-file.pdf')
    expect(attachments.last().is('[disabled]')).toBe(true)
    callbacks.attachmentClicks.get('C:/tmp/input-file.pdf')!()
    await Promise.resolve()
    expect(callbacks.openContextFile).toHaveBeenCalledExactlyOnceWith({
      path: 'C:/tmp/input-file.pdf',
      sessionId: 'work'
    })
    activeKey = 'other'
    callbacks.attachmentClicks.get('C:/tmp/clipboard.png')!()
    expect(callbacks.openContextFile).toHaveBeenCalledTimes(1)
    expect(callbacks.openPath).not.toHaveBeenCalled()
  })
  it.each(['C:\\w\\docs\\a.md', '/w/docs/a.md'])(
    'shows only the file name while preserving the full path tooltip for %s',
    async (path) => {
      session = {
        ...session,
        messages: [
          {
            role: 'assistant',
            createdAt: 1,
            parts: [
              { type: 'tool_call', toolRunId: 'read', toolName: 'Read', args: { file_path: path } },
              { type: 'tool_result', toolRunId: 'read', result: 'input', isError: false }
            ]
          }
        ]
      }
      const $ = load(renderToStaticMarkup(createElement(TaskContextContent)))
      const file = $('[data-surface="context-file-source"]')
      expect(file.text()).toBe('a.md')
      expect(file.attr('title')).toBe(path)
      expect(file.attr('aria-label')).toBe('a.md 파일 열기')
      callbacks.fileClicks.get(path)!()
      for (let i = 0; i < 3; i++) await Promise.resolve()
      expect(callbacks.openContextFile).toHaveBeenCalledExactlyOnceWith({ path, sessionId: 'work' })
      expect(callbacks.openPath).not.toHaveBeenCalled()
    }
  )
  it.each<OpenContextFileResult>([
    { outcome: 'opened' },
    { outcome: 'revealed', reason: 'open-failed' },
    { outcome: 'revealed', reason: 'unsupported-type' },
    { outcome: 'missing' }
  ])('maps the file outcome $outcome/$reason to the expected toast', async (result) => {
    const path = 'C:/work/gone.md'
    session = {
      ...session,
      messages: [
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            { type: 'tool_call', toolRunId: 'read', toolName: 'Read', args: { file_path: path } },
            { type: 'tool_result', toolRunId: 'read', result: 'input', isError: false }
          ]
        }
      ]
    }
    callbacks.openContextFile.mockResolvedValueOnce(result)
    renderToStaticMarkup(createElement(TaskContextContent))
    callbacks.fileClicks.get(path)!()
    for (let i = 0; i < 3; i++) await Promise.resolve()
    expect(
      errorToastStore.getState().toasts.map(({ title, detail }) => ({ title, detail }))
    ).toEqual(
      result.outcome === 'missing'
        ? [
            {
              title: 'fileUnavailable',
              detail: 'gone.md: 파일이 없습니다. 삭제되었거나 이동되었을 수 있습니다.'
            }
          ]
        : []
    )
    expect(renderToStaticMarkup(createElement(TaskContextContent))).not.toContain('role="alert"')
  })
  it('keeps one in-flight file request and still reports missing after moving to another session', async () => {
    const path = 'C:/work/gone.md'
    const other = 'C:/work/other.md'
    session = {
      ...session,
      messages: [
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            { type: 'tool_call', toolRunId: 'read', toolName: 'Read', args: { file_path: path } },
            { type: 'tool_result', toolRunId: 'read', result: 'input', isError: false },
            { type: 'tool_call', toolRunId: 'other', toolName: 'Read', args: { file_path: other } },
            { type: 'tool_result', toolRunId: 'other', result: 'other', isError: false }
          ]
        }
      ]
    }
    let finish!: (result: OpenContextFileResult) => void
    callbacks.openContextFile.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    renderToStaticMarkup(createElement(TaskContextContent))
    callbacks.fileClicks.get(path)!()
    callbacks.fileClicks.get(other)!()
    expect(callbacks.openContextFile).toHaveBeenCalledExactlyOnceWith({ path, sessionId: 'work' })
    activeKey = 'other'
    finish({ outcome: 'missing' })
    for (let i = 0; i < 3; i++) await Promise.resolve()
    expect(
      errorToastStore.getState().toasts.map(({ title, detail }) => ({ title, detail }))
    ).toEqual([
      {
        title: 'fileUnavailable',
        detail: 'gone.md: 파일이 없습니다. 삭제되었거나 이동되었을 수 있습니다.'
      }
    ])
    callbacks.fileClicks.get(path)!()
    expect(callbacks.openContextFile).toHaveBeenCalledTimes(1)
  })
  it('keeps folder chips on directory IPC with their existing failure detail', async () => {
    callbacks.openPath.mockRejectedValueOnce(new Error('native failure'))
    renderToStaticMarkup(createElement(TaskContextContent))
    callbacks.directoryClicks.get('폴더 열기: implicit')!()
    for (let i = 0; i < 3; i++) await Promise.resolve()
    expect(callbacks.openPath).toHaveBeenCalledExactlyOnceWith({
      path: 'C:/implicit',
      mode: 'directory',
      sessionId: 'work'
    })
    expect(callbacks.openContextFile).not.toHaveBeenCalled()
    expect(errorToastStore.getState().toasts[0].detail).toBe(
      'implicit: 폴더를 열지 못했습니다. 삭제되었거나 접근할 수 없는지 확인한 뒤 다시 클릭해 주세요.'
    )
  })
  it('reports a rejected file open as a toast and keeps the panel free of an inline alert (0252 AC9)', async () => {
    for (const toast of errorToastStore.getState().toasts)
      errorToastStore.getState().dismiss(toast.id)
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
                  name: 'gone.pdf',
                  kind: 'file',
                  mimeType: 'application/pdf',
                  path: 'C:/tmp/gone.pdf'
                }
              ]
            }
          ]
        }
      ]
    }
    callbacks.openContextFile.mockRejectedValueOnce(new Error('IO failed'))
    renderToStaticMarkup(createElement(TaskContextContent))
    callbacks.attachmentClicks.get('C:/tmp/gone.pdf')!()
    for (let i = 0; i < 3; i++) await Promise.resolve()
    expect(
      errorToastStore.getState().toasts.map(({ title, detail }) => ({ title, detail }))
    ).toEqual([{ title: 'openFailed', detail: 'gone.pdf: 파일을 열지 못했습니다.' }])
    expect(renderToStaticMarkup(createElement(TaskContextContent))).not.toContain('role="alert"')
  })
})
