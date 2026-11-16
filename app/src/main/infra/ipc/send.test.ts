// 창 통지 함수의 대상·채널·payload (0324 AC25). 전송 모듈 밖에서 창에 직접 보내지 않으므로
// (가드 (g)) "누구에게 어느 채널로 무엇이 나가는가"는 여기서 잠근다.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHANNELS, type NormalizedEvent } from '../../../shared/ipc'
import type { ScheduledPromptStart } from '../../../shared/scheduled-tasks'
import type { UsageDelta } from '../../../shared/usage/limits'
import { fakeClient, type FakeClient } from './client.testfixture'
import {
  broadcastChatEvent,
  broadcastHarnessAvailability,
  broadcastManagedMcpChanged,
  broadcastUsageDelta,
  sendChatEvent,
  sendInstallStatus,
  sendScheduledPromptStart
} from './send'
import { setIpcTransport } from './transport'

let first: FakeClient
let second: FakeClient
let primary: FakeClient | undefined

beforeEach(() => {
  first = fakeClient(1)
  second = fakeClient(2)
  primary = second
  setIpcTransport({
    handle: () => {},
    on: () => {},
    clients: () => [first, second],
    primaryClient: () => primary
  })
})

afterEach(() => setIpcTransport(null))

const delta: NormalizedEvent = { type: 'text.delta', sessionId: 's1', text: 'a' } as NormalizedEvent

describe('send — 대상 지정', () => {
  it('턴 이벤트는 소유 창에만 간다', () => {
    sendChatEvent(first, delta)
    expect(first.sent).toEqual([{ channel: CHANNELS.chatEvent, payload: delta }])
    expect(second.sent).toEqual([])
  })

  it('닫힌 창으로의 전송은 예외 없이 버려진다', () => {
    first.close()
    expect(() => sendChatEvent(first, delta)).not.toThrow()
    expect(() => sendInstallStatus(first, { phase: 'done' } as never)).not.toThrow()
    expect(first.sent).toEqual([])
  })

  it('설치 상태는 요청한 창의 설치 채널로 간다', () => {
    const status = { phase: 'downloading' } as never
    sendInstallStatus(second, status)
    expect(second.sent).toEqual([{ channel: CHANNELS.installStatus, payload: status }])
    expect(first.sent).toEqual([])
  })

  it('예약 프롬프트 시작은 먼저 열린 창 하나에만 간다', () => {
    const payload = { taskId: 't1' } as unknown as ScheduledPromptStart
    expect(sendScheduledPromptStart(payload)).toBe(true)
    expect(second.sent).toEqual([{ channel: CHANNELS.schedulePromptStart, payload }])
    expect(first.sent).toEqual([])
  })

  it('보낼 창이 없거나 닫혔으면 예약 프롬프트 시작은 false 다', () => {
    const payload = { taskId: 't1' } as unknown as ScheduledPromptStart
    second.close()
    expect(sendScheduledPromptStart(payload)).toBe(false)
    primary = undefined
    expect(sendScheduledPromptStart(payload)).toBe(false)
    expect(first.sent).toEqual([])
  })
})

describe('send — 방송', () => {
  it('턴 이벤트 방송은 열린 창 전부에 간다', () => {
    broadcastChatEvent(delta)
    expect(first.sent).toEqual([{ channel: CHANNELS.chatEvent, payload: delta }])
    expect(second.sent).toEqual([{ channel: CHANNELS.chatEvent, payload: delta }])
  })

  it('닫힌 창은 방송에서 빠지고 나머지는 받는다', () => {
    first.close()
    expect(() => broadcastManagedMcpChanged(3)).not.toThrow()
    expect(first.sent).toEqual([])
    expect(second.sent).toEqual([{ channel: CHANNELS.managedMcpChanged, payload: { revision: 3 } }])
  })

  it('하네스 가용성은 받은 값을 그대로 가용성 채널로 모든 창에 보낸다', () => {
    const state = {
      id: 'opencode' as const,
      installed: true,
      version: '2.0.0',
      usable: false,
      unavailableReason: 'unsupported' as const
    }
    broadcastHarnessAvailability(state)
    for (const client of [first, second]) {
      expect(client.sent).toEqual([{ channel: 'oo:harness:availability', payload: state }])
    }
  })

  it('관리 MCP 변경은 모든 창에 revision 만 보낸다', () => {
    broadcastManagedMcpChanged(7)
    for (const client of [first, second]) {
      expect(client.sent).toEqual([
        { channel: CHANNELS.managedMcpChanged, payload: { revision: 7 } }
      ])
    }
  })

  it('사용량 delta 는 받은 값을 그대로 모든 창에 보낸다', () => {
    const usage = { scope: 'x' } as unknown as UsageDelta
    broadcastUsageDelta(usage)
    for (const client of [first, second]) {
      expect(client.sent).toEqual([{ channel: CHANNELS.costUsageEvent, payload: usage }])
    }
  })
})
