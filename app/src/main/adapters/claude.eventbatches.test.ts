// 0165 AC5 — **한 SDK 메시지 = 한 배치**. 정규화가 한 메시지에서 여러 이벤트를 만들 때
// (`result` → `[telemetry, error]`) 그 묶음이 쪼개지면 SessionRuntime 이 첫 terminal 에서 프레임을
// 닫고 나머지가 프레임 밖으로 새어 **다음 턴에 귀속**된다(보고 ①).
import { describe, it, expect, vi } from 'vitest'

const { queryMock, messages } = vi.hoisted(() => {
  const messages: unknown[] = []
  return {
    messages,
    queryMock: vi.fn(() => ({
      async *[Symbol.asyncIterator]() {
        for (const msg of messages) yield msg
      },
      setPermissionMode: vi.fn(),
      interrupt: vi.fn(),
      setModel: vi.fn()
    }))
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'
import type { ProviderMessageBatch } from './types'

const baseReq = (): TurnRequest => ({
  sessionId: 's1',
  text: 'hello',
  cwd: '/tmp',
  extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
})

async function collectBatches(): Promise<ProviderMessageBatch[]> {
  const live = new ClaudeAdapter().sendMessage(baseReq())
  const out: ProviderMessageBatch[] = []
  for await (const batch of live.eventBatches) out.push(batch)
  return out
}

describe('ClaudeAdapter — provider 메시지 원자 배치 (AC5)', () => {
  it('한 SDK 메시지가 만든 이벤트는 **한 배치**로 나온다 — 실패 result 의 telemetry+error', async () => {
    messages.length = 0
    messages.push({
      type: 'result',
      subtype: 'error_during_execution',
      session_id: 's1',
      duration_ms: 10,
      is_error: true,
      num_turns: 1,
      usage: { input_tokens: 1, output_tokens: 1 }
    })

    const batches = await collectBatches()
    const failing = batches.filter((batch) => batch.events.some((ev) => ev.type === 'error'))
    expect(failing).toHaveLength(1)
    // 쪼개지지 않았다 — terminal 두 개가 같은 배치 안에 있다.
    expect(failing[0].events.map((ev) => ev.type)).toEqual(['telemetry', 'error'])
  })

  it('sequence 는 배치마다 단조 증가한다 — 라우팅이 순서를 신뢰할 수 있어야 한다', async () => {
    messages.length = 0
    messages.push(
      {
        type: 'assistant',
        session_id: 's1',
        message: { content: [{ type: 'text', text: '안녕' }] }
      },
      {
        type: 'result',
        subtype: 'success',
        session_id: 's1',
        duration_ms: 10,
        is_error: false,
        num_turns: 1,
        usage: { input_tokens: 1, output_tokens: 1 }
      }
    )

    const batches = await collectBatches()
    expect(batches.length).toBeGreaterThanOrEqual(2)
    expect(batches.map((batch) => batch.sequence)).toEqual(batches.map((_, index) => index))
  })

  it('이벤트를 만들지 않는 SDK 메시지는 빈 배치를 내지 않는다', async () => {
    messages.length = 0
    messages.push({ type: 'system', subtype: 'unknown_kind', session_id: 's1' })
    const batches = await collectBatches()
    expect(batches.every((batch) => batch.events.length > 0)).toBe(true)
  })
})
