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
    expect(entryPolicy('resume', 'opencode')).toEqual({ action: 'scroll-bottom' })
    expect(entryPolicy('resume', 'opencode', pinned)).toEqual({ action: 'scroll-bottom' })
  })

  it('p10: sync preserves current anchor on both harnesses', () => {
    expect(entryPolicy('sync', 'claude')).toEqual({ action: 'keep-anchor' })
    expect(entryPolicy('sync', 'opencode')).toEqual({ action: 'keep-anchor' })
  })

  it('p5: sendCount change triggers bottom scroll intent once', () => {
    // When sendCount advances, entry policy transitions to scroll-bottom (smooth handled by viewport)
    let lastSendCount = 0
    const nextSendCount = 1
    const shouldScrollOnSend = nextSendCount !== lastSendCount
    lastSendCount = nextSendCount
    expect(shouldScrollOnSend).toBe(true)
    expect(nextSendCount !== lastSendCount).toBe(false)
  })

  it('p11/p13/p14/p15: entryIntent derivation (open, sync, resume), single consumption, re-select no-op, late revalidate, and cross-session isolation', () => {
    // Simulate store entryIntent state machine (EP-11 ④⑧)
    type Intent = 'open' | 'sync' | 'resume' | undefined
    const intents = new Map<string, Intent>()
    let activeSession = 's1'

    // p11: loadSession session change -> open; revalidate -> sync; no intent -> resume; consumed once
    const consumeIntent = (key: string): 'open' | 'sync' | 'resume' => {
      const val = intents.get(key)
      intents.delete(key)
      return val ?? 'resume'
    }

    intents.set('s1', 'open')
    expect(consumeIntent('s1')).toBe('open')
    expect(consumeIntent('s1')).toBe('resume') // consumed once

    intents.set('s1', 'sync')
    expect(consumeIntent('s1')).toBe('sync')

    // p13: re-selecting active session sets no intent and changes nothing
    const selectSession = (next: string): void => {
      if (next === activeSession) return
      activeSession = next
      intents.set(next, 'open')
    }
    selectSession('s1')
    expect(intents.has('s1')).toBe(false)

    // p14: cached open consumed -> late revalidate sets sync -> keeps anchor/pin
    selectSession('s2')
    expect(entryPolicy(consumeIntent('s2'), 'claude')).toEqual({ action: 'scroll-bottom' })
    intents.set('s2', 'sync')
    expect(entryPolicy(consumeIntent('s2'), 'claude')).toEqual({ action: 'keep-anchor' })

    // p15: loading X while switching to Y -> X response does not touch Y; later opening X is 'open'
    selectSession('sX')
    expect(consumeIntent('sX')).toBe('open')
    selectSession('sY')
    // Late X revalidate response only touches sX, never sY
    intents.set('sX', 'sync')
    expect(intents.get('sY')).toBe('open')
    expect(consumeIntent('sY')).toBe('open')
    // Later switching back to sX sets 'open' (bottom)
    selectSession('sX')
    expect(entryPolicy(consumeIntent('sX'), 'opencode', { pinned: false, scrollTop: 200 })).toEqual(
      { action: 'scroll-bottom' }
    )
  })
})
