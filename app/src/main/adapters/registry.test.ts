import { describe, it, expect } from 'vitest'
import { AdapterRegistry } from './registry'

const makeRegistry = (): AdapterRegistry => new AdapterRegistry(() => () => undefined)

describe('AdapterRegistry capability 서술', () => {
  it('describeActive() 는 활성 백엔드(claude)의 서술자를 반환', () => {
    const reg = makeRegistry()
    const desc = reg.describeActive()
    expect(desc).not.toBeNull()
    expect(desc?.provider).toBe('claude')
  })

  it('describeAll() 은 등록된 모든 백엔드의 서술자를 키로 보유', () => {
    const reg = makeRegistry()
    const all = reg.describeAll()
    expect(all['claude'].provider).toBe('claude')
    expect(all['claude'].cancellation.sessionAbort).toBe(true)
  })
})
