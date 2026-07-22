// 0143 — 재로드 위생: settled 로 덮이지 않은 async_launched 영수증을 로드 시 aborted 로 정착.
import { describe, expect, it } from 'vitest'
import { partsToolCalls, settleStaleAsyncLaunchParts, deriveSubagentTaskStatus } from './parts'
import type { AppMessagePart } from '../../../../../shared/ipc'

const agentCall = (toolRunId = 'p1'): AppMessagePart => ({
  type: 'tool_call',
  toolRunId,
  toolName: 'Agent',
  args: { subagent_type: 'Explore', description: '조사' }
})

const receipt = (toolRunId = 'p1'): AppMessagePart => ({
  type: 'tool_result',
  toolRunId,
  result: { status: 'async_launched', agentId: 'a1' },
  isError: false
})

describe('settleStaleAsyncLaunchParts (0143)', () => {
  it('settled 미도착 영수증은 aborted 합성 결과로 덮인다(재시작 = 태스크 소멸)', () => {
    const parts = settleStaleAsyncLaunchParts([agentCall(), receipt()])
    const calls = partsToolCalls(parts)
    expect(calls).toHaveLength(1)
    expect(deriveSubagentTaskStatus(calls[0])).toBe('aborted')
  })

  it('권위 결과로 이미 정착된 태스크는 건드리지 않는다', () => {
    const settledParts: AppMessagePart[] = [
      agentCall(),
      receipt(),
      { type: 'tool_result', toolRunId: 'p1', result: { summary: '완료' }, isError: false }
    ]
    const parts = settleStaleAsyncLaunchParts(settledParts)
    expect(parts).toBe(settledParts) // 합성 없음 — 입력 identity 보존
    expect(deriveSubagentTaskStatus(partsToolCalls(parts)[0])).toBe('completed')
  })

  it('결과 자체가 없는 미완 도구는 소관 밖(no-op — settleOrphanToolParts 담당)', () => {
    const open: AppMessagePart[] = [agentCall()]
    expect(settleStaleAsyncLaunchParts(open)).toBe(open)
  })

  it('Agent/Task 외 일반 도구의 유사 출력은 건드리지 않는다', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolRunId: 't1', toolName: 'Bash', args: {} },
      { type: 'tool_result', toolRunId: 't1', result: { status: 'async_launched' }, isError: false }
    ]
    expect(settleStaleAsyncLaunchParts(parts)).toBe(parts)
  })
})
