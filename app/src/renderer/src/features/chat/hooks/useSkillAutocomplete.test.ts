import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillInfo } from '../../../../../shared/ipc'

// 공유 상태 머신(useTokenAutocompleteState)의 `/` skill 소비자를 실제 hook으로 구동한다.
const h = vi.hoisted(() => ({
  states: [] as { value: unknown; set: (update: unknown) => void }[],
  memos: [] as { value: unknown; deps: readonly unknown[] }[],
  stateIndex: 0,
  memoIndex: 0,
  dirty: false,
  same: (a: readonly unknown[], b: readonly unknown[]): boolean =>
    a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = h.stateIndex++
    if (!h.states[index]) {
      const slot = {
        value: typeof initial === 'function' ? initial() : initial,
        set: (update: unknown): void => {
          const next = typeof update === 'function' ? update(slot.value) : update
          if (!Object.is(next, slot.value)) {
            slot.value = next
            h.dirty = true
          }
        }
      }
      h.states[index] = slot
    }
    const slot = h.states[index]
    return [slot.value, slot.set]
  },
  useMemo: (calculate: () => unknown, deps: readonly unknown[]) => {
    const index = h.memoIndex++
    const previous = h.memos[index]
    if (!previous || !h.same(previous.deps, deps)) h.memos[index] = { value: calculate(), deps }
    return h.memos[index].value
  }
}))

import { useSkillAutocomplete, type UseSkillAutocomplete } from './useSkillAutocomplete'

function HookProbe(text: string): UseSkillAutocomplete {
  return useSkillAutocomplete(text, text.length, skills)
}

const skills = [{ name: 'build' }, { name: 'bump' }, { name: 'review' }] as SkillInfo[]

function render(text: string): UseSkillAutocomplete {
  for (let attempt = 0; attempt < 10; attempt++) {
    h.stateIndex = h.memoIndex = 0
    h.dirty = false
    const result = HookProbe(text)
    if (!h.dirty) return result
  }
  throw new Error('Hook fixture did not settle')
}

beforeEach(() => {
  h.states = []
  h.memos = []
})

describe('skill autocomplete dismissal (AC25 regression)', () => {
  it('keeps Escape on the dismissed partial and reopens when the partial changes', () => {
    render('/b').close()
    expect(render('/b').open).toBe(false)
    expect(render('/bu').open).toBe(true)
  })

  it('does not re-dismiss a reopened popup when the active option moves', () => {
    render('/b').close()
    const reopened = render('/bu')
    reopened.setActiveIndex(1)
    expect(render('/bu')).toMatchObject({ open: true, activeIndex: 1 })
  })

  it('starts a fresh occurrence after the token disappears', () => {
    render('/b').close()
    render('')
    expect(render('/b')).toMatchObject({ open: true, activeIndex: 0 })
  })
})
