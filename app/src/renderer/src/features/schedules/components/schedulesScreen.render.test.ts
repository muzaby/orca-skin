// 예약 작업 목록 화면 — 프로젝트 카탈로그와 같은 골격과 세 상태(불러오는 중·비어 있음·
// 목록)를 렌더 출력으로 본다.

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'
import { SchedulesScreen, type SchedulesScreenProps } from './SchedulesScreen'

const task = (overrides: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id: 't1',
  title: '아침 버그 요약',
  projectId: 'p1',
  trigger: { kind: 'daily', at: { hour: 9, minute: 0 } },
  action: { kind: 'shell', command: 'npm run nightly' },
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
  nextRunAt: new Date(2026, 0, 6, 9, 0).getTime(),
  running: false,
  lastRun: null,
  ...overrides
})

const render = (props: Partial<SchedulesScreenProps>): string =>
  renderToStaticMarkup(
    createElement(SchedulesScreen, {
      tasks: [],
      loading: false,
      revision: 0,
      projects: [{ id: 'p1', name: '카메라 검증', cwd: 'C:\\work\\cam' }],
      pickers: { project: () => null, execution: () => null },
      onCreate: async () => undefined,
      onUpdate: async () => undefined,
      onDelete: () => undefined,
      onSetEnabled: () => undefined,
      onRunNow: () => undefined,
      loadRuns: async () => [],
      onOpenSession: () => undefined,
      ...props
    })
  )

describe('SchedulesScreen', () => {
  it('제목·개수와 우상단 새 작업 버튼, 검색, 탭을 그린다', () => {
    const html = render({ tasks: [task(), task({ id: 't2', title: '둘째' })] })
    expect(html).toMatch(/<h1[^>]*>예약됨<span[^>]*>2개<\/span><\/h1>/)
    expect(html).toMatch(/<button[^>]*data-schedule-new=""[^>]*>.*?새 작업.*?<\/button>/s)
    // 검색 입력은 접혀 있고 여는 버튼이 보인다(프로젝트 카탈로그와 같은 동작).
    expect(html).toContain('aria-label="예약 작업 검색"')
    expect(html).toMatch(/data-schedule-tab[^>]*>전체</)
    expect(html).toMatch(/data-schedule-tab[^>]*>사용 중</)
  })

  it('불러오는 중에는 로딩 문구만 보인다', () => {
    const html = render({ loading: true })
    expect(html).toContain('불러오는 중…')
    expect(html).not.toContain('아직 예약한 작업이 없어요')
    expect(html).toContain('aria-busy="true"')
  })

  it('작업이 없으면 빈 상태와 첫 작업 만들기 버튼을 보인다', () => {
    const html = render({})
    expect(html).toContain('아직 예약한 작업이 없어요')
    expect(html).toContain('첫 작업 만들기')
    expect(html).not.toContain('불러오는 중…')
  })

  it('목록 행은 제목·트리거·프로젝트·다음 실행·토글을 보인다', () => {
    const html = render({ tasks: [task()] })
    expect(html).toContain('data-schedule-row="t1"')
    expect(html).toContain('아침 버그 요약')
    expect(html).toContain('매일 09:00')
    expect(html).toContain('카메라 검증')
    // 날짜와 시각이 함께 보인다.
    expect(html).toMatch(/data-schedule-next="">다음 실행 1월 6일 09:00</)
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/)
    expect(html).not.toContain('아직 예약한 작업이 없어요')
  })

  it('꺼진 작업·실행 중 작업·프로젝트가 지워진 작업을 구별해 보인다', () => {
    const paused = render({ tasks: [task({ enabled: false, nextRunAt: null })] })
    expect(paused).toMatch(/data-schedule-next="">일시 중지됨</)
    expect(paused).toMatch(/role="switch"[^>]*aria-checked="false"/)

    const running = render({ tasks: [task({ running: true })] })
    expect(running).toMatch(/data-schedule-next="">실행 중</)

    const orphan = render({ tasks: [task({ projectId: null })] })
    expect(orphan).toMatch(/data-schedule-project-missing=""[^>]*>프로젝트가 삭제되었습니다</)
    expect(orphan).not.toContain('카메라 검증')
  })
})

describe('SchedulesScreen — 작업 종류 아이콘', () => {
  // terminal_2 — nav 세션 행의 코드 글리프.
  const CODE_NAV_PATH =
    'M480-160v-80h320v80H480ZM220-320l-56-56 183-184-183-184 56-56 240 240-240 240Z'

  it('shell 작업 행은 nav 세션과 같은 코드 아이콘이다', () => {
    expect(render({ tasks: [task()] })).toContain(CODE_NAV_PATH)
    expect(
      render({
        tasks: [
          task({
            action: {
              kind: 'prompt',
              text: 'x',
              execution: {
                backend: 'claude',
                agentKind: 'work',
                providerKey: 'k',
                modelFamily: 'm',
                permissionMode: 'default'
              }
            }
          })
        ]
      })
    ).not.toContain(CODE_NAV_PATH)
  })
})
