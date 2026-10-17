import { describe, it, expect } from 'vitest'
import { createSessionInputStream } from './streaming-input'

// 마이크로태스크 flush — pending Promise 가 resolve 됐는지 관찰하기 위함.
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('createSessionInputStream', () => {
  it('initial 이 주어지면 스폰 프롬프트로 먼저 yield 한다 (uuid 상관키 포함)', async () => {
    const { stream } = createSessionInputStream([{ content: 'hello', uuid: 'orca-prompt-1' }])
    const it = stream[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.done).toBe(false)
    expect(first.value).toMatchObject({
      type: 'user',
      parent_tool_use_id: null,
      priority: 'next',
      uuid: 'orca-prompt-1',
      message: { role: 'user', content: 'hello' }
    })
  })

  it('initial 없이 열 수 있다 — 첫 push 가 첫 메시지가 된다', async () => {
    const { stream, push, close } = createSessionInputStream([])
    const it = stream[Symbol.asyncIterator]()
    const pending = it.next()
    push('first')
    const first = await pending
    expect(first.value).toMatchObject({ message: { role: 'user', content: 'first' } })
    close()
  })

  it('close() 전에는 종료하지 않는다 (generator 미종료 불변식 — 세션 수명)', async () => {
    const { stream, close } = createSessionInputStream([{ content: 'hi' }])
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
    const { stream, close } = createSessionInputStream([{ content: 'x' }])
    const it = stream[Symbol.asyncIterator]()
    await it.next()
    close()
    const done = await it.next()
    expect(done.done).toBe(true)
  })

  // ── 0151 AC3: push 영수증 ───────────────────────────────────────────────────
  it('push 는 수용 시 true 를 반환한다', () => {
    const { push, close } = createSessionInputStream()
    expect(push('hello', 'u1')).toBe(true)
    close()
  })

  it('closed 스트림의 push 는 false — 조용한 no-op 이 아니다', () => {
    const { push, close } = createSessionInputStream()
    close()
    // 구 계약(void)은 여기서 조용히 삼켜, 호출자가 예약을 되돌릴 수 없었다.
    expect(push('too late', 'u1')).toBe(false)
  })

  it('closed 이후 push 한 내용은 스트림에 흘러나오지 않는다', async () => {
    const { stream, push, close } = createSessionInputStream([{ content: 'first' }])
    const it = stream[Symbol.asyncIterator]()
    await it.next()
    close()
    expect(push('dropped')).toBe(false)
    const done = await it.next()
    expect(done.done).toBe(true)
  })

  it('close() 는 멱등이다', async () => {
    const { stream, close } = createSessionInputStream([{ content: 'x' }])
    const it = stream[Symbol.asyncIterator]()
    await it.next()
    close()
    close()
    const done = await it.next()
    expect(done.done).toBe(true)
  })

  it('push(text) 는 리터럴 user 메시지를 SDK 로 전달한다(pull 이 flush 를 유발하지 않음)', async () => {
    const { stream, push, close } = createSessionInputStream([{ content: 'first' }])
    const it = stream[Symbol.asyncIterator]()
    await it.next() // 초기 메시지

    const pending = it.next()
    push('steer feedback')
    const second = await pending
    expect(second.done).toBe(false)
    expect(second.value).toMatchObject({
      type: 'user',
      parent_tool_use_id: null,
      message: { role: 'user', content: 'steer feedback' },
      priority: 'next'
    })
    close()
  })

  it('push(content, uuid) 는 uuid(orca 상관키)와 priority next 를 함께 싣는다 (0060 D1)', async () => {
    const { stream, push, close } = createSessionInputStream([{ content: 'first' }])
    const it = stream[Symbol.asyncIterator]()
    await it.next()

    const pending = it.next()
    push('steer feedback', 'orca-steer-0001')
    const second = await pending
    expect(second.value).toMatchObject({
      type: 'user',
      uuid: 'orca-steer-0001',
      priority: 'next',
      message: { role: 'user', content: 'steer feedback' }
    })
    // uuid 미지정 push 에는 uuid 를 싣지 않는다.
    const p3 = it.next()
    push('no uuid')
    const third = await p3
    expect(third.value).not.toHaveProperty('uuid')
    close()
  })

  it('close() 이후 push 는 무시된다', async () => {
    const { stream, push, close } = createSessionInputStream([{ content: 'x' }])
    const it = stream[Symbol.asyncIterator]()
    await it.next()
    close()
    push('too late')
    const done = await it.next()
    expect(done.done).toBe(true)
  })

  it('content 블록 배열(구조 페이로드)은 문자열 강제 없이 그대로 yield 된다', async () => {
    const content = [{ type: 'text' as const, text: 'hello block' }]
    const { stream, push, close } = createSessionInputStream([{ content }])
    const it = stream[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.done).toBe(false)
    expect(first.value?.message.content).toBe(content)
    // push 경로도 동일.
    const imageBlocks = [
      { type: 'text' as const, text: 'with image' },
      {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: 'image/png' as const, data: 'AAA' }
      }
    ]
    const pending = it.next()
    push(imageBlocks, 'b-1')
    const second = await pending
    expect(second.value?.message.content).toBe(imageBlocks)
    close()
  })
})
