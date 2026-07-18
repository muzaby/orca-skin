// handle() 검증 실패 로그 경로 (0124 AC6) — 'reject'/fallback 양 정책에서 ipc.payload.rejected
// warn 이 기록되고, 유효 payload 는 무기록으로 통과하는지 검증한다. electron 은 mock.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type InvokeListener = (event: unknown, raw: unknown) => Promise<unknown>
const handlers = new Map<string, InvokeListener>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: InvokeListener) => {
      handlers.set(channel, listener)
    },
    on: vi.fn()
  }
}))

import { handle } from './handle'
import { setRootLogger, getLogger } from '../log/registry'
import type { AppLogger } from '../log/log-manager'

const warns: Array<{ event: string; data?: Record<string, unknown> }> = []

function fakeLogger(): AppLogger {
  const logger: AppLogger = {
    debug: () => {},
    info: () => {},
    warn: (event, data) => warns.push({ event, ...(data ? { data } : {}) }),
    error: () => {},
    child: () => logger
  }
  return logger
}

const schema = {
  safeParse: (raw: unknown) =>
    typeof raw === 'string'
      ? { success: true as const, data: raw }
      : { success: false as const, error: new Error('invalid') }
}

beforeEach(() => {
  handlers.clear()
  warns.length = 0
  setRootLogger(fakeLogger())
})

afterEach(() => {
  setRootLogger(null)
})

describe('handle() invalid payload logging (0124 AC6)', () => {
  it("'reject' 정책 — reject 하면서 ipc.payload.rejected warn 을 남긴다", async () => {
    handle('orca:test:reject', schema, 'reject', (data: string) => data.length)
    await expect(handlers.get('orca:test:reject')!({}, 42)).rejects.toThrow('invalid')
    expect(warns).toEqual([
      {
        event: 'ipc.payload.rejected',
        data: { channel: 'orca:test:reject', policy: 'reject' }
      }
    ])
  })

  it('fallback 정책 — 폴백을 반환하면서 warn 을 남긴다', async () => {
    handle('orca:test:fallback', schema, { fallback: -1 }, (data: string) => data.length)
    await expect(handlers.get('orca:test:fallback')!({}, 42)).resolves.toBe(-1)
    expect(warns).toEqual([
      {
        event: 'ipc.payload.rejected',
        data: { channel: 'orca:test:fallback', policy: 'fallback' }
      }
    ])
  })

  it('유효 payload 는 무기록으로 통과한다', async () => {
    handle('orca:test:ok', schema, 'reject', (data: string) => data.length)
    await expect(handlers.get('orca:test:ok')!({}, 'abcd')).resolves.toBe(4)
    expect(warns).toHaveLength(0)
  })

  it('registry 미초기화(no-op 로거)에서도 throw 하지 않는다', async () => {
    setRootLogger(null)
    handle('orca:test:noop', schema, { fallback: 0 }, (data: string) => data.length)
    await expect(handlers.get('orca:test:noop')!({}, 42)).resolves.toBe(0)
    expect(getLogger()).toBeDefined()
  })
})
