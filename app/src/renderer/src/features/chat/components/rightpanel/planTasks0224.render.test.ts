import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Message } from '../../reducer/chatReducer'
import { load } from 'cheerio'
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
  const $ = load(html)
  return Object.fromEntries(
    $('[data-task-row]')
      .toArray()
      .map((row) => {
        const label = $(row).find('[data-task-detail-trigger]').attr('aria-label') ?? ''
        return [label.split(': ')[0], $.html(row)]
      })
  )
}

beforeEach(() => {
  state.planContent = '## 계획 본문\n\n이 문장만 계획 댓글 범위입니다.'
  state.pendingPlanReview = null
  state.messages = messages()
  state.selectedTaskKey = null
  state.agentTools = ['TaskCreate']
})

describe('0224 r3 — Code 콘텐츠 존재·진행 표시 (VP-R3-01/07 · EP1)', () => {
  it('계획 다음에 작업 section을 두고 id 순서와 세 상태를 실제 행에 표시한다', () => {
    const html = render()
    const planAt = html.indexOf('이 문장만 계획 댓글 범위입니다.')
    const tasksAt = html.indexOf('<section aria-label="작업"')
    expect(planAt).toBeGreaterThan(-1)
    expect(tasksAt).toBeGreaterThan(planAt)
    const taskSection = html.slice(tasksAt)
    // 계획과 작업의 존재만 보지 않고 각 영역과 순서를 관측한다. 슬롯 swap 변이가 red다.
    expect(html.slice(0, tasksAt)).not.toContain('data-task-detail-trigger')
    expect(taskSection).not.toContain('이 문장만 계획 댓글 범위입니다.')
    const rows = rowsBySubject(taskSection)
    expect(Object.keys(rows)).toEqual(['진행 작업', '완료 작업', '대기 작업'])
    expect(rows['진행 작업']).toContain('구현 진행 중')
    expect(rows['진행 작업']).toContain('animate-spin')
    expect(rows['진행 작업']).toContain('motion-reduce:animate-none')
    expect(rows['완료 작업']).toContain('line-through')
    expect(rows['완료 작업']).toContain(
      renderToStaticMarkup(createElement(Icon, { name: 'check', size: 18 }))
    )
    expect(rows['완료 작업']).not.toContain('완료 필요')
    expect(rows['완료 작업']).not.toContain('animate-spin')
    expect(rows['대기 작업']).toContain('bg-bg2')
    expect(rows['대기 작업']).toContain('#2 완료 필요')
    expect(rows['대기 작업']).not.toContain('animate-spin')
  })

  it('작업만 있으면 빈 계획 표시 없이 작업만 표시한다', () => {
    state.planContent = null
    const html = render()
    expect(html).not.toContain('아직 플랜이 없습니다')
    expect(html).not.toContain('계획 본문을 가져오지 못했습니다')
    expect(html).not.toContain('계획 댓글 범위')
    expect(Object.keys(rowsBySubject(html))).toEqual(['진행 작업', '완료 작업', '대기 작업'])
    expect(html).toContain('<section aria-label="작업"')
  })

  it('계획만 있으면 작업 구역과 빈 목록을 표시하지 않는다', () => {
    state.messages = []
    state.agentTools = ['Read']
    const html = render()
    expect(html).toContain('이 문장만 계획 댓글 범위입니다.')
    expect(html).not.toContain('<section aria-label="작업"')
    expect(html).not.toContain('할 일 목록 도구를 지원하지 않습니다.')
    expect(html).not.toContain('Claude 가 Task 를 만들거나')
  })

  it('작업이 있어도 승인 대기의 본문 해소 실패는 숨기지 않는다', () => {
    state.planContent = null
    state.pendingPlanReview = { requestId: 'r1', plan: '' }
    const html = render()
    expect(html).toContain('계획 본문을 가져오지 못했습니다')
    expect(html).not.toContain('아직 플랜이 없습니다')
    expect(Object.keys(rowsBySubject(html))).toEqual(['진행 작업', '완료 작업', '대기 작업'])
    expect(html.indexOf('<section aria-label="작업"')).toBeGreaterThan(
      html.indexOf('계획 본문을 가져오지 못했습니다')
    )
  })

  it('r5: 선택한 작업은 계획과 목록을 보존한 채 전체 패널 상세로 전환한다', () => {
    state.selectedTaskKey = 'agent:1'
    const $ = load(render())
    const overview = $('[data-plan-task-overview]')
    expect(overview.attr('hidden')).toBeDefined()
    expect(overview.attr('inert')).toBeDefined()
    expect(overview.text()).toContain('이 문장만 계획 댓글 범위입니다.')
    expect(overview.find('[data-task-row]').length).toBe(3)
    expect(overview.find('dl').length).toBe(0)
    const detail = $('[data-plan-task-detail]')
    expect(detail.text()).toContain('실제 작업 상세')
    expect(detail.find('button[aria-label="목록으로"]').length).toBe(1)
    expect(detail.parent()[0]).toBe(overview.parent()[0])
  })

  it('둘 다 비면 단일 빈 영역에 실제 도구 미지원 안내와 CLI 버전을 보존한다', () => {
    state.planContent = null
    state.messages = []
    state.agentTools = ['Read']
    const html = render()
    expect(html).not.toContain('<section')
    expect(html).toContain('아직 플랜이 없습니다')
    expect(html).toContain('할 일 목록 도구를 지원하지 않습니다.')
    expect(html).toContain('2.1.100')
    expect(html).not.toContain('Claude 가 Task 를 만들거나')
    expect(html.match(/아직 플랜이 없습니다/g)).toHaveLength(1)
  })

  it.each([{ tools: null }, { tools: ['TaskCreate'] }])(
    '둘 다 비고 미지원이 아니면 단일 일반 빈 상태다 (tools=$tools)',
    ({ tools }) => {
      state.planContent = null
      state.messages = []
      state.agentTools = tools
      const html = render()
      expect(html).toContain('아직 플랜이 없습니다')
      expect(html).not.toContain('<section')
      expect(html).not.toContain('할 일 목록 도구를 지원하지 않습니다.')
      expect(html).not.toContain('Claude 가 Task 를 만들거나')
    }
  )
})
