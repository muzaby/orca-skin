// 0319 W1 — 백그라운드 타일 카드 세 종(구 모델 카드 · 정본 작업 카드 · 정본 호출 카드)의 **틀 마크업**을
// 변경 전 코드에서 고정한다(D-014). 틀을 공용 컴포넌트로 합친 뒤에도 이 파일은 바뀌지 않아야 한다 —
// 속성 순서·접근성 이름·클래스·점·제목 행·첫 본문 행 시작이 바이트 단위로 같다는 것이 UI 회귀 0의 증거다.
//
// 시간에 따라 바뀌는 본문(경과·시각)은 접두 밖이다. 본문 자체는 기존 렌더 스위트가 본다.
// JSX 를 쓰지 않는 이유: vitest include 가 `src/**/*.test.ts` 다.

import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SubAgentTaskList } from '../../claude/rightpanel/LegacySubAgentTile'
import {
  BackgroundTaskCard,
  CanonicalBackgroundContent
} from '../../claude/rightpanel/CanonicalBackgroundContent'
import { subagentTasksFromMessages } from '../../../lib/parts'
import { useChatStore } from '../../../store/chatStore'
import { useBackgroundStore } from '../../../store/backgroundStore'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../../../shared/background-task'
import type { Message } from '../../../reducer/chatReducer'

const FRAME_CLASS =
  'group/subagent cursor-pointer rounded-r6 bg-bg2 px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover focus:outline-none hide-focus-ring ring-focus'

// 틀 접두 — 카드 div 여는 태그부터 첫 본문 행의 클래스 앞부분까지. 접근성 이름은 `{{description}} 대화록 보기`.
function framePrefix(title: string, data = ''): string {
  return (
    `<div role="button" tabindex="0" aria-label="${title} 대화록 보기" class="${FRAME_CLASS}"${data}>` +
    '<div class="flex min-w-0 items-center gap-g3">' +
    '<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-t6"></span>' +
    `<span class="min-w-0 flex-1 truncate text-body font-semibold text-t9">${title}</span></div>` +
    '<div class="mt-g1 pl-5 text-footnote'
  )
}

const source = (
  sequence: number
): {
  generation: string
  sequence: number
  receivedAt: number
  replay: false
} => ({ generation: 'gen-frame', sequence, receivedAt: sequence, replay: false })

function renderPanel(state: BackgroundSessionState): string {
  const initial = useChatStore.getInitialState()
  const session = initial.sessions[initial.activeKey].session
  const priorId = session.sessionId
  const backgrounds = useBackgroundStore.getInitialState()
  const priorViews = backgrounds.sessions
  session.sessionId = 's'
  backgrounds.sessions = { s: { state, loading: false } }
  try {
    return renderToStaticMarkup(createElement(CanonicalBackgroundContent))
  } finally {
    session.sessionId = priorId
    backgrounds.sessions = priorViews
  }
}

afterEach(() => {
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true)
})

describe('0319 W1 — background card frame markup', () => {
  it('legacy subagent card keeps the frame', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        createdAt: 1_700_000_000_000,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'legacy-run',
            toolName: 'Task',
            args: { description: '구 모델 조사' }
          }
        ]
      }
    ]
    const html = renderToStaticMarkup(
      createElement(SubAgentTaskList, {
        tasks: subagentTasksFromMessages(messages),
        stoppingIds: new Set<string>(),
        stopErrors: {}
      })
    )
    expect(html).toContain(framePrefix('구 모델 조사'))
  })

  // 제목 규칙: description → call.toolName → taskType → taskId 중 처음 참인 값. 분기마다 뒤쪽 후보를
  // 채워 둬서 순서가 바뀌면 다른 값이 나온다. 접근성 이름과 제목이 같은 값이어야 한다.
  it.each([
    [
      'description',
      'task-1',
      { description: '설명 제목', taskType: 'local_bash' },
      'Grep',
      '설명 제목'
    ],
    ['call tool name', 'task-2', { taskType: 'local_bash' }, 'Grep', 'Grep'],
    ['task type', 'task-3', { taskType: 'local_bash' }, undefined, 'local_bash'],
    ['task id', 'task-4', {}, undefined, 'task-4']
  ] as const)(
    'canonical task card keeps the frame with the %s title',
    (_branch, taskId, fields, toolName, title) => {
      let state = applyBackgroundEvent(emptyBackgroundState(), {
        type: 'background.snapshot',
        sessionId: 's',
        source: source(1),
        tasks: [{ taskId, ...fields }]
      })
      if (toolName)
        state = applyBackgroundEvent(state, {
          type: 'background.call',
          sessionId: 's',
          toolUseId: 'call-title',
          toolName,
          phase: 'started',
          source: source(2)
        })
      const task = state.tasks[backgroundKey('gen-frame', taskId)]
      const call = toolName ? state.calls[backgroundKey('gen-frame', 'call-title')] : undefined
      const html = renderToStaticMarkup(
        createElement(BackgroundTaskCard, { sessionId: 's', state, task, call })
      )
      expect(html).toContain(
        framePrefix(
          title,
          ` data-background-task="${taskId}" data-background-generation="gen-frame"`
        )
      )
    }
  )

  it('canonical call card keeps the frame', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'call-only',
      toolName: 'Bash',
      phase: 'started',
      source: source(1),
      input: { command: 'echo pending', run_in_background: true }
    })
    expect(renderPanel(state)).toContain(
      framePrefix(
        'echo pending',
        ' data-background-call="call-only" data-background-generation="gen-frame"'
      )
    )
  })
})
