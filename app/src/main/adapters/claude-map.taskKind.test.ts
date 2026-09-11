// 0230 VP-01 · VP-05 · VP-09 (R-01·R-05 ↔ AT-01·AT-02·AT-09·AT-10·AT-11 · §10 EP-01·EP-02·EP-04)
//
// 정규화가 **작업 종류**와 **셸 백그라운드 투영**을 싣는지 본다. 두 값이 없으면 하류 전부가
// "task = 서브에이전트" 로 되돌아간다 — 타일 필터·정착 게이트·추적 판정이 모두 이 두 필드를
// 읽는다.

import { describe, expect, it } from 'vitest'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

const sdk = (v: unknown): SDKMessage => v as SDKMessage
const ctx = (): MapContext => ({ sessionId: 's1', cwd: '/w' })

// 도구 호출 한 건을 먼저 흘려 `ctx` 에 경계 도구 이름을 남긴다 — 종류 판정 1순위가 그것이다.
function seedToolUse(c: MapContext, toolRunId: string, toolName: string, input: unknown): void {
  claudeToNormalized(
    sdk({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: toolRunId, name: toolName, input }] }
    }),
    c
  )
}

function taskStarted(fields: Record<string, unknown>): SDKMessage {
  return sdk({ type: 'system', subtype: 'task_started', ...fields })
}

function toolResult(toolRunId: string, content: unknown, toolUseResult?: unknown): SDKMessage {
  return sdk({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: toolRunId, content }] },
    ...(toolUseResult !== undefined ? { tool_use_result: toolUseResult } : {})
  })
}

type TaskEvent = Extract<ReturnType<typeof claudeToNormalized>[number], { type: 'subagent.task' }>
type CompletedEvent = Extract<
  ReturnType<typeof claudeToNormalized>[number],
  { type: 'tool.call.completed' }
>

describe('0230 AT-01/AT-02 — taskKind 판정', () => {
  it('AT-01: 셸 도구의 task_started 는 taskKind=shell 이다', () => {
    const c = ctx()
    seedToolUse(c, 'sh1', 'PowerShell', { command: 'npx vitest run' })
    const out = claudeToNormalized(
      taskStarted({ task_id: 't1', tool_use_id: 'sh1', task_type: 'local_bash' }),
      c
    )
    const task = out.find((e): e is TaskEvent => e.type === 'subagent.task')
    expect(task?.taskKind).toBe('shell')
  })

  it('AT-02: 도구 이름이 task_type 을 이긴다 — Agent + local_bash → agent', () => {
    const c = ctx()
    seedToolUse(c, 'ag1', 'Agent', { description: '조사', prompt: 'p' })
    const out = claudeToNormalized(
      taskStarted({ task_id: 't2', tool_use_id: 'ag1', task_type: 'local_bash' }),
      c
    )
    const task = out.find((e): e is TaskEvent => e.type === 'subagent.task')
    expect(task?.taskKind).toBe('agent')
  })

  it('도구 이름도 task_type 도 없으면 키를 싣지 않는다 — 판정 불가와 unknown 은 다르다', () => {
    const c = ctx()
    const out = claudeToNormalized(taskStarted({ task_id: 't3', tool_use_id: 'x9' }), c)
    const task = out.find((e): e is TaskEvent => e.type === 'subagent.task')
    expect(task).toBeDefined()
    expect(task && 'taskKind' in task).toBe(false)
  })

  it('task_type 만 있으면 그것으로 판정한다 — local_workflow → workflow', () => {
    const c = ctx()
    const out = claudeToNormalized(
      taskStarted({ task_id: 't4', tool_use_id: 'wf1', task_type: 'local_workflow' }),
      c
    )
    const task = out.find((e): e is TaskEvent => e.type === 'subagent.task')
    expect(task?.taskKind).toBe('workflow')
  })

  it('Monitor 는 셸과 같은 local_bash 를 써도 monitor 로 갈린다', () => {
    const c = ctx()
    seedToolUse(c, 'mo1', 'Monitor', { description: '감시', command: 'tail -f log' })
    const out = claudeToNormalized(
      taskStarted({ task_id: 't5', tool_use_id: 'mo1', task_type: 'local_bash' }),
      c
    )
    const task = out.find((e): e is TaskEvent => e.type === 'subagent.task')
    expect(task?.taskKind).toBe('monitor')
  })
})

describe('0230 AT-09/AT-10/AT-11 — 셸 백그라운드 투영', () => {
  it('AT-11: backgroundTaskId 가 있으면 structuredOutput 에 투영이 실린다(영속 경로)', () => {
    const c = ctx()
    seedToolUse(c, 'sh2', 'PowerShell', { command: 'npx vitest run' })
    const out = claudeToNormalized(
      toolResult('sh2', 'partial stdout', {
        stdout: 'partial stdout',
        stderr: '',
        backgroundTaskId: 'bg-42'
      }),
      c
    )
    const done = out.find((e): e is CompletedEvent => e.type === 'tool.call.completed')
    expect(done?.structuredOutput).toEqual({ shellBackground: { taskId: 'bg-42' } })
  })

  it('AT-09: timedOutAfterMs 가 투영에 보존된다', () => {
    const c = ctx()
    seedToolUse(c, 'sh3', 'PowerShell', { command: 'npx vitest run' })
    const out = claudeToNormalized(
      toolResult('sh3', 'partial', {
        backgroundTaskId: 'bg-43',
        timedOutAfterMs: 120_000,
        persistedOutputPath: 'C:\\tmp\\out.log'
      }),
      c
    )
    const done = out.find((e): e is CompletedEvent => e.type === 'tool.call.completed')
    expect(done?.structuredOutput).toEqual({
      shellBackground: {
        taskId: 'bg-43',
        timedOutAfterMs: 120_000,
        persistedOutputPath: 'C:\\tmp\\out.log'
      }
    })
  })

  it('AT-10 음성: backgroundTaskId 가 없는 셸 결과는 투영을 만들지 않는다', () => {
    const c = ctx()
    seedToolUse(c, 'sh4', 'PowerShell', { command: 'echo hi' })
    const out = claudeToNormalized(toolResult('sh4', 'hi', { stdout: 'hi', stderr: '' }), c)
    const done = out.find((e): e is CompletedEvent => e.type === 'tool.call.completed')
    expect(done?.structuredOutput).toBeUndefined()
  })

  it('EP-04: 원본 payload 를 그대로 싣지 않는다 — stdout 은 투영에 없다', () => {
    const c = ctx()
    seedToolUse(c, 'sh5', 'PowerShell', { command: 'npx vitest run' })
    const out = claudeToNormalized(
      toolResult('sh5', 'x'.repeat(64), { stdout: 'x'.repeat(64), backgroundTaskId: 'bg-44' }),
      c
    )
    const done = out.find((e): e is CompletedEvent => e.type === 'tool.call.completed')
    expect(JSON.stringify(done?.structuredOutput)).not.toContain('xxxx')
    // 모델용 결과(`result`)는 그대로다 — 투영이 출력을 대체하지 않는다.
    expect(done?.result).toBe('x'.repeat(64))
  })

  it('셸이 아닌 도구의 결과에는 투영을 만들지 않는다', () => {
    const c = ctx()
    seedToolUse(c, 'rd1', 'Read', { file_path: '/w/a.ts' })
    const out = claudeToNormalized(toolResult('rd1', 'file body', { backgroundTaskId: 'bg-45' }), c)
    const done = out.find((e): e is CompletedEvent => e.type === 'tool.call.completed')
    expect(done?.structuredOutput).toBeUndefined()
  })
})

describe('0230 §10 EP-06 — task_updated killed 도 종류를 싣는다', () => {
  it('killed 정착 이벤트에 taskKind 가 실린다', () => {
    const c = ctx()
    seedToolUse(c, 'sh6', 'PowerShell', { command: 'npx vitest run' })
    claudeToNormalized(
      taskStarted({ task_id: 't6', tool_use_id: 'sh6', task_type: 'local_bash' }),
      c
    )
    const out = claudeToNormalized(
      sdk({ type: 'system', subtype: 'task_updated', task_id: 't6', patch: { status: 'killed' } }),
      c
    )
    const task = out.find((e): e is TaskEvent => e.type === 'subagent.task')
    expect(task?.phase).toBe('settled')
    expect(task?.taskKind).toBe('shell')
  })
})
