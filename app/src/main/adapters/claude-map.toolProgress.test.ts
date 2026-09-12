// 0231 VP-201 · VP-202 (R-101 ↔ AT-101·AT-102 · AR-101 · §10 EP-201)
//
// SDK 최상위 `tool_progress` 가 정규화되는가. 이 분기가 없으면 메시지는 `claudeToNormalized`
// 꼬리의 미지 메시지 드롭으로 가고 화면은 긴 도구의 경과도 재시도 대기도 말하지 못한다.
//
// **프로덕션 진입점을 부른다** — `mapToolProgress` 를 직접 부르면 그 분기가 실제로 배선됐는지는
// 잠기지 않는다(분기를 지워도 통과한다).

import { describe, expect, it } from 'vitest'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

const sdk = (v: unknown): SDKMessage => v as SDKMessage
const ctx = (): MapContext => ({ sessionId: 's1', cwd: '/w' })

const progress = (fields: Record<string, unknown>): SDKMessage =>
  sdk({ type: 'tool_progress', session_id: 's1', uuid: 'u1', ...fields })

// 경계 도구 한 건을 흘려 `ctx.taskBoundaryToolNames` 에 좌표를 남긴다.
function seedTaskTool(c: MapContext, toolRunId: string, toolName: string): void {
  claudeToNormalized(
    sdk({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: toolRunId, name: toolName, input: {} }] }
    }),
    c
  )
}

describe('0231 AR-101 — tool_progress 정규화', () => {
  it('AT-101 — 부모 Task 에 귀속되고 경과·현재 도구를 싣는다', () => {
    const c = ctx()
    const out = claudeToNormalized(
      progress({
        tool_use_id: 'inner-1',
        parent_tool_use_id: 'task-1',
        tool_name: 'Grep',
        elapsed_time_seconds: 42
      }),
      c
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      type: 'subagent.task',
      toolUseId: 'task-1',
      phase: 'progress',
      elapsedSeconds: 42,
      lastToolName: 'Grep'
    })
  })

  it('AT-102 — subagent_retry 를 싣고, 이후 heartbeat 는 그것을 덮지 않는다', () => {
    const c = ctx()
    const retryOut = claudeToNormalized(
      progress({
        tool_use_id: 'inner-1',
        parent_tool_use_id: 'task-1',
        subagent_retry: {
          agent_id: 'a1',
          attempt: 2,
          max_retries: 5,
          retry_delay_ms: 1000,
          error_status: 529,
          error_category: 'overloaded'
        }
      }),
      c
    )
    expect(retryOut[0]).toMatchObject({
      retry: { attempt: 2, maxRetries: 5, errorCategory: 'overloaded' }
    })
    // heartbeat 는 **retry 키를 싣지 않는다** — 부재는 무변경이라 store 가 해제하지 않는다.
    const beat = claudeToNormalized(
      progress({ tool_use_id: 'inner-1', parent_tool_use_id: 'task-1', heartbeat: true }),
      c
    )
    expect(beat[0]).toMatchObject({ heartbeat: true })
    expect(beat[0]).not.toHaveProperty('retry')
  })

  it('경계 도구 자신의 진행은 자기 id 로 귀속하되 tool_name 을 현재 도구로 싣지 않는다', () => {
    const c = ctx()
    seedTaskTool(c, 'sh-1', 'PowerShell')
    const out = claudeToNormalized(
      progress({ tool_use_id: 'sh-1', tool_name: 'PowerShell', elapsed_time_seconds: 7 }),
      c
    )
    expect(out[0]).toMatchObject({ toolUseId: 'sh-1', elapsedSeconds: 7 })
    // `현재 도구: PowerShell` 은 거짓이다 — 그 도구가 곧 이 작업이다.
    expect(out[0]).not.toHaveProperty('lastToolName')
  })

  it('실행 태스크에 귀속되지 않는 최상위 도구의 진행은 드롭한다', () => {
    // `Read` 같은 일반 도구에는 이 값을 읽는 카드가 없다 — 실으면 라이브 맵에 죽은 항목만 쌓인다.
    const c = ctx()
    seedTaskTool(c, 'read-1', 'Read')
    expect(
      claudeToNormalized(progress({ tool_use_id: 'read-1', elapsed_time_seconds: 3 }), c)
    ).toEqual([])
  })

  it('task_id 만 있어도 앞선 task_* 가 남긴 매핑으로 귀속한다', () => {
    const c = ctx()
    claudeToNormalized(
      sdk({ type: 'system', subtype: 'task_started', task_id: 't9', tool_use_id: 'task-9' }),
      c
    )
    const out = claudeToNormalized(progress({ task_id: 't9', elapsed_time_seconds: 11 }), c)
    expect(out[0]).toMatchObject({ toolUseId: 'task-9', elapsedSeconds: 11 })
  })

  it('부분 retry(attempt 만)는 싣지 않는다 — 화면이 "재시도 0/0" 을 말하지 않게', () => {
    const c = ctx()
    const out = claudeToNormalized(
      progress({
        tool_use_id: 'inner-1',
        parent_tool_use_id: 'task-1',
        subagent_retry: { agent_id: 'a1', attempt: 2 }
      }),
      c
    )
    expect(out[0]).not.toHaveProperty('retry')
  })
})
