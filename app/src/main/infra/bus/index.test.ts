import { describe, it, expect, vi } from 'vitest'
import { TypedBus } from './index'

interface M {
  evt: number
}

describe('TypedBus', () => {
  it('리스너를 등록 순서대로 동기 실행한다', () => {
    const bus = new TypedBus<M>()
    const order: string[] = []
    bus.on('evt', () => order.push('a'))
    bus.on('evt', () => order.push('b'))
    bus.on('evt', () => order.push('c'))
    bus.emit('evt', 1)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('critical 리스너 throw 는 전파되고 이후 리스너는 실행되지 않는다', () => {
    const bus = new TypedBus<M>()
    const after = vi.fn()
    bus.on(
      'evt',
      () => {
        throw new Error('boom')
      },
      { critical: true }
    )
    bus.on('evt', after)
    expect(() => bus.emit('evt', 1)).toThrow('boom')
    expect(after).not.toHaveBeenCalled()
  })

  it('non-critical 리스너 throw 는 격리되고 이후 리스너는 계속 실행된다', () => {
    const bus = new TypedBus<M>()
    const after = vi.fn()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    bus.on('evt', () => {
      throw new Error('boom')
    }) // 기본 non-critical
    bus.on('evt', after)
    expect(() => bus.emit('evt', 1)).not.toThrow()
    expect(after).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('해제 함수 호출 후에는 리스너가 실행되지 않는다', () => {
    const bus = new TypedBus<M>()
    const fn = vi.fn()
    const off = bus.on('evt', fn)
    off()
    bus.emit('evt', 1)
    expect(fn).not.toHaveBeenCalled()
  })

  it('payload 를 그대로 전달하고, 구독자 없으면 no-op', () => {
    const bus = new TypedBus<M>()
    const fn = vi.fn()
    expect(() => bus.emit('evt', 1)).not.toThrow()
    bus.on('evt', fn)
    bus.emit('evt', 42)
    expect(fn).toHaveBeenCalledWith(42)
  })
})
