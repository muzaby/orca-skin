import { describe, expect, it } from 'vitest'
import { SteerQueue } from './steer-queue'

describe('SteerQueue', () => {
  it('preserves order and drains multiple pending inputs as one flush', () => {
    const q = new SteerQueue()
    q.enqueue('s', ' first ', 10, 'a')
    q.enqueue('s', 'second', 20, 'b')
    expect(q.drainForFlush('s')).toEqual({
      ids: ['a', 'b'],
      text: 'first\n\nsecond',
      createdAt: 10
    })
    expect(q.drainForFlush('s')).toBeUndefined()
  })

  it('cancels one item without touching other sessions', () => {
    const q = new SteerQueue()
    q.enqueue('s', 'one', 1, 'a')
    q.enqueue('s', 'two', 2, 'b')
    q.enqueue('other', 'x', 3, 'x')
    expect(q.cancel('s', 'a')?.text).toBe('one')
    expect(q.pending('s').map((item) => item.id)).toEqual(['b'])
    expect(q.pending('other').map((item) => item.id)).toEqual(['x'])
  })
})
