import { describe, expect, it } from 'vitest'
import { withRepoMutation } from './mutation-queue'

describe('withRepoMutation', () => {
  it('같은 repo는 직렬이고 다른 repo는 병렬이다', async () => {
    const events: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = withRepoMutation('/a', async () => {
      events.push('a1:start')
      await gate
      events.push('a1:end')
    })
    const second = withRepoMutation('/a', async () => {
      events.push('a2:start')
    })
    const other = withRepoMutation('/b', async () => {
      events.push('b:start')
    })
    await other
    expect(events).toEqual(['a1:start', 'b:start'])
    release()
    await Promise.all([first, second])
    expect(events).toEqual(['a1:start', 'b:start', 'a1:end', 'a2:start'])
  })
})
