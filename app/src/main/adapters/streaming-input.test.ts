import { describe, it, expect } from 'vitest'
import { createTurnInputStream } from './streaming-input'

// 마이크로태스크 flush — pending Promise 가 resolve 됐는지 관찰하기 위함.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('createTurnInputStream', () => {
  it('이 턴의 user 메시지 1건을 먼저 yield 한다', async () => {
    const { stream } = createTurnInputStream('hello')
    const it = stream[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.done).toBe(false)
    expect(first.value).toMatchObject({
      type: 'user',
      parent_tool_use_id: null,
      message: { role: 'user', content: 'hello' }
    })
  })

  it('close() 전에는 종료하지 않는다 (generator 미종료 불변식)', async () => {
    const { stream, close } = createTurnInputStream('hi')
    const it = stream[Symbol.asyncIterator]()
    await it.next() // 초기 메시지 소비

    let settled = false
    const pending = it.next().then((r) => {
      settled = true
      return r
    })
    await flush()
    expect(settled).toBe(false) // 아직 열려있음

    close()
    const done = await pending
    expect(done.done).toBe(true)
  })

  it('이미 메시지를 다 소비한 뒤 close() 하면 즉시 종료한다', async () => {
    const { stream, close } = createTurnInputStream('x')
    const it = stream[Symbol.asyncIterator]()
    await it.next()
    close()
    const done = await it.next()
    expect(done.done).toBe(true)
  })

  it('close() 는 멱등이다', async () => {
    const { stream, close } = createTurnInputStream('x')
    const it = stream[Symbol.asyncIterator]()
    await it.next()
    close()
    close()
    const done = await it.next()
    expect(done.done).toBe(true)
  })
})
