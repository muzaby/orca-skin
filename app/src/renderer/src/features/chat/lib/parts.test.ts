import { describe, it, expect } from 'vitest'
import {
  partsText,
  partsReasoning,
  partsToolCalls,
  partsErrors,
  partsAttachments,
  childMessageForParentToolRunId,
  subagentTasksFromMessages,
  isAbortedResult,
  isAsyncLaunchedResult,
  deriveSubagentTaskStatus,
  messageSegments,
  modelDisplayLabel
} from './parts'
import type { ToolCall } from '../reducer/chatReducer'
import type { AppMessagePart } from '../../../../../shared/ipc'

describe('parts selectors', () => {
  it('partsAttachments 는 attachment 파트의 첨부 뷰를 순서대로 평탄화한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: 'hi' },
      {
        type: 'attachment',
        attachments: [
          { id: 'a1', name: 'pic.png', mimeType: 'image/png', kind: 'image', previewDataUrl: 'd' },
          { id: 'a2', name: 'spec.md', mimeType: 'text/markdown', kind: 'file' }
        ]
      }
    ]
    expect(partsAttachments(parts).map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(partsAttachments([{ type: 'text', text: 'x' }])).toEqual([])
  })

  it('partsText 는 text 파트만 순서대로 잇는다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: 'a' },
      { type: 'reasoning', text: 'r' },
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: {} },
      { type: 'text', text: 'b' }
    ]
    expect(partsText(parts)).toBe('ab')
  })

  it('partsReasoning 은 reasoning 파트를 순서대로, signature 보존', () => {
    const parts: AppMessagePart[] = [
      { type: 'reasoning', text: 'r1', signature: 's1' },
      { type: 'text', text: 'x' },
      { type: 'reasoning', text: 'r2' }
    ]
    expect(partsReasoning(parts)).toEqual([{ text: 'r1', signature: 's1' }, { text: 'r2' }])
  })

  it('partsToolCalls 는 tool_call 을 같은 toolRunId 의 tool_result 와 페어링한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: { cmd: 'ls' } },
      { type: 'tool_call', toolRunId: 't2', toolName: 'Read', args: { path: 'a' } },
      { type: 'tool_result', toolRunId: 't1', result: 'ok', isError: false, durationMs: 5 }
    ]
    expect(partsToolCalls(parts)).toEqual([
      {
        toolUseId: 't1',
        name: 'Bash',
        input: { cmd: 'ls' },
        result: { output: 'ok', isError: false, durationMs: 5 }
      },
      // t2 는 결과 미도착 → result 없음(실행 중)
      { toolUseId: 't2', name: 'Read', input: { path: 'a' } }
    ])
  })

  it('parentToolRunId 가 있는 child 도구는 메인 도구 목록에서 제외하고 child message 로 조회한다', () => {
    const messages = [
      {
        role: 'assistant' as const,
        createdAt: 1,
        parts: [
          {
            type: 'tool_call' as const,
            toolRunId: 'parent-task',
            toolName: 'Task',
            args: { description: 'child 분석' }
          },
          {
            type: 'tool_call' as const,
            toolRunId: 'child-read',
            toolName: 'Read',
            args: { file_path: 'README.md' },
            parentToolRunId: 'parent-task'
          },
          {
            type: 'tool_result' as const,
            toolRunId: 'child-read',
            result: 'ok',
            isError: false,
            parentToolRunId: 'parent-task'
          },
          {
            type: 'tool_result' as const,
            toolRunId: 'parent-task',
            result: { summary: 'done', agentLabel: 'Haiku 4.5', tokenCount: 20600 },
            isError: false,
            durationMs: 92_000
          }
        ]
      }
    ]

    expect(messageSegments(messages[0].parts)).toEqual([
      {
        kind: 'tools',
        calls: [
          {
            toolUseId: 'parent-task',
            name: 'Task',
            input: { description: 'child 분석' },
            result: {
              output: { summary: 'done', agentLabel: 'Haiku 4.5', tokenCount: 20600 },
              isError: false,
              durationMs: 92_000
            }
          }
        ]
      }
    ])
    // child message 의 파트는 parentToolRunId 가 벗겨져(undefined) 반환된다 — 그래야
    // messageSegments/partsToolCalls 가 우측 패널 child 트랜스크립트에서 최상위 도구로 렌더한다.
    expect(childMessageForParentToolRunId(messages, 'parent-task')?.parts).toEqual([
      {
        type: 'tool_call',
        toolRunId: 'child-read',
        toolName: 'Read',
        args: { file_path: 'README.md' },
        parentToolRunId: undefined
      },
      {
        type: 'tool_result',
        toolRunId: 'child-read',
        result: 'ok',
        isError: false,
        parentToolRunId: undefined
      }
    ])
    expect(subagentTasksFromMessages(messages)).toMatchObject([
      {
        toolUseId: 'parent-task',
        description: 'child 분석',
        status: 'completed',
        childToolCount: 1,
        toolCountLabel: '1 도구 사용',
        durationLabel: '1분 32초',
        tokenLabel: '20.6k 토큰',
        agentLabel: 'Haiku 4.5'
      }
    ])
  })

  it('child text/reasoning 은 child message 에 포함하고 메인 트랜스크립트에서는 제외한다', () => {
    const messages = [
      {
        role: 'assistant' as const,
        createdAt: 1,
        parts: [
          { type: 'text' as const, text: '서브에이전트를 호출합니다.' },
          {
            type: 'tool_call' as const,
            toolRunId: 'parent-task',
            toolName: 'Task',
            args: { description: 'child 분석' }
          },
          {
            type: 'tool_call' as const,
            toolRunId: 'child-read',
            toolName: 'Read',
            args: { file_path: 'README.md' },
            parentToolRunId: 'parent-task'
          },
          {
            type: 'text' as const,
            text: '서브에이전트 답변입니다.',
            parentToolRunId: 'parent-task'
          },
          {
            type: 'tool_result' as const,
            toolRunId: 'parent-task',
            result: { summary: 'done' },
            isError: false
          }
        ]
      }
    ]
    // 메인: child 텍스트 제외 — 최상위 텍스트만.
    expect(partsText(messages[0].parts)).toBe('서브에이전트를 호출합니다.')
    expect(messageSegments(messages[0].parts)).toEqual([
      { kind: 'text', text: '서브에이전트를 호출합니다.' },
      {
        kind: 'tools',
        calls: [
          {
            toolUseId: 'parent-task',
            name: 'Task',
            input: { description: 'child 분석' },
            result: { output: { summary: 'done' }, isError: false }
          }
        ]
      }
    ])
    // child: 도구 + 답변 텍스트가 순서대로 포함되고 parentToolRunId 는 벗겨진다.
    const child = childMessageForParentToolRunId(messages, 'parent-task')
    expect(child?.parts).toEqual([
      {
        type: 'tool_call',
        toolRunId: 'child-read',
        toolName: 'Read',
        args: { file_path: 'README.md' }
      },
      { type: 'text', text: '서브에이전트 답변입니다.' }
    ])
  })

  it('subagentTasksFromMessages 는 tool_result.subagentMeta 의 모델/시간/도구수를 쓴다', () => {
    const messages = [
      {
        role: 'assistant' as const,
        createdAt: 1,
        parts: [
          {
            type: 'tool_call' as const,
            toolRunId: 'parent-task',
            toolName: 'Task',
            args: { description: '구조 탐색', subagent_type: 'Explore' }
          },
          {
            type: 'tool_result' as const,
            toolRunId: 'parent-task',
            result: { summary: 'done' },
            isError: false,
            durationMs: 1000,
            subagentMeta: { model: 'claude-haiku-4-5', durationMs: 92_000, toolUses: 7 }
          }
        ]
      }
    ]
    expect(subagentTasksFromMessages(messages)).toMatchObject([
      {
        toolUseId: 'parent-task',
        description: '구조 탐색',
        status: 'completed',
        // 모델 = subagentMeta.model 매핑('Explore' subagent_type 이 아님).
        agentLabel: 'Haiku 4.5',
        subagentType: 'Explore',
        // 도구수·소요시간은 subagentMeta 우선(childCounts/result.durationMs 무시).
        childToolCount: 7,
        toolCountLabel: '7 도구 사용',
        durationLabel: '1분 32초'
      }
    ])
  })

  it('subagentTasksFromMessages 는 aborted 결과를 중단 상태로 분류한다', () => {
    const messages = [
      {
        role: 'assistant' as const,
        createdAt: 1,
        parts: [
          {
            type: 'tool_call' as const,
            toolRunId: 'parent-task',
            toolName: 'Task',
            args: { description: '중단 작업' }
          },
          {
            type: 'tool_result' as const,
            toolRunId: 'parent-task',
            result: { reason: 'aborted', message: '작업이 중단되었습니다.' },
            isError: true
          }
        ]
      }
    ]
    expect(subagentTasksFromMessages(messages)).toMatchObject([
      { toolUseId: 'parent-task', description: '중단 작업', status: 'aborted' }
    ])
  })

  it('subagentTasksFromMessages 는 부모 Task 메시지의 createdAt 을 createdAtMs 로 투영한다', () => {
    const messages = [
      {
        role: 'assistant' as const,
        createdAt: 1_700_000_000_000,
        parts: [
          {
            type: 'tool_call' as const,
            toolRunId: 'parent-task',
            toolName: 'Task',
            args: { description: '시간 표시' }
          }
        ]
      }
    ]
    expect(subagentTasksFromMessages(messages)).toMatchObject([
      { toolUseId: 'parent-task', createdAtMs: 1_700_000_000_000, status: 'running' }
    ])
  })

  it('isAsyncLaunchedResult 는 백그라운드 launched 결과만 true, deriveSubagentTaskStatus 는 running 으로 본다', () => {
    const launched = {
      output: { status: 'async_launched', agentId: 'agent-1', description: 'x', prompt: 'y' },
      isError: false
    }
    expect(isAsyncLaunchedResult(launched)).toBe(true)
    expect(isAsyncLaunchedResult({ output: { status: 'completed' }, isError: false })).toBe(false)
    expect(isAsyncLaunchedResult(undefined)).toBe(false)
    // 백그라운드로 막 시작된 부모 Task 는 '완료'가 아니라 '실행 중'.
    const call: ToolCall = { toolUseId: 't', name: 'Task', input: {}, result: launched }
    expect(deriveSubagentTaskStatus(call)).toBe('running')
  })

  it('isAbortedResult 는 abort 마커 결과만 true(일반 에러는 false)', () => {
    expect(isAbortedResult({ output: { reason: 'aborted' }, isError: true })).toBe(true)
    expect(isAbortedResult({ output: { reason: 'user_cancelled' }, isError: true })).toBe(true)
    expect(isAbortedResult({ output: { message: '작업이 중단되었습니다.' }, isError: true })).toBe(
      true
    )
    // 일반 도구 에러(abort 마커 없음) → false.
    expect(isAbortedResult({ output: { message: 'command failed' }, isError: true })).toBe(false)
    // 성공 결과·미도착(undefined) → false.
    expect(isAbortedResult({ output: 'ok', isError: false })).toBe(false)
    expect(isAbortedResult(undefined)).toBe(false)
  })

  it('modelDisplayLabel 은 모델 id 를 친근한 라벨로 매핑한다', () => {
    expect(modelDisplayLabel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelDisplayLabel('claude-3-5-haiku-20241022')).toBe('Haiku 3.5')
    expect(modelDisplayLabel('claude-sonnet-4-5')).toBe('Sonnet 4.5')
    expect(modelDisplayLabel('claude-opus-4-1')).toBe('Opus 4.1')
    expect(modelDisplayLabel('claude-fable-5')).toBe('Fable 5')
    expect(modelDisplayLabel('haiku')).toBe('Haiku')
    // 미인식 패밀리는 원형 보존.
    expect(modelDisplayLabel('gpt-4o')).toBe('gpt-4o')
  })

  it('partsErrors 는 error 파트의 payload 를 모은다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: 'x' },
      { type: 'error', error: { category: 'stream_error', message: 'boom' } }
    ]
    expect(partsErrors(parts)).toEqual([{ category: 'stream_error', message: 'boom' }])
  })
})

describe('messageSegments', () => {
  it('"텍스트 → 도구 → 텍스트" 순서를 분절 보존한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: '확인할게요' },
      { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: { path: 'a' } },
      { type: 'tool_result', toolRunId: 't1', result: 'ok', isError: false },
      { type: 'text', text: '완료' }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'text', text: '확인할게요' },
      {
        kind: 'tools',
        calls: [
          {
            toolUseId: 't1',
            name: 'Read',
            input: { path: 'a' },
            result: { output: 'ok', isError: false }
          }
        ]
      },
      { kind: 'text', text: '완료' }
    ])
  })

  it('연속 도구는 한 tools 세그먼트로 묶는다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Read', args: {} },
      { type: 'tool_result', toolRunId: 't1', result: 'a', isError: false },
      { type: 'tool_call', toolRunId: 't2', toolName: 'Read', args: {} },
      { type: 'tool_result', toolRunId: 't2', result: 'b', isError: false }
    ]
    const segs = messageSegments(parts)
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ kind: 'tools' })
    expect((segs[0] as { calls: unknown[] }).calls).toHaveLength(2)
  })

  it('AskUserQuestion 은 개별 ask 세그먼트로 분리한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: {} },
      { type: 'tool_call', toolRunId: 't2', toolName: 'AskUserQuestion', args: { q: '?' } }
    ]
    const segs = messageSegments(parts)
    expect(segs.map((s) => s.kind)).toEqual(['tools', 'ask'])
  })

  it('연속 reasoning 은 한 reasoning 세그먼트로 병합한다', () => {
    const parts: AppMessagePart[] = [
      { type: 'reasoning', text: 'r1', signature: 's1' },
      { type: 'reasoning', text: 'r2' },
      { type: 'text', text: 'x' }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'reasoning', items: [{ text: 'r1', signature: 's1' }, { text: 'r2' }] },
      { kind: 'text', text: 'x' }
    ])
  })

  it('error / structured_output 는 개별 세그먼트, 빈 text 는 스킵', () => {
    const parts: AppMessagePart[] = [
      { type: 'text', text: '' },
      { type: 'structured_output', value: { a: 1 } },
      { type: 'error', error: { message: 'boom' } }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'structured', value: { a: 1 } },
      { kind: 'error', error: { message: 'boom' } }
    ])
  })

  it('빈/공백 reasoning 파트는 스킵한다(빈 사고 카드 방지)', () => {
    const parts: AppMessagePart[] = [
      { type: 'reasoning', text: '' },
      { type: 'reasoning', text: '  \n  ' },
      { type: 'text', text: 'hello' }
    ]
    expect(messageSegments(parts)).toEqual([{ kind: 'text', text: 'hello' }])
  })

  it('compact_boundary / fork_boundary 는 구분선 세그먼트로 투영한다 (0064)', () => {
    const parts: AppMessagePart[] = [
      { type: 'compact_boundary', trigger: 'manual', preTokens: 155_000 },
      { type: 'fork_boundary' },
      { type: 'text', text: '이후 대화' }
    ]
    expect(messageSegments(parts)).toEqual([
      { kind: 'compact', trigger: 'manual', preTokens: 155_000 },
      { kind: 'fork' },
      { kind: 'text', text: '이후 대화' }
    ])
  })
})
