import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('projectNavStore deletion', () => {
  beforeEach(() => vi.resetModules())

  it('removes expanded and creation receipts and ignores late callbacks for that ID', async () => {
    const { projectNavActions, useProjectNavStore } = await import('./projectNavStore')
    projectNavActions.announceCreated('p')
    projectNavActions.announceCreated('other')
    projectNavActions.remove('p')
    const removed = useProjectNavStore.getState()
    expect(removed.expanded).toEqual({ other: true })
    expect([...removed.announced]).toEqual(['other'])
    expect(projectNavActions.announceCreated('p')).toBe(false)
    projectNavActions.setExpanded('p', true)
    expect(useProjectNavStore.getState()).toBe(removed)
    expect(projectNavActions.announceCreated('new-uuid')).toBe(true)
    expect(useProjectNavStore.getState().expanded['new-uuid']).toBe(true)
  })
})
