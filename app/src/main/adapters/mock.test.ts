import { describe, expect, it } from 'vitest'
import type { DebugMockState, NormalizedEvent } from '../../shared/ipc'
import { MockAdapter } from './mock'

const extensions = { mcp: {}, skills: [], hooks: { normalized: {} } }

async function collect(events: AsyncIterable<NormalizedEvent>): Promise<NormalizedEvent[]> {
  const out: NormalizedEvent[] = []
  for await (const ev of events) out.push(ev)
  return out
}

describe('MockAdapter', () => {
  it('새 채팅은 sessionId 를 발급하고 resume 은 기존 sessionId 를 보존한다', async () => {
    const state: DebugMockState = {
      enabled: true,
      scenarioId: 'text_streaming',
      contextUsageRatio: 0.3,
      wireLog: false
    }
    const adapter = new MockAdapter(() => state)

    const fresh = await collect(
      adapter.sendMessage({ sessionId: null, text: 'hi', cwd: '/w', extensions }).events
    )
    const freshInit = fresh.find((ev) => ev.type === 'session.updated')
    expect(freshInit?.sessionId).toMatch(/[0-9a-f-]{36}/)

    const resumed = await collect(
      adapter.sendMessage({ sessionId: 'existing', text: 'hi', cwd: '/w', extensions }).events
    )
    expect(resumed.find((ev) => ev.type === 'session.updated')?.sessionId).toBe('existing')
  })

  it('매 턴 getState 를 읽어 scenario/context 를 반영한다', async () => {
    const state: DebugMockState = {
      enabled: true,
      scenarioId: 'error',
      contextUsageRatio: 0.3,
      wireLog: false
    }
    const adapter = new MockAdapter(() => state)
    const first = await collect(
      adapter.sendMessage({ sessionId: 's1', text: 'hi', cwd: '/w', extensions }).events
    )
    expect(first.at(-1)?.type).toBe('error')

    state.scenarioId = 'text_streaming'
    state.contextUsageRatio = 0.95
    const second = await collect(
      adapter.sendMessage({ sessionId: 's1', text: 'hi', cwd: '/w', extensions }).events
    )
    expect(second.some((ev) => ev.type === 'telemetry')).toBe(true)
  })

  it('continuityKind=handoff 는 선택 시나리오 대신 compact 도착 시퀀스를 사용한다', async () => {
    const state: DebugMockState = {
      enabled: true,
      scenarioId: 'error',
      contextUsageRatio: 0.95,
      wireLog: false
    }
    const adapter = new MockAdapter(() => state)
    const events = await collect(
      adapter.sendMessage({
        sessionId: null,
        forkFrom: 'source',
        continuityKind: 'handoff',
        text: '/compact',
        cwd: '/w',
        extensions
      }).events
    )
    expect(events.map((event) => event.type)).toEqual([
      'session.updated',
      'session.compacted',
      'message.completed',
      'telemetry'
    ])
  })

  it('interrupt 호출 시 스트림을 종료한다', async () => {
    const state: DebugMockState = {
      enabled: true,
      scenarioId: 'text_streaming',
      contextUsageRatio: 0.3,
      wireLog: false
    }
    const adapter = new MockAdapter(() => state)
    const live = adapter.sendMessage({ sessionId: 's1', text: 'hi', cwd: '/w', extensions })
    await live.interrupt()
    await expect(collect(live.events)).resolves.toEqual([])
  })

  it('requestApproval 부재 시 approval 스텝은 자동 allow 된다', async () => {
    const state: DebugMockState = {
      enabled: true,
      scenarioId: 'tool_approval',
      contextUsageRatio: 0.3,
      wireLog: false
    }
    const adapter = new MockAdapter(() => state)
    const events = await collect(
      adapter.sendMessage({ sessionId: 's1', text: 'hi', cwd: '/w', extensions }).events
    )
    expect(events.some((ev) => ev.type === 'tool.call.started')).toBe(true)
  })
})
