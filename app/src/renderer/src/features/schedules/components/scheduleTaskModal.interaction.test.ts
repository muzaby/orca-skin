// 새 작업·편집 모달 — 사용자가 고른 값이 폼 상태를 거쳐 저장 요청까지 그대로 가는지(AC36),
// 저장 성공·실패에서 모달이 어떻게 되는지(AC37), 상황에 맞는 안내 문구를 고르는지(AC38) 본다.
// 칩 메뉴는 실제로 열고 누른다. 프로젝트·실행 설정 칩은 pages 가 넣는 슬롯이라 받은 콜백을 드러내는
// stub 으로 대신하고, 그 슬롯 배선은 `pages/SchedulesPage.render.test.ts` 가 본다.

import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PromptExecution,
  ScheduledTaskInput,
  ScheduledTaskRecord
} from '../../../../../shared/scheduled-tasks'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'

vi.mock('react', async (original) => {
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...(await original<typeof import('react')>()),
    ...fakeHooks,
    useId: () => fakeHooks.useMemo(() => 'test-id', [])
  }
})
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// 문구는 키 그대로 드러낸다 — 어느 문구를 골랐는지가 관측 대상이다.
vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
import { ScheduleTaskModal } from './ScheduleTaskModal'

const execution: PromptExecution = {
  backend: 'claude',
  agentKind: 'code',
  providerKey: 'claude:team',
  modelFamily: 'claude-sonnet-5-5',
  permissionMode: 'default'
}
const picked: PromptExecution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'claude-opus-5-5',
  effort: 'low',
  permissionMode: 'plan'
}
const projects = [
  { id: 'p1', name: '카메라 검증', cwd: '/work/cam' },
  { id: 'p2', name: '센서 로그', cwd: '/work/log' },
  { id: 'p-flat', name: '메모', cwd: null }
]
const record = (overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord => ({
  id: 't1',
  title: '아침 점검',
  projectId: 'p1',
  trigger: { kind: 'daily', at: { hour: 9, minute: 0 } },
  action: { kind: 'prompt', text: '점검해', execution },
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
  ...overrides
})

let dom: FakeDom
let onSubmit: ReturnType<typeof vi.fn<(input: ScheduledTaskInput) => Promise<void>>>
let onClose: ReturnType<typeof vi.fn<() => void>>
let slots: {
  project: ((id: string) => void) | null
  execution: ((value: PromptExecution | null) => void) | null
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  dom.act(() => {})
}
const render = (props: { initial?: ScheduledTaskRecord; projects?: typeof projects }): void => {
  dom.render(
    createElement(ScheduleTaskModal, {
      open: true,
      initial: props.initial,
      projects: props.projects ?? projects,
      pickers: {
        project: (value, onChange) => {
          slots.project = onChange
          return createElement('div', { 'data-project-slot': value ?? 'none' })
        },
        execution: (value, onChange) => {
          slots.execution = onChange
          return createElement('div', { 'data-execution-slot': value?.permissionMode ?? 'none' })
        }
      },
      onSubmit,
      onClose
    })
  )
}
const byText = (tag: string, text: string): FakeNode => {
  const found: FakeNode[] = []
  const visit = (node: FakeNode): void => {
    if (node.tag === tag && node.textContent.trim() === text) found.push(node)
    node.children.forEach(visit)
  }
  visit(dom.body)
  expect(found, `${tag} "${text}"`).toHaveLength(1)
  return found[0]!
}
const change = (node: FakeNode, value: string): void =>
  dom.act(() =>
    (node.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  )
const titleInput = (): FakeNode => dom.query('[data-schedule-title]')!
const bodyInput = (): FakeNode => {
  const node = dom.query('[data-schedule-command]')!.children.find((c) => c.tag === 'textarea')
  return node!
}
// 칩을 열고 그 메뉴의 항목을 누른다.
const pick = (marker: string, label: string): void => {
  const chip = dom.query(`[data-schedule-choice="${marker}"]`)!.querySelector('[data-menu-chip]')!
  dom.click(chip)
  const item = dom
    .queryAll('[role="menuitemradio"]')
    .find((node) => node.textContent.trim() === label)
  expect(item, `${marker} → ${label}`).toBeDefined()
  dom.click(item!)
}
const save = async (): Promise<void> => {
  dom.click(byText('button', 'common.save'))
  await flush()
}
const submitted = (): ScheduledTaskInput => {
  expect(onSubmit).toHaveBeenCalledTimes(1)
  return onSubmit.mock.calls[0]![0]
}
const hint = (): string => {
  const box = dom.query('[data-schedule-settings]')!.parent!
  return box.children
    .filter((node) => node.tag === 'p')
    .map((node) => node.textContent)
    .join('|')
}

beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1400, innerHeight: 900 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  onSubmit = vi.fn<(input: ScheduledTaskInput) => Promise<void>>(async () => undefined)
  onClose = vi.fn<() => void>()
  slots = { project: null, execution: null }
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ScheduleTaskModal — 입력이 저장 요청까지 간다', () => {
  it('제목·본문을 차례로 바꾸면 둘 다 요청에 남는다', async () => {
    render({ initial: record() })
    change(titleInput(), '야간 빌드')
    change(bodyInput(), 'echo hi')
    await save()
    expect(submitted()).toMatchObject({
      title: '야간 빌드',
      action: { kind: 'prompt', text: 'echo hi' }
    })
  })

  it('프로젝트·실행 설정 슬롯이 넘긴 값이 요청에 들어간다', async () => {
    render({ initial: record() })
    expect(dom.query('[data-project-slot="p1"]')).not.toBeNull()
    dom.act(() => slots.project!('p2'))
    dom.act(() => slots.execution!(picked))
    expect(dom.query('[data-project-slot="p2"]')).not.toBeNull()
    expect(dom.query('[data-execution-slot="plan"]')).not.toBeNull()
    await save()
    expect(submitted()).toMatchObject({
      projectId: 'p2',
      action: { kind: 'prompt', execution: picked }
    })
  })

  it('shell 로 바꾸면 요청이 shell 명령이고 실행 설정이 없다', async () => {
    render({ initial: record() })
    dom.click(dom.query('[data-schedule-kind="shell"]')!)
    expect(dom.query('[data-execution-slot]')).toBeNull()
    await save()
    expect(submitted().action).toEqual({ kind: 'shell', command: '점검해' })
  })

  it('주기·요일·시각 칩에서 고른 값이 트리거가 된다', async () => {
    render({ initial: record() })
    pick('frequency', 'schedules.modal.everyWeek')
    pick('day', 'schedules.trigger.day3')
    pick('time', '10:30')
    await save()
    expect(submitted().trigger).toEqual({ kind: 'weekly', day: 3, at: { hour: 10, minute: 30 } })
  })

  it('사용자 지정 요일은 꺼진 요일을 더하고 켜진 요일을 뺀다', async () => {
    render({
      initial: record({ trigger: { kind: 'custom', days: [1, 2], at: { hour: 9, minute: 0 } } })
    })
    dom.click(dom.query('[data-schedule-day="5"]')!)
    dom.click(dom.query('[data-schedule-day="1"]')!)
    await save()
    expect(submitted().trigger).toEqual({
      kind: 'custom',
      days: [2, 5],
      at: { hour: 9, minute: 0 }
    })
  })
})

describe('ScheduleTaskModal — 저장', () => {
  it('성공하면 검증된 요청으로 한 번 부르고 닫는다', async () => {
    render({ initial: record() })
    await save()
    expect(submitted()).toEqual({
      title: '아침 점검',
      projectId: 'p1',
      trigger: { kind: 'daily', at: { hour: 9, minute: 0 } },
      action: { kind: 'prompt', text: '점검해', execution }
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('실패하면 열린 채 문구를 띄우고 입력을 남기며, 다시 저장해 성공하면 문구를 지우고 닫는다', async () => {
    onSubmit.mockRejectedValueOnce(new Error('disk full'))
    render({ initial: record() })
    change(titleInput(), '바뀐 제목')
    await save()
    expect(onClose).not.toHaveBeenCalled()
    expect(dom.query('[role="alert"]')?.textContent).toBe('schedules.modal.saveFailed')
    expect(titleInput().props.value).toBe('바뀐 제목')

    await save()
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(dom.queryAll('[role="alert"]')).toHaveLength(0)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ScheduleTaskForm — 안내 문구', () => {
  it('프로젝트가 없으면 noProjects', () => {
    render({ projects: [] })
    expect(hint()).toBe('schedules.modal.noProjects')
  })

  it('프롬프트는 projectHint', () => {
    render({ initial: record() })
    expect(hint()).toBe('schedules.modal.projectHint')
  })

  it('shell 이고 폴더 있는 프로젝트면 shellProjectHint', () => {
    render({ initial: record({ action: { kind: 'shell', command: 'ls' } }) })
    expect(hint()).toBe('schedules.modal.shellProjectHint')
  })

  it('shell 이고 폴더 없는 프로젝트면 경고로 shellNeedsFolder', () => {
    render({ initial: record({ projectId: 'p-flat', action: { kind: 'shell', command: 'ls' } }) })
    expect(hint()).toBe('schedules.modal.shellNeedsFolder')
    expect(dom.query('[role="alert"]')?.textContent).toBe('schedules.modal.shellNeedsFolder')
  })
})
