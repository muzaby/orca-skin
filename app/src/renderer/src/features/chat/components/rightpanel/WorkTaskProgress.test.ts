import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { taskBoardFromMessages, taskBoardOrdered, type TaskBoardStatus } from '../../lib/taskBoard'
import type { AppMessagePart } from '../../../../../../shared/ipc'
import { WorkTaskProgress } from './WorkTaskProgress'

vi.mock('../../store/chatStore', () => ({
  useChatStore: (selector: (state: { activeKey: string }) => unknown) =>
    selector({ activeKey: 'work' }),
  chatActions: { selectTask: vi.fn(), restoreComposerDraft: vi.fn() }
}))

function taskParts(
  id: string,
  subject: string,
  status: 'in_progress' | 'completed' | 'pending'
): AppMessagePart[] {
  return [
    { type: 'tool_call', toolRunId: `create-${id}`, toolName: 'TaskCreate', args: { subject } },
    {
      type: 'tool_result',
      toolRunId: `create-${id}`,
      result: 'ok',
      isError: false,
      structuredOutput: { task: { id, subject } }
    },
    {
      type: 'tool_call',
      toolRunId: `update-${id}`,
      toolName: 'TaskUpdate',
      args: { taskId: id, status }
    },
    {
      type: 'tool_result',
      toolRunId: `update-${id}`,
      result: 'ok',
      isError: false,
      structuredOutput: {
        success: true,
        taskId: id,
        updatedFields: ['status'],
        statusChange: { from: 'pending', to: status }
      }
    }
  ]
}
const items = taskBoardOrdered(
  taskBoardFromMessages([
    {
      createdAt: 0,
      role: 'assistant',
      parts: [
        ...taskParts('1', '다운로드 폴더 정리 중', 'in_progress'),
        ...taskParts('2', '이미지 파일 클라우드 동기화', 'completed'),
        ...taskParts('3', '개발 빌드 파일 외부 저장소 이동', 'pending')
      ]
    }
  ])
)

describe('Work populated progress', () => {
  it('renders actual TaskCreate/TaskUpdate results as ordered titles and distinct numbered status rows', () => {
    const $ = load(renderToStaticMarkup(createElement(WorkTaskProgress, { items })))
    expect($('[data-empty-progress]').length).toBe(0)
    expect(
      $('ol > li')
        .map((_, row) => $(row).attr('data-status'))
        .get()
    ).toEqual(['in_progress', 'completed', 'pending'])
    expect($('[data-status="in_progress"] > button').text()).toContain('1다운로드 폴더 정리 중')
    expect($('[data-status="in_progress"] > button > span').first().attr('class')).toContain(
      'border-indigo'
    )
    expect($('[data-status="completed"] .line-through').text()).toBe('이미지 파일 클라우드 동기화')
    expect($('[data-status="completed"] > button > span').first().attr('class')).toContain(
      'bg-indigo'
    )
    expect($('[data-status="pending"] > button').text()).toContain(
      '3개발 빌드 파일 외부 저장소 이동'
    )
    expect($('[data-behavior="action:ask-about-task"]').length).toBe(3)
    expect($('li > button [data-behavior="action:ask-about-task"]').length).toBe(0)
    expect($('p').text()).not.toContain('오래 걸리는 작업')
  })
  it.each(['stopping', 'paused', 'aborted', 'failed'] satisfies TaskBoardStatus[])(
    'retains %s semantics and existing selected task detail',
    (status) => {
      const selected = { ...items[0], status, description: '작업의 세부 설명' }
      const $ = load(
        renderToStaticMarkup(createElement(WorkTaskProgress, { items: [selected], selected }))
      )
      expect($('li').attr('data-status')).toBe(status)
      expect($('li > button').attr('aria-pressed')).toBe('true')
      expect($('body').text()).toContain('작업의 세부 설명')
      expect($('body').text()).toContain('목록으로')
    }
  )
  it('uses illustrative circles and helper copy only for the empty state', () => {
    const $ = load(renderToStaticMarkup(createElement(WorkTaskProgress, { items: [] })))
    expect($('[data-empty-progress][aria-hidden="true"]').length).toBe(1)
    expect($('ol').length).toBe(0)
    expect($('body').text()).toContain('오래 걸리는 작업')
  })
})
