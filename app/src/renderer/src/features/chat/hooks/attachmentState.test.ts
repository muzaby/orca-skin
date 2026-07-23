import { describe, expect, it } from 'vitest'
import { clearAttachmentsIfUnchanged } from './attachmentState'

describe('clearAttachmentsIfUnchanged', () => {
  it('연속 submit마다 새 current identity를 받아 다시 clear할 수 있다', () => {
    const submitted = [{ name: 'first' }]
    const firstClear = clearAttachmentsIfUnchanged(submitted, submitted)

    expect(firstClear).toEqual([])
    expect(firstClear).not.toBeNull()
    expect(clearAttachmentsIfUnchanged(firstClear!, firstClear!)).toEqual([])
  })

  it('submit 뒤 attachment가 바뀌면 clear하지 않는다', () => {
    const submitted = [{ name: 'first' }]
    const latest = [...submitted, { name: 'second' }]

    expect(clearAttachmentsIfUnchanged(latest, submitted)).toBeNull()
  })
})
