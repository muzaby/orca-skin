// 부팅 시 connector 재연결 (0170). electron 없이 도는 순수 오케스트레이션이라 여기서 전량 검증한다.

import { describe, expect, it } from 'vitest'
import { restoreConnections } from './auth-restore'

function deps(overrides: Partial<Parameters<typeof restoreConnections>[0]> = {}): {
  args: Parameters<typeof restoreConnections>[0]
  connected: string[]
  loggedOut: string[]
  logs: string[]
} {
  const connected: string[] = []
  const loggedOut: string[] = []
  const logs: string[] = []
  return {
    connected,
    loggedOut,
    logs,
    args: {
      restored: [
        { bindingId: 'b1', connectorId: 'confluence-dc' },
        { bindingId: 'b2', connectorId: 'confluence-lab' }
      ],
      connect: async (input) => {
        connected.push(input.connectorId)
      },
      logout: async (bindingId) => {
        loggedOut.push(bindingId)
      },
      logger: (message) => logs.push(message),
      ...overrides
    }
  }
}

describe('restoreConnections', () => {
  it('복원된 connector 마다 한 번씩 연결한다', async () => {
    const d = deps()
    await restoreConnections(d.args)
    expect(d.connected).toEqual(['confluence-dc', 'confluence-lab'])
    expect(d.loggedOut).toEqual([])
  })

  it('연결에 실패한 binding 은 정리하고 나머지는 계속 연결한다', async () => {
    // 서버가 PAT 를 폐기하면 connect 가 던진다 — 그 binding 을 남겨 두면 UI 가 "연결됨" 이라
    // 거짓말하고 도구만 실패한다.
    const connected: string[] = []
    const loggedOut: string[] = []
    const d = deps({
      connect: async (input) => {
        if (input.connectorId === 'confluence-dc') throw new Error('401')
        connected.push(input.connectorId)
      },
      logout: async (bindingId) => {
        loggedOut.push(bindingId)
      }
    })
    await restoreConnections(d.args)
    expect(loggedOut).toEqual(['b1'])
    expect(connected).toEqual(['confluence-lab'])
  })

  it('정리마저 실패해도 다음 connector 를 계속 시도한다', async () => {
    const connected: string[] = []
    const logs: string[] = []
    const d = deps({
      connect: async (input) => {
        if (input.connectorId === 'confluence-dc') throw new Error('boom')
        connected.push(input.connectorId)
      },
      logout: async () => {
        throw new Error('cleanup boom')
      },
      logger: (message) => logs.push(message)
    })
    await restoreConnections(d.args)
    expect(connected).toEqual(['confluence-lab'])
    // 두 실패가 모두 흔적을 남긴다 — 조용히 넘어가지 않는다.
    expect(logs).toEqual(['auth.restore.connect-failed', 'auth.restore.cleanup-failed'])
  })

  it('복원 대상이 없으면 아무것도 하지 않는다', async () => {
    const d = deps({ restored: [] })
    await restoreConnections(d.args)
    expect(d.connected).toEqual([])
  })
})
