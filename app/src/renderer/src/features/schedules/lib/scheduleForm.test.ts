import { describe, expect, it } from 'vitest'
import type { PromptExecution, ScheduledTaskRecord } from '../../../../../shared/scheduled-tasks'
import { en } from '../../../shared/i18n/resources/en'
import { ko } from '../../../shared/i18n/resources/ko'
import {
  emptyForm,
  formFromTask,
  TIME_OPTIONS,
  toggleDay,
  triggerFromForm,
  validateForm,
  type ScheduleFormState
} from './scheduleForm'
import { formatDateTime, formatTimeOfDay, triggerSummary, utcOffsetLabel } from './triggerLabel'

const projects = [
  { id: 'p-folder', name: '폴더 있음', cwd: 'C:\\work\\a' },
  { id: 'p-flat', name: '폴더 없음', cwd: null }
]
const execution: PromptExecution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'claude-sonnet-5-5',
  effort: 'low',
  permissionMode: 'plan'
}
const valid = (patch: Partial<ScheduleFormState> = {}): ScheduleFormState => ({
  ...emptyForm(),
  title: '아침 요약',
  projectId: 'p-folder',
  body: '요약해 줘',
  execution,
  ...patch
})

describe('트리거 선택 → TriggerSpec', () => {
  it.each<[string, Partial<ScheduleFormState>, unknown]>([
    ['매시간', { triggerKind: 'hourly' }, { kind: 'hourly' }],
    [
      '매일 + 시각',
      { triggerKind: 'daily', at: { hour: 7, minute: 30 } },
      { kind: 'daily', at: { hour: 7, minute: 30 } }
    ],
    [
      '매주 + 요일 + 시각',
      { triggerKind: 'weekly', day: 4, at: { hour: 18, minute: 0 } },
      { kind: 'weekly', day: 4, at: { hour: 18, minute: 0 } }
    ],
    [
      '사용자 지정 요일 다중 (정렬)',
      { triggerKind: 'custom', days: [5, 1, 2], at: { hour: 9, minute: 0 } },
      { kind: 'custom', days: [1, 2, 5], at: { hour: 9, minute: 0 } }
    ]
  ])('%s', (_name, patch, trigger) => {
    expect(triggerFromForm(valid(patch))).toEqual(trigger)
  })

  it('요일 토글은 넣고 빼며 오름차순을 유지한다', () => {
    expect(toggleDay([1, 5], 3)).toEqual([1, 3, 5])
    expect(toggleDay([1, 3, 5], 3)).toEqual([1, 5])
    expect(toggleDay([], 0)).toEqual([0])
  })

  it('시각 선택지는 30분 단위 48개다', () => {
    expect(TIME_OPTIONS).toHaveLength(48)
    expect(TIME_OPTIONS[0]).toEqual({ hour: 0, minute: 0 })
    expect(TIME_OPTIONS[19]).toEqual({ hour: 9, minute: 30 })
    expect(TIME_OPTIONS.at(-1)).toEqual({ hour: 23, minute: 30 })
  })
})

describe('폼 검증', () => {
  it('프롬프트 작업 요청을 실행 설정째로 만든다', () => {
    expect(validateForm(valid({ title: '  아침 요약  ' }), projects)).toEqual({
      ok: true,
      request: {
        title: '아침 요약',
        projectId: 'p-folder',
        trigger: { kind: 'hourly' },
        action: { kind: 'prompt', text: '요약해 줘', execution }
      }
    })
  })

  it('shell 작업 요청은 실행 설정을 싣지 않는다', () => {
    const result = validateForm(valid({ kind: 'shell', body: 'npm test' }), projects)
    expect(result).toEqual({
      ok: true,
      request: {
        title: '아침 요약',
        projectId: 'p-folder',
        trigger: { kind: 'hourly' },
        action: { kind: 'shell', command: 'npm test' }
      }
    })
  })

  it.each<[string, Partial<ScheduleFormState>, string]>([
    ['빈 제목', { title: '   ' }, 'title'],
    ['121자 제목', { title: 'a'.repeat(121) }, 'title'],
    ['프로젝트 미선택', { projectId: null }, 'project'],
    ['목록에 없는 프로젝트', { projectId: 'gone' }, 'project'],
    ['폴더 없는 프로젝트의 shell', { kind: 'shell', projectId: 'p-flat' }, 'project_no_folder'],
    ['빈 명령', { body: '  \n ' }, 'body'],
    ['8001자 명령', { body: 'a'.repeat(8001) }, 'body'],
    ['모델 없는 프롬프트', { execution: null }, 'execution'],
    ['요일 없는 사용자 지정', { triggerKind: 'custom', days: [] }, 'trigger']
  ])('막는다: %s', (_name, patch, issue) => {
    expect(validateForm(valid(patch), projects)).toEqual({ ok: false, issue })
  })

  it('경계값은 통과한다', () => {
    expect(
      validateForm(valid({ title: 'a'.repeat(120), body: 'a'.repeat(8000) }), projects).ok
    ).toBe(true)
    // 프롬프트는 폴더가 없어도 된다.
    expect(validateForm(valid({ projectId: 'p-flat' }), projects).ok).toBe(true)
    // shell 은 모델이 없어도 된다.
    expect(validateForm(valid({ kind: 'shell', execution: null }), projects).ok).toBe(true)
  })
})

describe('편집 초기값', () => {
  const record = (overrides: Partial<ScheduledTaskRecord>): ScheduledTaskRecord => ({
    id: 't',
    title: '주간 보고',
    projectId: 'p-folder',
    trigger: { kind: 'custom', days: [2, 4], at: { hour: 17, minute: 30 } },
    action: { kind: 'prompt', text: '보고서 써 줘', execution },
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  })

  it.each<[string, Partial<ScheduledTaskRecord>]>([
    ['사용자 지정 프롬프트', {}],
    ['매시간 shell', { trigger: { kind: 'hourly' }, action: { kind: 'shell', command: 'ls' } }],
    ['매일', { trigger: { kind: 'daily', at: { hour: 6, minute: 0 } } }],
    ['매주', { trigger: { kind: 'weekly', day: 0, at: { hour: 23, minute: 30 } } }]
  ])('저장값 → 폼 → 요청이 원래 작업과 같다: %s', (_name, overrides) => {
    const task = record(overrides)
    const result = validateForm(formFromTask(task), projects)
    expect(result).toEqual({
      ok: true,
      request: {
        title: task.title,
        projectId: task.projectId,
        trigger: task.trigger,
        action: task.action
      }
    })
  })
})

describe('트리거 요약 문구', () => {
  const tr = ((key: string, vars?: Record<string, unknown>) =>
    key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], ko)!
      .toString()
      .replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(vars?.[name]))) as never

  it('네 형태를 사람이 읽는 문장으로 옮긴다', () => {
    expect(triggerSummary({ kind: 'hourly' }, tr)).toBe('매시간')
    expect(triggerSummary({ kind: 'daily', at: { hour: 9, minute: 0 } }, tr)).toBe('매일 09:00')
    expect(triggerSummary({ kind: 'weekly', day: 1, at: { hour: 9, minute: 5 } }, tr)).toBe(
      '매주 월 09:05'
    )
    expect(
      triggerSummary({ kind: 'custom', days: [1, 2, 5], at: { hour: 18, minute: 30 } }, tr)
    ).toBe('매주 월·화·금 18:30')
  })

  it('시각과 UTC 오프셋 표기', () => {
    expect(formatTimeOfDay({ hour: 0, minute: 0 })).toBe('00:00')
    const at = new Date(2026, 0, 6, 9, 0).getTime()
    expect(formatDateTime(at, 'ko')).toBe('1월 6일 09:00')
    expect(formatDateTime(at, 'en')).toBe('Jan 6, 09:00')
    expect(formatDateTime(new Date(2026, 0, 6, 0, 5).getTime(), 'en')).toBe('Jan 6, 00:05')
    expect(utcOffsetLabel(540)).toBe('GMT+9')
    expect(utcOffsetLabel(-210)).toBe('GMT-3:30')
    expect(utcOffsetLabel(0)).toBe('GMT+0')
  })

  it('en 리소스가 ko 와 같은 키를 갖는다', () => {
    const keys = (node: object, prefix = ''): string[] =>
      Object.entries(node).flatMap(([key, value]) =>
        typeof value === 'object' && value !== null
          ? keys(value as object, `${prefix}${key}.`)
          : [`${prefix}${key}`]
      )
    expect(keys(en.schedules)).toEqual(keys(ko.schedules))
  })
})
