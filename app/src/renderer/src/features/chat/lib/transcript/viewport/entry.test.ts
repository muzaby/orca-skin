import { describe, expect, it } from 'vitest'
import { entryPolicy } from './entry'

describe('viewport/entry (EP-11 ④⑧ · p7, p8, p10)', () => {
  it('p7: open always scrolls to bottom on both harnesses even if OpenCode has saved anchor', () => {
    const saved = { pinned: false, scrollTop: 320, anchorKey: 'a:1:text:0' }
    expect(entryPolicy('open', 'claude', saved)).toEqual({ action: 'scroll-bottom' })
    expect(entryPolicy('open', 'opencode', saved)).toEqual({ action: 'scroll-bottom' })
  })

  it('p8: resume goes to bottom on Claude; restores saved anchor on OpenCode when unpinned, bottom when pinned', () => {
    const unpinned = { pinned: false, scrollTop: 320, anchorKey: 'a:1:text:0' }
    const pinned = { pinned: true, scrollTop: 1200 }
    expect(entryPolicy('resume', 'claude', unpinned)).toEqual({ action: 'scroll-bottom' })
    expect(entryPolicy('resume', 'opencode', unpinned)).toEqual({
      action: 'restore-saved',
      saved: unpinned
    })
    expect(entryPolicy('resume', 'opencode', pinned)).toEqual({ action: 'scroll-bottom' })
  })

  it('p10: sync preserves current anchor on both harnesses', () => {
    expect(entryPolicy('sync', 'claude')).toEqual({ action: 'keep-anchor' })
    expect(entryPolicy('sync', 'opencode')).toEqual({ action: 'keep-anchor' })
  })
})
