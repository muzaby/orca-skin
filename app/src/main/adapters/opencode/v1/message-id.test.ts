import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let createOpenCodeMessageId: () => string

beforeEach(async () => {
  vi.resetModules()
  const module = await import('./message-id')
  createOpenCodeMessageId = module.createOpenCodeMessageId
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OpenCode 1.x ascending message IDs', () => {
  it.each([
    [0, '000000000001'],
    [1, '000000001001'],
    [1_792_000_000_000, '13b860000001']
  ])('encodes the native lower six-byte timestamp/counter vector at %i ms', (timestamp, prefix) => {
    vi.spyOn(Date, 'now').mockReturnValue(timestamp)
    expect(createOpenCodeMessageId().slice(0, 16)).toBe(`msg_${prefix}`)
  })

  it('increments the same-millisecond counter before the random suffix', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_792_000_000_000)
    const ids = Array.from({ length: 3 }, () => createOpenCodeMessageId())
    expect(ids.map((id) => id.slice(4, 16))).toEqual([
      '13b860000001',
      '13b860000002',
      '13b860000003'
    ])
    expect(ids[0]! < ids[1]!).toBe(true)
    expect(ids[1]! < ids[2]!).toBe(true)
  })

  it('resets the counter on the next millisecond and sorts after the preceding IDs', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_792_000_000_000)
    createOpenCodeMessageId()
    const previous = createOpenCodeMessageId()
    now.mockReturnValue(1_792_000_000_001)
    const next = createOpenCodeMessageId()
    expect(next.slice(0, 16)).toBe('msg_13b860001001')
    expect(previous < next).toBe(true)
  })

  it('produces a msg prefix, twelve hexadecimal digits and fourteen base62 random characters', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_792_000_000_000)
    for (let index = 0; index < 32; index++) {
      const id = createOpenCodeMessageId()
      expect(id).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
      expect(id).toHaveLength(30)
    }
  })
})
