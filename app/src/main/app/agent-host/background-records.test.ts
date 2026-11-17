import { describe, expect, it, vi } from 'vitest'
import type { BackgroundEvent } from '../../../shared/background-task'
import { createBackgroundRecords } from './background-records'

// 0324 EP-16′ — 백그라운드 작업 기록의 동기 복원 읽기.
const event = (taskId: string): BackgroundEvent => ({ taskId }) as unknown as BackgroundEvent

describe('백그라운드 작업 기록', () => {
  it('받아 둔 기록은 동기 읽기가 한 번만 쓴다 — 다음 읽기는 비어 있다', async () => {
    const read = vi.fn(async () => [event('t1')])
    const records = createBackgroundRecords({ read, hasCanonical: () => false })
    expect(records.load('s1')).toEqual([])
    await records.prefetch('s1')
    expect(read).toHaveBeenCalledExactlyOnceWith('s1')
    expect(records.load('s1')).toEqual([event('t1')])
    expect(records.load('s1')).toEqual([])
  })

  it('다시 받으면 현재 기록으로 바뀐다(한 번 받고 끝나지 않는다)', async () => {
    let current = [event('old')]
    const records = createBackgroundRecords({
      read: async () => current,
      hasCanonical: () => false
    })
    await records.prefetch('s1')
    current = [event('old'), event('new')]
    await records.prefetch('s1')
    expect(records.load('s1')).toEqual([event('old'), event('new')])
  })

  it('정본이 메모리에 있으면 받지 않고, 받는 사이 정본이 생기면 버린다', async () => {
    let canonical = true
    const read = vi.fn(async () => {
      canonical = true
      return [event('late')]
    })
    const records = createBackgroundRecords({ read, hasCanonical: () => canonical })
    await records.prefetch('s1')
    expect(read).not.toHaveBeenCalled()
    canonical = false
    await records.prefetch('s1')
    expect(read).toHaveBeenCalledOnce()
    expect(records.load('s1')).toEqual([])
  })

  it('잊은 세션의 기록은 버린다', async () => {
    const records = createBackgroundRecords({
      read: async () => [event('t1')],
      hasCanonical: () => false
    })
    await records.prefetch('s1')
    records.forget('s1')
    expect(records.load('s1')).toEqual([])
  })
})
