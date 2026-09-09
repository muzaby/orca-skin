import { createElement, type ButtonHTMLAttributes } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from '../../reducer/chatReducer'
import { TaskTileContent } from './TaskTileContent'

type CapturedButton = ButtonHTMLAttributes<HTMLButtonElement> & { 'data-behavior'?: string }
const harness = vi.hoisted(() => ({
  session: null as ChatState | null,
  buttons: [] as CapturedButton[],
  selectTask: vi.fn(),
  restoreComposerDraft: vi.fn()
}))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(harness.session!),
  useChatStore: (select: (state: { activeKey: string }) => unknown) =>
    select({ activeKey: 'work' }),
  useChatBusy: () => false,
  useUnseenSettledTaskCount: () => 0,
  chatActions: {
    selectTask: harness.selectTask,
    restoreComposerDraft: harness.restoreComposerDraft
  }
}))
vi.mock('../../../../shared/ui/Button', async (original) => {
  const { Button } = await original<typeof import('../../../../shared/ui/Button')>()
  return {
    Button: (props: CapturedButton) => {
      harness.buttons.push(props)
      return createElement(Button, props)
    }
  }
})

function renderPanel(): ReturnType<typeof load> {
  harness.buttons = []
  return load(renderToStaticMarkup(createElement(TaskTileContent)))
}
function clickAction(behavior: string): void {
  const button = harness.buttons.find((candidate) => candidate['data-behavior'] === behavior)
  expect(button).toBeDefined()
  button!.onClick?.({} as never)
}

beforeEach(() => {
  harness.session = {
    ...initialChatState,
    agentKind: 'work',
    sessionId: 'work',
    extraDirs: ['C:/Downloads'],
    messages: [
      {
        role: 'assistant',
        createdAt: 0,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'create1',
            toolName: 'TaskCreate',
            args: { subject: '다운로드 정리', description: '중복 파일을 확인한다' }
          },
          {
            type: 'tool_result',
            toolRunId: 'create1',
            result: 'ok',
            isError: false,
            structuredOutput: {
              task: { id: '1', subject: '다운로드 정리', description: '중복 파일을 확인한다' }
            }
          }
        ]
      }
    ]
  }
  harness.buttons = []
  harness.selectTask.mockReset().mockImplementation((key: string | null) => {
    harness.session = chatReducer(harness.session!, { type: 'SELECT_TASK', key })
  })
  harness.restoreComposerDraft.mockReset()
})

describe('0224 r4 actual Work task panel depth', () => {
  it('starts at the overview with the original three sections and actionable task row', () => {
    const $ = renderPanel()
    expect($('[data-work-task-overview]').length).toBe(1)
    expect($('[data-work-task-overview]').attr('hidden')).toBeUndefined()
    expect($('[data-task-detail-trigger="agent:1"]').length).toBe(1)
    expect($('[data-work-task-detail]').length).toBe(0)
    expect(
      $('section')
        .map((_, section) => $(section).attr('aria-label'))
        .get()
    ).toEqual(['진행 상황', '출력', '컨텍스트'])
  })
  it('changes the whole tile to detail while retaining a hidden and inert overview subtree', () => {
    harness.session!.selectedTaskKey = 'agent:1'
    const $ = renderPanel()
    const overview = $('[data-work-task-overview]')
    const detail = $('[data-work-task-detail]')
    expect(overview.attr('hidden')).toBeDefined()
    expect(overview.attr('inert')).toBeDefined()
    expect(overview.find('section').length).toBe(3)
    expect(overview.find('dl').length).toBe(0)
    expect(overview.text()).toContain('Downloads')
    expect(detail.parent()[0]).toBe(overview.parent()[0])
    expect(detail.text()).toContain('다운로드 정리')
    expect(detail.text()).toContain('중복 파일을 확인한다')
    expect(detail.find('[data-behavior="action:back-to-work-overview"]').length).toBe(1)
  })
  it('back action restores the overview without discarding the selected session folders or outputs owner', () => {
    harness.session!.selectedTaskKey = 'agent:1'
    renderPanel()
    clickAction('action:back-to-work-overview')
    expect(harness.session!.selectedTaskKey).toBeNull()
    const $ = renderPanel()
    expect($('[data-work-task-detail]').length).toBe(0)
    expect($('[data-work-task-overview]').attr('hidden')).toBeUndefined()
    expect($('[data-work-task-overview]').text()).toContain('Downloads')
    expect($('section[aria-label="출력"]').length).toBe(1)
  })
  it('falls back to the overview when the selected task no longer exists', () => {
    harness.session!.selectedTaskKey = 'agent:deleted'
    const $ = renderPanel()
    expect($('[data-work-task-detail]').length).toBe(0)
    expect($('[data-work-task-overview]').attr('hidden')).toBeUndefined()
    expect($('[data-work-task-overview]').text()).toContain('다운로드 정리')
  })
  it('keeps question composition separate from detail navigation', () => {
    renderPanel()
    clickAction('action:ask-about-task')
    expect(harness.restoreComposerDraft).toHaveBeenCalledWith(
      'work',
      '> 다운로드 정리\n\n',
      'append'
    )
    expect(harness.selectTask).not.toHaveBeenCalled()
    expect(harness.session!.selectedTaskKey).toBeNull()
  })
})
