import { beforeEach, expect, it, vi } from 'vitest'
import { layerKey } from '../lib/rightPanelStack'
import { connectPanelSettings, panelActions as panel, useRightPanelStore } from './rightPanelStore'
import type { ArtifactViewerSelection } from './artifactViewerStore'

const code = { key: 'a', kind: 'code', backend: 'claude' } as const
const oc = { key: 'oc', kind: 'code', backend: 'opencode' } as const
const work = { key: 'w', kind: 'work', backend: 'claude' } as const
const stack = (): string[] => useRightPanelStore.getState().stack.map(layerKey)
const viewer: ArtifactViewerSelection = {
  sessionKey: 'a',
  sessionId: 'a',
  request: 1,
  loading: false,
  mode: 'code',
  expanded: false,
  artifact: {
    publicationId: 'p',
    artifactFileId: 'f',
    filename: 'f.txt',
    title: 'f',
    kind: 'text',
    sizeBytes: 1,
    publishedAt: 0
  }
}
beforeEach(() => useRightPanelStore.setState(useRightPanelStore.getInitialState()))
it('AC1 open state survives session switches', () => {
  const persist = vi.fn()
  const release = connectPanelSettings(persist)
  panel.switchSession(code, false)
  panel.tile('plan')
  panel.switchSession({ ...code, key: 'b' }, true)
  expect(stack()).toEqual(['plan'])
  panel.close()
  panel.switchSession(code, false)
  expect(stack()).toEqual([])
  expect(persist.mock.calls).toEqual([[true], [false]])
  release()
})
it.each(['E1', 'E2', 'E3'] as const)('AC3 %s remembers the uppermost tile', (example) => {
  panel.switchSession(code, true)
  panel.tile('diff')
  if (example === 'E2') panel.back()
  if (example === 'E3') panel.navigate({ kind: 'artifact', viewer })
  panel.switchSession({ ...code, key: 'b' }, true)
  expect(stack()).toEqual([example === 'E2' ? 'plan' : 'diff'])
})
it.each(['E4', 'E5', 'E6'] as const)(
  'AC3 %s falls back without changing the other harness memory',
  (example) => {
    panel.switchSession(oc, true)
    panel.tile('task')
    panel.navigate({ kind: 'detail', selection: { id: 'subagent', selectedId: 'child' } })
    panel.switchSession(code, true)
    expect(stack()).toEqual(['plan'])
    expect(useRightPanelStore.getState().memory.code).toBe('task')
    if (example === 'E6') panel.tile('diff')
    panel.switchSession({ ...oc, key: 'next' }, true)
    expect(stack()).toEqual([example === 'E6' ? 'diff' : 'task'])
  }
)
it('AC3 E7 clears task detail and E8 resets in-memory choices on restart', () => {
  panel.switchSession(work, true)
  panel.tile('task')
  panel.navigate({ kind: 'taskDetail', id: 'task', task: 'id' })
  panel.switchSession({ ...work, key: 'w2' }, true)
  expect(stack()).toEqual(['task'])
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  panel.switchSession(code, true)
  expect(stack()).toEqual(['plan'])
  expect(useRightPanelStore.getState().memory).toEqual({})
})
it.each([false, true])(
  'AC14 A2 opens with a tile beneath the artifact (remembered=%s)',
  (remembered) => {
    panel.switchSession(code, false)
    if (remembered) {
      panel.tile('diff')
      panel.close()
    }
    panel.navigate({ kind: 'artifact', viewer })
    const base = remembered ? 'diff' : 'plan'
    expect(stack()).toEqual([base, 'artifact:p'])
    panel.navigate({ kind: 'artifact', viewer })
    expect(stack()).toEqual([base, 'artifact:p'])
    panel.back()
    expect(stack()).toEqual([base])
    panel.close()
    panel.tile('subagent')
    expect(stack()).toEqual(['subagent'])
  }
)
it('AC6 pop-to, toggle close, idempotent back at root and AC14 A9 close all layers', () => {
  panel.switchSession(code, true)
  panel.tile('diff')
  panel.navigate({ kind: 'artifact', viewer })
  panel.tile('plan')
  expect(stack()).toEqual(['plan'])
  panel.back()
  expect(stack()).toEqual(['plan'])
  panel.tile('plan', true)
  expect(stack()).toEqual([])
  panel.navigate({ kind: 'artifact', viewer })
  panel.close()
  expect(stack()).toEqual([])
})

it('returns focus to the control that opened a tile or a closed-panel artifact', () => {
  class FocusControl {}
  vi.stubGlobal('HTMLElement', FocusControl)
  const control = new FocusControl() as HTMLElement
  vi.stubGlobal('document', { activeElement: control })
  try {
    panel.switchSession(code, false)
    panel.tile('plan')
    panel.tile('diff')
    panel.back()
    expect(useRightPanelStore.getState().returnFocus).toBe(control)
    panel.close()
    panel.navigate({ kind: 'artifact', viewer, origin: control })
    panel.close()
    expect(useRightPanelStore.getState().returnFocus).toBe(control)
  } finally {
    vi.unstubAllGlobals()
  }
})
