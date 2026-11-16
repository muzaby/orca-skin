// 창 통지 함수의 채널·payload 형상. 전송 모듈 밖에서 창에 직접 보내지 않으므로(0324 가드 (g))
// "어느 채널에 무엇이 나가는가"는 여기서 잠근다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent: Array<{ id: number; channel: string; payload: unknown }> = []
const contents = [1, 2].map((id) => ({
  id,
  isDestroyed: () => false,
  send: (channel: string, payload: unknown) => sent.push({ id, channel, payload })
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  webContents: { getAllWebContents: () => contents }
}))

import { CHANNELS } from '../../../shared/ipc'
import type { UsageDelta } from '../../../shared/usage/limits'
import { broadcastManagedMcpChanged, broadcastUsageDelta } from './send'

beforeEach(() => {
  sent.length = 0
})

describe('send — 방송', () => {
  it('관리 MCP 변경은 모든 창에 revision 만 보낸다', () => {
    broadcastManagedMcpChanged(7)
    expect(sent).toEqual([
      { id: 1, channel: CHANNELS.managedMcpChanged, payload: { revision: 7 } },
      { id: 2, channel: CHANNELS.managedMcpChanged, payload: { revision: 7 } }
    ])
  })

  it('사용량 delta 는 받은 값을 그대로 모든 창에 보낸다', () => {
    const delta = { scope: 'x' } as unknown as UsageDelta
    broadcastUsageDelta(delta)
    expect(sent).toEqual([
      { id: 1, channel: CHANNELS.costUsageEvent, payload: delta },
      { id: 2, channel: CHANNELS.costUsageEvent, payload: delta }
    ])
  })
})
