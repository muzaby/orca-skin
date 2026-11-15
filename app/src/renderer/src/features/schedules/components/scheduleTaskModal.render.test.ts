// 새 작업 모달 본문 — 필드 구성과 명령 종류·트리거 선택에 따른 조건부 입력.
// 모달 셸은 portal 이라 본문(`ScheduleTaskForm`)을 직접 그린다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import { emptyForm, type ScheduleFormState } from '../lib/scheduleForm'
import { ScheduleTaskForm } from './ScheduleTaskModal'

const execution: PromptExecution = {
  backend: 'claude',
  agentKind: 'work',
  providerKey: 'claude:team',
  modelFamily: 'claude-sonnet-5-5',
  effort: 'low',
  permissionMode: 'plan'
}
const projects = [
  { id: 'p-folder', name: '카메라 검증', cwd: 'C:\\work\\cam' },
  { id: 'p-flat', name: '메모', cwd: null }
]

const render = (patch: Partial<ScheduleFormState>): string =>
  renderToStaticMarkup(
    createElement(ScheduleTaskForm, {
      form: { ...emptyForm(), ...patch },
      projects,
      // 슬롯이 받은 값을 그대로 드러내 운반을 본다.
      pickers: {
        project: (value) => createElement('div', { 'data-project-picker': value ?? 'none' }),
        execution: (value) =>
          createElement('div', {
            'data-picker': '',
            'data-permission': value?.permissionMode ?? 'none',
            'data-model': value?.modelFamily ?? 'none'
          })
      },
      onChange: () => undefined
    })
  )

describe('ScheduleTaskForm — 필드 구성', () => {
  it('제목·프로젝트·트리거·명령 입력과 두 명령 종류를 그린다', () => {
    const html = render({})
    expect(html).toContain('예: 아침 버그 요약')
    // 프로젝트 칩은 pages 가 넣는 슬롯이고 고른 값을 받는다.
    expect(html).toContain('data-project-picker="none"')
    expect(render({ projectId: 'p-folder' })).toContain('data-project-picker="p-folder"')
    expect(html).not.toContain('<select')
    expect(html).toContain('data-schedule-trigger=""')
    expect(html).toMatch(/data-schedule-kind="prompt"[^>]*>프롬프트</)
    expect(html).toMatch(/data-schedule-kind="shell"[^>]*>shell 명령</)
  })

  it('프롬프트일 때만 실행 설정 입력이 보이고 저장된 값을 받는다', () => {
    const prompt = render({ kind: 'prompt', execution })
    expect(prompt).toContain('data-schedule-form="prompt"')
    expect(prompt).toContain('data-permission="plan"')
    expect(prompt).toContain('data-model="claude-sonnet-5-5"')
    expect(prompt).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*data-schedule-kind="prompt"/)
    expect(prompt).toContain('실행할 때마다 에이전트가 할 일을 적어 주세요')
    expect(prompt).not.toContain('PowerShell')

    const shell = render({ kind: 'shell', execution })
    expect(shell).toContain('data-schedule-form="shell"')
    expect(shell).not.toContain('data-picker')
    expect(shell).not.toContain('data-schedule-execution')
    expect(shell).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*data-schedule-kind="shell"/)
    expect(shell).toContain('예: npm run nightly-check')
    expect(shell).toContain('PowerShell')
  })

  it('shell 인데 폴더 없는 프로젝트면 사유를 알린다', () => {
    expect(render({ kind: 'shell', projectId: 'p-flat' })).toContain(
      'shell 명령은 폴더가 있는 프로젝트에서만 실행할 수 있습니다.'
    )
    expect(render({ kind: 'shell', projectId: 'p-folder' })).not.toContain('role="alert"')
    expect(render({ kind: 'prompt', projectId: 'p-flat' })).not.toContain('role="alert"')
  })
})

describe('ScheduleTaskForm — 배치', () => {
  const order = (html: string, markers: string[]): number[] =>
    markers.map((marker) => html.indexOf(marker))

  it('큰 제목 입력 → 설정 칩 한 줄 → 트리거 → 명령 순서로 놓인다', () => {
    const html = render({ kind: 'prompt', execution })
    const positions = order(html, [
      'data-schedule-title=""',
      'data-schedule-settings=""',
      'data-schedule-trigger=""',
      'data-schedule-command=""'
    ])
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    // 제목은 쌓인 라벨 없이 접근성 이름만 갖는다.
    expect(html).toMatch(/<input[^>]*data-schedule-title=""[^>]*aria-label="제목"/)
    expect(html).not.toMatch(/<label/)
  })

  it('프로젝트와 실행 설정이 같은 칩 줄에 있고 그 밑에 안내가 한 줄 있다', () => {
    const html = render({ kind: 'prompt', execution })
    const row = html.split('data-schedule-settings=""')[1]!.split('data-schedule-trigger')[0]!
    expect(row).toContain('data-project-picker=')
    expect(row).toContain('data-picker')
    expect(row).toContain('고른 프로젝트 폴더에서, 고른 모델과 권한으로 실행합니다.')
    expect(render({ kind: 'shell' })).toContain('고른 프로젝트 폴더에서 명령을 실행합니다.')
  })

  it('사용자 지정 요일은 한 묶음 안의 토글 일곱 개다', () => {
    const html = render({ triggerKind: 'custom', days: [1] })
    const group = html.split('data-schedule-days=""')[1]!.split('</div>')[0]!
    expect(html).toMatch(/role="group"[^>]*aria-label="요일"[^>]*data-schedule-days=""/)
    expect(group.match(/data-schedule-day="/g)).toHaveLength(7)
  })
})

describe('ScheduleTaskForm — 트리거', () => {
  // 트리거 카드 안의 선택 칩과 각 칩이 보이는 현재 값.
  const choices = (html: string): Record<string, string> =>
    Object.fromEntries(
      [
        ...html
          .split('data-schedule-trigger')[1]!
          .split('data-schedule-command')[0]!
          .matchAll(
            /data-schedule-choice="(\w+)"[\s\S]*?<span class="min-w-0 truncate[^"]*">([^<]*)</g
          )
      ].map((match) => [match[1]!, match[2]!])
    )

  it('매시간은 주기만 고른다', () => {
    const html = render({ triggerKind: 'hourly' })
    expect(choices(html)).toEqual({ frequency: '매시간' })
    expect(html).not.toMatch(/GMT[+-]\d/)
    expect(html).not.toContain('data-schedule-day')
  })

  it('매일은 시각과 로컬 오프셋을 보인다', () => {
    const html = render({ triggerKind: 'daily', at: { hour: 9, minute: 30 } })
    expect(choices(html)).toEqual({ frequency: '매일', time: '09:30' })
    expect(html).toMatch(/GMT[+-]\d/)
  })

  it('매주는 요일 하나와 시각을 고른다', () => {
    const html = render({ triggerKind: 'weekly', day: 3 })
    expect(choices(html)).toEqual({ frequency: '매주', day: '수', time: '09:00' })
  })

  it('사용자 지정은 요일 다중 선택과 시각을 보인다', () => {
    const html = render({ triggerKind: 'custom', days: [1, 5] })
    expect(html.match(/data-schedule-day="/g)).toHaveLength(7)
    expect(html).toMatch(/aria-pressed="true" data-schedule-day="1"/)
    expect(html).toMatch(/aria-pressed="true" data-schedule-day="5"/)
    expect(html).toMatch(/aria-pressed="false" data-schedule-day="2"/)
    expect(html).toContain('매주 반복')
    expect(choices(html)).toEqual({ frequency: '사용자 지정', time: '09:00' })
    expect(html).toMatch(/GMT[+-]\d/)
  })
})
