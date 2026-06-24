import type {
  ApprovalResolution,
  ClassifiedError,
  MockScenarioId,
  NormalizedEvent,
  PermissionAction,
  ProviderReportedTelemetry
} from '../../shared/ipc'

export type MockStep =
  | { kind: 'emit'; event: MockEventTemplate }
  | { kind: 'delay'; ms: number }
  | {
      kind: 'approval'
      action: PermissionAction
      allow?: MockStep[] | ((resolution: ApprovalResolution) => MockStep[])
      deny?: MockStep[] | ((resolution: ApprovalResolution) => MockStep[])
    }
  | { kind: 'telemetry' }

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
type MockEventTemplate = DistributiveOmit<NormalizedEvent, 'sessionId'> & {
  sessionId?: string
}

export interface MockCtx {
  sessionId: string
  cwd: string
  contextUsageRatio: number
  signal?: AbortSignal
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  requestApproval?: (action: PermissionAction) => Promise<ApprovalResolution>
}

const PROVIDER = 'claude' as const
const MODEL = 'mock-sonnet'
const CONTEXT_WINDOW = 200_000

export const SCENARIOS: Record<MockScenarioId, MockStep[]> = {
  text_streaming: [
    ...prelude(),
    ...textFragment(),
    ...closing('안녕하세요. 텍스트 스트리밍 mock 응답입니다.')
  ],
  reasoning: [
    ...prelude(),
    ...reasoningFragment(),
    ...closing('추론 블록을 포함한 mock 응답입니다.')
  ],
  tool_calls: [...prelude(), ...toolCallsFragment()],
  tool_approval: [...prelude(), ...toolApprovalFragment()],
  ask_question: [...prelude(), ...askQuestionFragment()],
  plan_review: [...prelude(), planApproval('mock-plan-1', '1. 요구사항 확인\n2. 구현\n3. 테스트')],
  subagent_task: [...prelude(), ...subagentTaskFragment()],
  subagent_task_child: [...prelude(), ...subagentTaskChildFragment()],
  subagent_task_aborted: [...prelude(), ...subagentTaskAbortedFragment()],
  subagent_task_multi: [...prelude(), ...subagentTaskMultiFragment()],
  error: [...prelude(), ...errorFragment()],
  full: [
    ...prelude(),
    emit({ type: 'message.delta', delta: { text: '전체 시나리오를 시작합니다.' } }),
    ...textFragment(),
    ...reasoningFragment(),
    ...toolCallsFragment(),
    ...toolApprovalFragment(),
    ...askQuestionFragment(),
    ...planReviewFragment(),
    ...errorJumpFragment()
  ]
}

function textFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '안녕하세요. ' } }),
    delay(80),
    emit({ type: 'message.delta', delta: { text: '텍스트 스트리밍 mock 응답입니다.' } }),
    delay(80)
  ]
}

function reasoningFragment(): MockStep[] {
  return [
    emit({ type: 'message.reasoning.delta', delta: { text: '먼저 요청을 분해하고 ' } }),
    delay(80),
    emit({ type: 'message.reasoning.delta', delta: { text: '필요한 도구를 확인합니다.' } }),
    emit({ type: 'message.reasoning', text: '먼저 요청을 분해하고 필요한 도구를 확인합니다.' })
  ]
}

function toolCallsFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '파일을 읽어보겠습니다.' } }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-read-1',
      toolName: 'Read',
      args: { file_path: 'README.md' }
    }),
    delay(120),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-read-1',
      result: { content: '# Orca\nMock file result' },
      isError: false,
      durationMs: 120
    })
  ]
}

function toolApprovalFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '위험 도구 실행 권한을 요청합니다.' } }),
    {
      kind: 'approval',
      action: {
        kind: 'tool_approval',
        toolName: 'Bash',
        input: { command: 'rm -rf /tmp/mock-orca-debug' }
      },
      allow: [
        emit({
          type: 'tool.call.started',
          toolRunId: 'mock-bash-1',
          toolName: 'Bash',
          args: { command: 'rm -rf /tmp/mock-orca-debug' }
        }),
        delay(120),
        emit({
          type: 'tool.call.completed',
          toolRunId: 'mock-bash-1',
          result: { stdout: 'mock ok' },
          isError: false,
          durationMs: 120
        })
      ],
      deny: []
    }
  ]
}

function askQuestionFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '진행 방향을 선택해 주세요.' } }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-ask-1',
      toolName: 'AskUserQuestion',
      args: {
        questions: [
          {
            question: '어떤 방식으로 진행할까요?',
            header: '진행 방식',
            multiSelect: false,
            options: [
              { label: '빠르게', description: '핵심만 처리합니다.' },
              { label: '꼼꼼히', description: '검증을 더 강화합니다.' }
            ]
          }
        ]
      }
    }),
    {
      kind: 'approval',
      action: {
        kind: 'ask_question',
        request: {
          requestId: '',
          questions: [
            {
              question: '어떤 방식으로 진행할까요?',
              header: '진행 방식',
              multiSelect: false,
              options: [
                { label: '빠르게', description: '핵심만 처리합니다.' },
                { label: '꼼꼼히', description: '검증을 더 강화합니다.' }
              ]
            }
          ]
        }
      },
      allow: (resolution) => [
        emit({
          type: 'message.delta',
          delta: {
            text: `답변을 반영했습니다: ${JSON.stringify(
              resolution.behavior === 'allow'
                ? (resolution.updatedInput ?? { answers: {} })
                : { answers: {} }
            )}`
          }
        })
      ],
      deny: [
        emit({
          type: 'message.delta',
          delta: { text: '질문이 건너뛰어져 기본 경로로 진행합니다.' }
        })
      ]
    }
  ]
}

function subagentTaskFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '검토용 서브에이전트를 호출합니다.' } }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-subagent-task-1',
      toolName: 'Task',
      args: {
        description: '로그 분석 서브에이전트',
        prompt: '최근 실행 로그를 점검하고 실패 원인을 요약해줘.',
        subagent_type: 'explorer'
      }
    }),
    delay(120),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-subagent-task-1',
      result: {
        summary: '최근 실행 로그에서 재시도 가능한 네트워크 오류 1건을 확인했습니다.',
        findings: ['timeout after 30s', 'retryable network error', 'no data corruption']
      },
      isError: false,
      durationMs: 120
    }),
    ...closing('서브에이전트 검토 결과를 반영했습니다.')
  ]
}

function childReadSteps(parentToolRunId: string, toolRunId: string, filePath: string): MockStep[] {
  return [
    emit({
      type: 'tool.call.started',
      toolRunId,
      parentToolRunId,
      toolName: 'Read',
      args: { file_path: filePath }
    }),
    delay(60),
    emit({
      type: 'tool.call.completed',
      toolRunId,
      parentToolRunId,
      result: { content: `mock child content from ${filePath}` },
      isError: false,
      durationMs: 60
    })
  ]
}

function subagentTaskChildFragment(): MockStep[] {
  return [
    emit({
      type: 'message.delta',
      delta: { text: '서브에이전트 child transcript 를 재현합니다.' }
    }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-subagent-child-parent',
      toolName: 'Task',
      args: {
        description: 'child transcript 수집',
        prompt: 'README 와 로그를 읽고 요약해줘.',
        subagent_type: 'explorer'
      }
    }),
    ...childReadSteps('mock-subagent-child-parent', 'mock-subagent-child-read', 'README.md'),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-subagent-child-parent',
      result: { summary: 'child transcript 수집 완료' },
      isError: false,
      durationMs: 180
    }),
    ...closing('child transcript 검토가 끝났습니다.')
  ]
}

function subagentTaskAbortedFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '중단되는 서브에이전트를 재현합니다.' } }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-subagent-aborted-parent',
      toolName: 'Task',
      args: {
        description: '중단 경로 검증',
        prompt: '긴 로그 분석을 시작하지만 중간에 중단됩니다.',
        subagent_type: 'explorer'
      }
    }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-subagent-aborted-child',
      parentToolRunId: 'mock-subagent-aborted-parent',
      toolName: 'Bash',
      args: { command: 'sleep 30 && tail -100 app.log' }
    }),
    delay(60),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-subagent-aborted-child',
      parentToolRunId: 'mock-subagent-aborted-parent',
      result: { message: '작업이 중단되었습니다.', reason: 'aborted' },
      isError: true,
      durationMs: 60
    }),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-subagent-aborted-parent',
      result: { message: '서브에이전트가 중단되었습니다.', reason: 'aborted' },
      isError: true,
      durationMs: 80
    })
  ]
}

function subagentTaskMultiFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '복수 서브에이전트를 순차 실행합니다.' } }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-subagent-multi-a',
      toolName: 'Task',
      args: { description: '문서 점검', prompt: '문서를 읽어줘.', subagent_type: 'explorer' }
    }),
    ...childReadSteps('mock-subagent-multi-a', 'mock-subagent-multi-a-read', 'docs/PRD.md'),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-subagent-multi-a',
      result: { summary: '문서 점검 완료' },
      isError: false,
      durationMs: 120
    }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-subagent-multi-b',
      toolName: 'Task',
      args: {
        description: '테스트 점검',
        prompt: '테스트 로그를 확인해줘.',
        subagent_type: 'explorer'
      }
    }),
    ...childReadSteps('mock-subagent-multi-b', 'mock-subagent-multi-b-read', 'app/test.log'),
    emit({
      type: 'tool.call.completed',
      toolRunId: 'mock-subagent-multi-b',
      result: { summary: '테스트 점검 완료' },
      isError: false,
      durationMs: 140
    }),
    ...closing('복수 서브에이전트 검토가 끝났습니다.')
  ]
}

function planReviewFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '계획을 검토해 주세요.' } }),
    {
      kind: 'approval',
      action: {
        kind: 'plan_review',
        request: {
          requestId: 'mock-full-plan',
          plan: '1. 텍스트\n2. 추론\n3. 도구\n4. 승인\n5. 질문'
        }
      },
      allow: [
        emit({ type: 'message.delta', delta: { text: '계획 승인 후 다음 단계로 진행합니다.' } })
      ],
      deny: [
        emit({ type: 'message.delta', delta: { text: '계획 거부 후에도 에러 점프를 재현합니다.' } })
      ]
    }
  ]
}

function errorFragment(): MockStep[] {
  return [
    emit({ type: 'message.delta', delta: { text: '처리 중입니다…' } }),
    delay(80),
    emit({ type: 'message.delta', delta: { text: '문제가 발생했습니다.' } }),
    emit({ type: 'error', error: mockError('mock stream retryable error') })
  ]
}

function errorJumpFragment(): MockStep[] {
  return [
    emit({
      type: 'message.delta',
      delta: { text: '마지막 도구 호출에서 에러 점프를 재현합니다.' }
    }),
    emit({
      type: 'tool.call.started',
      toolRunId: 'mock-error-jump',
      toolName: 'Bash',
      args: { command: 'exit 1' }
    }),
    emit({ type: 'error', error: mockError('full scenario tool error jump') })
  ]
}

export async function* runScenario(
  steps: MockStep[],
  ctx: MockCtx
): AsyncGenerator<NormalizedEvent> {
  for (const step of steps) {
    if (ctx.signal?.aborted) return
    if (step.kind === 'emit') {
      yield withEnvelope(step.event, ctx)
      continue
    }
    if (step.kind === 'delay') {
      await (ctx.sleep ?? sleep)(step.ms, ctx.signal)
      continue
    }
    if (step.kind === 'telemetry') {
      yield withEnvelope({ type: 'telemetry', usage: usageForRatio(ctx.contextUsageRatio) }, ctx)
      continue
    }

    const resolution = ctx.requestApproval
      ? await ctx.requestApproval(step.action)
      : ({ behavior: 'allow' } satisfies ApprovalResolution)
    if (ctx.signal?.aborted || (resolution.behavior === 'deny' && resolution.interrupt)) return
    const branch = resolution.behavior === 'allow' ? step.allow : step.deny
    const branchSteps = typeof branch === 'function' ? branch(resolution) : (branch ?? [])
    yield* runScenario(branchSteps, ctx)
  }
}

function prelude(): MockStep[] {
  return [emit({ type: 'session.updated', patch: { model: MODEL } })]
}

function closing(text: string): MockStep[] {
  return [emit({ type: 'message.completed', message: { text } }), { kind: 'telemetry' }]
}

function planApproval(requestId: string, plan: string): MockStep {
  return {
    kind: 'approval',
    action: { kind: 'plan_review', request: { requestId, plan } },
    allow: [
      emit({
        type: 'tool.call.started',
        toolRunId: 'mock-plan-exec',
        toolName: 'TodoWrite',
        args: { todos: ['요구사항 확인', '구현', '테스트'] }
      }),
      emit({
        type: 'tool.call.completed',
        toolRunId: 'mock-plan-exec',
        result: { ok: true },
        isError: false,
        durationMs: 20
      }),
      ...closing('계획이 승인되어 실행을 시작했습니다.')
    ],
    deny: (resolution) => {
      if (resolution.behavior === 'deny' && resolution.interrupt) return []
      return [
        emit({
          type: 'message.delta',
          delta: {
            text: `피드백 반영: ${resolution.behavior === 'deny' ? (resolution.message ?? '수정') : '수정'}`
          }
        }),
        {
          kind: 'approval',
          action: {
            kind: 'plan_review',
            request: {
              requestId: `${requestId}-revise`,
              plan: `${plan}\n4. 피드백 반영: ${
                resolution.behavior === 'deny' ? (resolution.message ?? '수정 요청') : '수정 요청'
              }`
            }
          },
          allow: [...closing('수정 계획이 승인되었습니다.')],
          deny: [...closing('수정 계획도 거부되어 중단합니다.')]
        }
      ]
    }
  }
}

function emit(event: MockEventTemplate): MockStep {
  return { kind: 'emit', event }
}

function delay(ms: number): MockStep {
  return { kind: 'delay', ms }
}

function withEnvelope(event: MockEventTemplate, ctx: MockCtx): NormalizedEvent {
  const sessionId = 'sessionId' in event && event.sessionId ? event.sessionId : ctx.sessionId
  if (event.type === 'session.updated') {
    return {
      ...event,
      sessionId,
      patch: { ...event.patch, cwd: event.patch.cwd ?? ctx.cwd }
    } as NormalizedEvent
  }
  return { ...event, sessionId } as NormalizedEvent
}

function usageForRatio(ratio: number): ProviderReportedTelemetry {
  const total = Math.round(ratio * CONTEXT_WINDOW)
  const cacheReadTokens = Math.floor(total * 0.2)
  const cacheCreationTokens = Math.floor(total * 0.1)
  const inputTokens = total - cacheReadTokens - cacheCreationTokens
  const outputTokens = Math.max(1, Math.round(total * 0.01))
  return {
    model: MODEL,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd: 0,
    modelUsage: {
      [MODEL]: {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd: 0
      }
    }
  }
}

function mockError(message: string): ClassifiedError {
  return {
    category: 'stream_error',
    message,
    retryable: true,
    provider: PROVIDER
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        resolve()
      },
      { once: true }
    )
  })
}
