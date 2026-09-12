// 0231 VP-204 · VP-205 (MD-103 ↔ UT · R-102 ↔ AT-103·AT-104 · §10 EP-202)
//
// 진행 스냅샷이 store 의 라이브 메타로 **교체 병합**되는가. 어댑터가 `summary` 를 싣는데도
// renderer 가 버리던 것이 F-05 였다.
//
// **프로덕션 진입점(`ingestChatEvent`)을 쓴다** — `patchSubagentMeta` 는 모듈 내부라 직접 부르면
// 코얼레서·라우팅을 지나는 배선이 잠기지 않는다.

import { beforeEach, describe, expect, it } from 'vitest'
import { ingestChatEvent, useChatStore } from './chatStore'
import { flushRaf, installChatStoreHarness } from './chatStore.testHarness'
import type { NormalizedEvent } from '../../../../../shared/ipc'

const TASK = 'task-1'

const meta = (): Record<string, unknown> | undefined =>
  useChatStore.getState().sessions.s.subagentMeta[TASK] as Record<string, unknown> | undefined

function push(ev: Partial<Extract<NormalizedEvent, { type: 'subagent.task' }>>): void {
  ingestChatEvent({
    type: 'subagent.task',
    sessionId: 's',
    toolUseId: TASK,
    phase: 'progress',
    ...ev
  } as NormalizedEvent)
  flushRaf()
}

beforeEach(() => {
  installChatStoreHarness()
})

describe('0231 EP-202 — 진행 스냅샷 흡수', () => {
  it('AT-103 — summary 를 흡수한다', () => {
    push({ summary: '인증 모듈을 분석하는 중' })
    expect(meta()).toMatchObject({ summary: '인증 모듈을 분석하는 중' })
  })

  it('summary 는 **교체**다 — 두 번째가 첫 번째를 이긴다', () => {
    push({ summary: '첫 번째' })
    push({ summary: '두 번째' })
    expect(meta()?.summary).toBe('두 번째')
  })

  it('AT-104 — 두 번째 usage 스냅샷이 첫 번째에 더해지지 않는다', () => {
    push({ durationMs: 1000, toolUses: 3 })
    push({ durationMs: 1500, toolUses: 5 })
    // 누적이면 2500 · 8 이 된다. 스냅샷 의미상 마지막 값이 곧 총량이다.
    expect(meta()).toMatchObject({ durationMs: 1500, toolUses: 5 })
  })

  it('elapsedSeconds 도 교체다', () => {
    push({ elapsedSeconds: 10 })
    push({ elapsedSeconds: 25 })
    expect(meta()?.elapsedSeconds).toBe(25)
  })

  it('AT-102 — retry 는 이후 heartbeat 만 와도 해제되지 않는다', () => {
    push({ retry: { attempt: 2, maxRetries: 5, errorCategory: 'overloaded' } })
    push({ heartbeat: true, elapsedSeconds: 30 })
    expect(meta()).toMatchObject({ retry: { attempt: 2, maxRetries: 5 } })
    // 경과는 계속 흐른다 — heartbeat 가 아무것도 안 하는 것은 아니다.
    expect(meta()?.elapsedSeconds).toBe(30)
  })

  it('retry 는 새 attempt 로 갱신되고 정착으로 해제된다', () => {
    push({ retry: { attempt: 2, maxRetries: 5, errorCategory: 'overloaded' } })
    push({ retry: { attempt: 3, maxRetries: 5, errorCategory: 'overloaded' } })
    expect(meta()?.retry).toMatchObject({ attempt: 3 })
    push({ phase: 'settled', status: 'completed' })
    expect(meta()).not.toHaveProperty('retry')
  })

  it('부재는 무변경이다 — 뒤이은 이벤트가 앞선 값을 지우지 않는다', () => {
    push({ summary: '남아 있어야 한다', elapsedSeconds: 5 })
    push({ heartbeat: true })
    expect(meta()).toMatchObject({ summary: '남아 있어야 한다', elapsedSeconds: 5 })
  })
})
