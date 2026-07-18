import { describe, expect, it } from 'vitest'
import { serializeError } from './serialize-error'

describe('serializeError', () => {
  it('Error 의 name/message/stack/code 를 보존한다', () => {
    const err = new Error('boom') as Error & { code?: string }
    err.code = 'E_BOOM'
    const out = serializeError(err)
    expect(out.name).toBe('Error')
    expect(out.message).toBe('boom')
    expect(out.code).toBe('E_BOOM')
    expect(out.stack).toContain('boom')
  })

  it('cause 체인을 깊이 제한(3)까지 따라간다', () => {
    const e4 = new Error('level4')
    const e3 = new Error('level3', { cause: e4 })
    const e2 = new Error('level2', { cause: e3 })
    const e1 = new Error('level1', { cause: e2 })
    const e0 = new Error('level0', { cause: e1 })
    const out = serializeError(e0)
    expect(out.cause?.message).toBe('level1')
    expect(out.cause?.cause?.message).toBe('level2')
    expect(out.cause?.cause?.cause?.message).toBe('level3')
    // 깊이 초과 지점은 절단 마커.
    expect(out.cause?.cause?.cause?.cause?.message).toBe('[cause depth exceeded]')
  })

  it('비-Error 값을 UnknownError 로 감싼다', () => {
    expect(serializeError('plain string')).toEqual({
      name: 'UnknownError',
      message: 'plain string'
    })
    expect(serializeError({ reason: 'x' }).message).toContain('reason')
    expect(serializeError(undefined).name).toBe('UnknownError')
  })

  it('직렬화 불가 객체도 throw 없이 문자열화한다', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => serializeError(cyclic)).not.toThrow()
    expect(serializeError(cyclic).name).toBe('UnknownError')
  })

  it('string code 가 아닌 code 는 버린다', () => {
    const err = new Error('x') as Error & { code?: unknown }
    err.code = 42
    expect(serializeError(err).code).toBeUndefined()
  })
})
