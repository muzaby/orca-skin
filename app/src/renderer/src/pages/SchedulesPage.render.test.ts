// `/scheduled` 조립 — pages 가 프로젝트 목록·실행 설정 입력·대화 열기를 schedules
// feature 에 넘기는지 본다. schedules feature 는 그 값을 받는 자리만 드러내도록 대체한다.

import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptExecution } from '../../../shared/scheduled-tasks'

const navigate = vi.hoisted(() => vi.fn())
const captured = vi.hoisted(() => ({
  onOpenSession: null as null | ((id: string) => void),
  pickers: null as null | import('../features/schedules').SchedulePickers
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../features/projects', () => ({
  projectsActions: { addFromDirectory: vi.fn() },
  useProjectsState: (select: (state: unknown) => unknown) =>
    select({
      list: [
        { id: 'p-folder', name: '카메라 검증', cwd: 'C:\\work\\cam' },
        { id: 'p-flat', name: '메모', cwd: null }
      ]
    })
}))
vi.mock('../features/chat', () => ({
  ProjectPickerChip: (props: {
    projects: { id: string; cwd: string | null }[]
    value: string | null
  }) =>
    createElement('div', {
      'data-component': 'ProjectPickerChip',
      'data-value': props.value ?? 'none',
      'data-projects': props.projects
        .map((item) => `${item.id}:${item.cwd ? 'dir' : 'flat'}`)
        .join(',')
    }),
  ExecutionSettingsPicker: (props: { value: PromptExecution | null }) =>
    createElement('div', {
      'data-component': 'ExecutionSettingsPicker',
      'data-permission': props.value?.permissionMode ?? 'none'
    })
}))
vi.mock('../features/schedules', async () => {
  const { ScheduleTaskForm } = await import('../features/schedules/components/ScheduleTaskModal')
  const { emptyForm } = await import('../features/schedules/lib/scheduleForm')
  return {
    SchedulesView: (props: {
      projects: never
      pickers: import('../features/schedules').SchedulePickers
      onOpenSession: (id: string) => void
    }) => {
      captured.onOpenSession = props.onOpenSession
      captured.pickers = props.pickers
      // 실제 모달 본문에 페이지가 넘긴 값을 꽂아 본다.
      return createElement(ScheduleTaskForm, {
        form: {
          ...emptyForm(),
          kind: 'prompt',
          execution: {
            backend: 'claude',
            agentKind: 'work',
            providerKey: 'k',
            modelFamily: 'm',
            permissionMode: 'plan'
          }
        },
        projects: props.projects,
        pickers: props.pickers,
        onChange: () => undefined
      })
    }
  }
})
import { SchedulesPage } from './SchedulesPage'

beforeEach(() => {
  navigate.mockClear()
  captured.onOpenSession = null
  captured.pickers = null
})

describe('SchedulesPage', () => {
  it('프로젝트 목록이 모달 선택지가 되고 폴더 유무가 전달된다', () => {
    const html = renderToStaticMarkup(createElement(SchedulesPage))
    expect(html).toContain(
      'data-component="ProjectPickerChip" data-value="none" data-projects="p-folder:dir,p-flat:flat"'
    )
  })

  it('chat 의 실행 설정 입력이 프롬프트 모드 슬롯에 값과 함께 그려진다', () => {
    const html = renderToStaticMarkup(createElement(SchedulesPage))
    expect(html).toMatch(
      /data-schedule-execution=""[^>]*><div data-component="ExecutionSettingsPicker" data-permission="plan">/
    )
  })

  // 칩에서 고른 값은 모달이 슬롯에 넘긴 콜백으로 그대로 돌아간다(0320 AC36 · EP-10 C).
  it('프로젝트·실행 설정 칩의 선택이 모달이 넘긴 콜백으로 간다', () => {
    renderToStaticMarkup(createElement(SchedulesPage))
    const onProject = vi.fn()
    const onExecution = vi.fn()
    const project = captured.pickers!.project(null, onProject) as ReactElement<{
      onChange: (id: string) => void
    }>
    const execution = captured.pickers!.execution(null, onExecution) as ReactElement<{
      onChange: (value: PromptExecution | null) => void
    }>
    const chosen: PromptExecution = {
      backend: 'claude',
      agentKind: 'code',
      providerKey: 'k',
      modelFamily: 'm',
      permissionMode: 'plan'
    }
    project.props.onChange('p-folder')
    execution.props.onChange(chosen)
    expect(onProject).toHaveBeenCalledExactlyOnceWith('p-folder')
    expect(onExecution).toHaveBeenCalledExactlyOnceWith(chosen)
  })

  it('이력의 대화 열기는 그 세션 경로로 이동한다', () => {
    renderToStaticMarkup(createElement(SchedulesPage))
    captured.onOpenSession!('session-12')
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/chat/session-12')
  })
})
