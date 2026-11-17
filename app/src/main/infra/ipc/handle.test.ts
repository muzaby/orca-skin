// handle() 검증 실패 로그 경로 (0124 AC6) — 'reject'/fallback 양 정책에서 ipc.payload.rejected
// warn 이 기록되고, 유효 payload 는 무기록으로 통과하는지 검증한다. 등록은 테스트 전송(케이스마다
// 새로 — `scripts/vitest-setup.mjs`)이 받는다.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handle, handlePlain, on, setHandleClock } from './handle'
import { fakeClient } from './client.testfixture'
import { currentTestTransport } from './test-transport.testfixture'
import { setRootLogger, getLogger } from '../log/registry'
import type { AppLogger } from '../log/log-manager'

// 등록된 리스너를 그대로 부른다 — 동기 반환·동기 throw 를 본다.
const call = (channel: string, raw: unknown): unknown =>
  currentTestTransport().listener(channel)({ sender: fakeClient(), trusted: true }, raw)
const deliver = (channel: string, raw: unknown): void =>
  currentTestTransport().receiver(channel)({ sender: fakeClient(), trusted: true }, raw)

const warns: Array<{ event: string; data?: Record<string, unknown> }> = []
const infos: Array<{ event: string; data?: Record<string, unknown> }> = []

function fakeLogger(): AppLogger {
  const logger: AppLogger = {
    debug: () => {},
    info: (event, data) => infos.push({ event, ...(data ? { data } : {}) }),
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
  warns.length = 0
  infos.length = 0
  setRootLogger(fakeLogger())
})

afterEach(() => {
  setHandleClock()
  setRootLogger(null)
})

describe('handle() invalid payload logging (0124 AC6)', () => {
  it("'reject' 정책 — reject 하면서 ipc.payload.rejected warn 을 남긴다", async () => {
    handle('oo:test:reject', schema, 'reject', (data: string) => data.length)
    await expect(call('oo:test:reject', 42)).rejects.toThrow('invalid')
    expect(warns).toEqual([
      {
        event: 'ipc.payload.rejected',
        data: { channel: 'oo:test:reject', policy: 'reject' }
      }
    ])
  })

  it('fallback 정책 — 폴백을 반환하면서 warn 을 남긴다', async () => {
    handle('oo:test:fallback', schema, { fallback: -1 }, (data: string) => data.length)
    await expect(call('oo:test:fallback', 42)).resolves.toBe(-1)
    expect(warns).toEqual([
      {
        event: 'ipc.payload.rejected',
        data: { channel: 'oo:test:fallback', policy: 'fallback' }
      }
    ])
  })

  it('유효 payload 는 무기록으로 통과한다', async () => {
    handle('oo:test:ok', schema, 'reject', (data: string) => data.length)
    await expect(call('oo:test:ok', 'abcd')).resolves.toBe(4)
    expect(warns).toHaveLength(0)
  })

  it('registry 미초기화(no-op 로거)에서도 throw 하지 않는다', async () => {
    setRootLogger(null)
    handle('oo:test:noop', schema, { fallback: 0 }, (data: string) => data.length)
    await expect(call('oo:test:noop', 42)).resolves.toBe(0)
    expect(getLogger()).toBeDefined()
  })
})

// 0324 AC6 — 등록 함수 셋 모두 핸들러의 동기 구간을 재고, 예산 이상이면 채널 이름을 싣는다.
describe('동기 구간 계측 (0324 AC6)', () => {
  // 핸들러가 도는 동안 시계를 `elapsedMs` 만큼 민다.
  function slowBy(elapsedMs: number): () => void {
    let now = 1_000
    setHandleClock(() => now)
    return () => {
      now += elapsedMs
    }
  }
  const stall = (
    channel: string,
    durationMs: number,
    severity: string
  ): { event: string; data: Record<string, unknown> } => ({
    event: 'perf.stall',
    data: { thread: 'main', source: 'ipc', durationMs, severity, label: channel }
  })

  it('handle — 60ms 걸린 핸들러는 채널 이름이 실린 기록 1건을 남긴다', async () => {
    const spend = slowBy(60)
    handle('oo:test:slow', schema, 'reject', (data: string) => {
      spend()
      return data.length
    })
    await expect(call('oo:test:slow', 'ab')).resolves.toBe(2)
    expect(infos).toEqual([stall('oo:test:slow', 60, 'long')])
  })

  it('handlePlain — 60ms 걸린 핸들러는 채널 이름이 실린 기록 1건을 남긴다', () => {
    const spend = slowBy(60)
    handlePlain('oo:test:plain', () => {
      spend()
      return 'ok'
    })
    expect(call('oo:test:plain', undefined)).toBe('ok')
    expect(infos).toEqual([stall('oo:test:plain', 60, 'long')])
  })

  it('on — 60ms 걸린 수신 핸들러는 채널 이름이 실린 기록 1건을 남긴다', () => {
    const spend = slowBy(60)
    const seen: string[] = []
    on('oo:test:on', schema, (data: string) => {
      spend()
      seen.push(data)
    })
    deliver('oo:test:on', 'x')
    expect(seen).toEqual(['x'])
    expect(infos).toEqual([stall('oo:test:on', 60, 'long')])
  })

  it('예산 미만(49ms)은 기록하지 않고 160ms 이상은 severe 다', async () => {
    const fast = slowBy(49)
    handlePlain('oo:test:fast', () => fast())
    call('oo:test:fast', undefined)
    expect(infos).toHaveLength(0)

    const slow = slowBy(160)
    handlePlain('oo:test:severe', () => slow())
    call('oo:test:severe', undefined)
    expect(infos).toEqual([stall('oo:test:severe', 160, 'severe')])
  })

  it('핸들러가 던져도 구간은 기록된다', () => {
    const spend = slowBy(70)
    handlePlain('oo:test:throw', () => {
      spend()
      throw new Error('boom')
    })
    expect(() => call('oo:test:throw', undefined)).toThrow('boom')
    expect(infos).toEqual([stall('oo:test:throw', 70, 'long')])
  })
})
