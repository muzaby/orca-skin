import { describe, expect, it } from 'vitest'
import { createLimiter, mapWithLimit } from './limit'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('createLimiter', () => {
  it('동시 실행이 상한을 넘지 않는다', async () => {
    const limit = createLimiter(4)
    let active = 0
    let peak = 0
    const gates = Array.from({ length: 10 }, () => deferred<void>())

    const runs = gates.map((gate, index) =>
      limit(async () => {
        active += 1
        peak = Math.max(peak, active)
        await gate.promise
        active -= 1
        return index
      })
    )

    // 상한만큼만 진입한 상태에서 하나씩 풀어준다.
    for (const gate of gates) {
      gate.resolve()
      await Promise.resolve()
    }
    await Promise.all(runs)

    expect(peak).toBe(4)
  })

  it('상한이 항목 수보다 크면 전부 동시에 돈다', async () => {
    const limit = createLimiter(10)
    let active = 0
    let peak = 0
    const gates = Array.from({ length: 3 }, () => deferred<void>())
    const runs = gates.map((gate) =>
      limit(async () => {
        active += 1
        peak = Math.max(peak, active)
        await gate.promise
        active -= 1
      })
    )
    for (const gate of gates) gate.resolve()
    await Promise.all(runs)
    expect(peak).toBe(3)
  })

  it('작업이 던져도 슬롯을 반환한다', async () => {
    const limit = createLimiter(1)
    await expect(
      limit(async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    // 슬롯이 새면 이 호출이 영영 대기한다.
    await expect(limit(async () => 'ok')).resolves.toBe('ok')
  })

  it('상한이 1 미만이면 만들 때 거부한다', () => {
    expect(() => createLimiter(0)).toThrow(/1 이상/)
    expect(() => createLimiter(1.5)).toThrow(/정수/)
  })
})

describe('mapWithLimit', () => {
  it('하나가 실패해도 나머지가 진행된다', async () => {
    const results = await mapWithLimit([1, 2, 3, 4], 2, async (n) => {
      if (n === 2) throw new Error(`fail-${n}`)
      return n * 10
    })

    expect(results.map((r) => r.ok)).toEqual([true, false, true, true])
    expect(results.filter((r) => r.ok).map((r) => (r.ok ? r.value : null))).toEqual([10, 30, 40])
    const failure = results[1]
    expect(failure.ok).toBe(false)
    if (!failure.ok) expect(failure.error.message).toBe('fail-2')
  })

  it('입력 순서를 보존한다', async () => {
    // 늦게 끝나는 항목이 앞에 있어도 결과 위치가 바뀌지 않는다.
    const results = await mapWithLimit([30, 20, 10], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms))
      return ms
    })
    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([30, 20, 10])
  })

  it('빈 입력은 빈 결과를 준다', async () => {
    expect(await mapWithLimit([], 4, async () => 1)).toEqual([])
  })
})
