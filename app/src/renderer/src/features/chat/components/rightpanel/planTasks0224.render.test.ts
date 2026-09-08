import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Message } from '../../reducer/chatReducer'
import { Icon } from '../../../../shared/ui/Icon'

const { state } = vi.hoisted(() => ({
  state: {
    planContent: '## 계획 본문\n\n이 문장만 계획 댓글 범위입니다.' as string | null,
    pendingPlanReview: null as unknown,
    planComments: [] as unknown[],
    activePlanCommentId: null,
    messages: [] as Message[],
    selectedTaskKey: null as string | null,
    agentTools: ['TaskCreate'] as string[] | null,
    cliVersion: '2.1.100'
  }
}))

vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (s: unknown) => unknown) => select(state),
  useUnseenSettledTaskCount: () => 0,
  chatActions: {
    selectTask: vi.fn(),
    acknowledgeSettledTasks: vi.fn(),
    addPlanComment: vi.fn(),
    updatePlanComment: vi.fn(),
    removePlanComment: vi.fn(),
    setActivePlanComment: vi.fn()
  }
}))

const { PlanTileContent } = await import('./PlanTileContent')

// 실제 TaskList 결과 경로를 통해 만든 작업이다. 입력 순서를 바꾸어도 기존 id 정렬이
// 상하 조립 뒤에 유지되는지 함께 본다.
function messages(): Message[] {
  return [
    {
      role: 'assistant',
      createdAt: 1,
      parts: [
        { type: 'tool_call', toolRunId: 'tasks', toolName: 'TaskList', args: {} },
        {
          type: 'tool_result',
          toolRunId: 'tasks',
          result: 'wire',
          isError: false,
          structuredOutput: {
            tasks: [
              { id: '3', subject: '대기 작업', status: 'pending', blockedBy: ['2'] },
              { id: '2', subject: '완료 작업', status: 'completed', blockedBy: ['1'] },
              {
                id: '1',
                subject: '진행 작업',
                status: 'in_progress',
                description: '실제 작업 상세',
                blockedBy: []
              }
            ]
          }
        },
        {
          type: 'tool_call',
          toolRunId: 'active',
          toolName: 'TaskUpdate',
          args: { taskId: '1', activeForm: '구현 진행 중' }
        },
        {
          type: 'tool_result',
          toolRunId: 'active',
          result: 'wire',
          isError: false,
          structuredOutput: { success: true, taskId: '1', updatedFields: [] }
        }
      ]
    }
  ]
}

const render = (): string => renderToStaticMarkup(createElement(PlanTileContent))

function rowsBySubject(html: string): Record<string, string> {
  return Object.fromEntries(
    html
      .split('<div role="button"')
      .slice(1)
      .map((chunk) => [chunk.match(/aria-label="([^"]+) 상세 보기"/)?.[1] ?? '', chunk])
  )
}

beforeEach(() => {
  state.planContent = '## 계획 본문\n\n이 문장만 계획 댓글 범위입니다.'
  state.pendingPlanReview = null
  state.messages = messages()
  state.selectedTaskKey = null
  state.agentTools = ['TaskCreate']
})

describe('0224 r2 — Coding 계획 상단·작업 하단 (VP-R2-01/07 · EP-R2-3)', () => {
  it('계획 다음에 작업 section을 두고 id 순서와 세 상태를 실제 행에 표시한다', () => {
    const html = render()
    const planAt = html.indexOf('이 문장만 계획 댓글 범위입니다.')
    const tasksAt = html.indexOf('<section aria-label="작업"')
    expect(planAt).toBeGreaterThan(-1)
    expect(tasksAt).toBeGreaterThan(planAt)
    const taskSection = html.slice(tasksAt)
    // 계획과 작업의 존재만 보지 않고 각 영역과 순서를 관측한다. 슬롯 swap 변이가 red다.
    expect(html.slice(0, tasksAt)).not.toContain('진행 작업 상세 보기')
    expect(taskSection).not.toContain('이 문장만 계획 댓글 범위입니다.')
    const rows = rowsBySubject(taskSection)
    expect(Object.keys(rows)).toEqual(['진행 작업', '완료 작업', '대기 작업'])
    expect(rows['진행 작업']).toContain('구현 진행 중')
    expect(rows['진행 작업']).toContain('border-solid')
    expect(rows['진행 작업']).not.toContain('animate-spin')
    expect(rows['완료 작업']).toContain('line-through')
    expect(rows['완료 작업']).toContain(
      renderToStaticMarkup(createElement(Icon, { name: 'check', size: 17 }))
    )
    expect(rows['완료 작업']).not.toContain('완료 필요')
    expect(rows['대기 작업']).toContain('border-dashed')
    expect(rows['대기 작업']).toContain('#2 완료 필요')
  })

  it.each([false, true])('계획 본문이 없어도 작업을 유지한다 (승인 대기=%s)', (pending) => {
    state.planContent = null
    state.pendingPlanReview = pending ? { requestId: 'r1', plan: '' } : null
    const html = render()
    const emptyText = pending ? '계획 본문을 가져오지 못했습니다' : '아직 플랜이 없습니다'
    expect(html).toContain(emptyText)
    expect(Object.keys(rowsBySubject(html))).toEqual(['진행 작업', '완료 작업', '대기 작업'])
    expect(html.indexOf('<section aria-label="작업"')).toBeGreaterThan(html.indexOf(emptyText))
  })

  it('선택한 작업 상세와 뒤로가기는 하단에만 있고 상단 계획을 대체하지 않는다', () => {
    state.selectedTaskKey = 'agent:1'
    const html = render()
    const tasksAt = html.indexOf('<section aria-label="작업"')
    expect(html.slice(0, tasksAt)).toContain('이 문장만 계획 댓글 범위입니다.')
    expect(html.slice(tasksAt)).toContain('실제 작업 상세')
    expect(html.slice(tasksAt)).toContain('aria-label="목록으로"')
    expect(html.slice(0, tasksAt)).not.toContain('실제 작업 상세')
    expect(rowsBySubject(html)).toEqual({})
  })

  it('계획과 작업이 모두 비면 실제 도구 미지원 안내와 CLI 버전도 하단에 유지한다', () => {
    state.planContent = null
    state.messages = []
    state.agentTools = ['Read']
    const html = render()
    const tasksAt = html.indexOf('<section aria-label="작업"')
    expect(html.slice(0, tasksAt)).toContain('아직 플랜이 없습니다')
    expect(html.slice(tasksAt)).toContain('할 일 목록 도구를 지원하지 않습니다.')
    expect(html.slice(tasksAt)).toContain('2.1.100')
  })
})
