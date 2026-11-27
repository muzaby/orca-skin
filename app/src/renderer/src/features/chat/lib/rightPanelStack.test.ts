import { expect, it } from 'vitest'
import { initialLayer, navigateStack, type PanelEntry, type PanelSession } from './rightPanelStack'

const session: PanelSession = { key: 's', kind: 'code', backend: 'claude' }
const plan: PanelEntry = { kind: 'tile', id: 'plan' }
const list: PanelEntry = { kind: 'tile', id: 'subagent' }
const detail = (selectedId: string): PanelEntry => ({
  kind: 'detail',
  selection: { id: 'subagent', selectedId }
})

it('AC15 opens a closed detail above the remembered tile', () => {
  const remembered = initialLayer(session, 'diff')
  expect(remembered).toEqual({ kind: 'tile', id: 'diff' })
  expect(navigateStack([], detail('a'), remembered, false)).toEqual([remembered, detail('a')])
})
it('AC15 opens a closed detail above the default tile without memory', () => {
  const initial = initialLayer(session)
  expect(initial).toEqual(plan)
  expect(navigateStack([], detail('a'), initial, false)).toEqual([plan, detail('a')])
})
it('AC15 preserves open layers and replaces another selected detail in place', () => {
  const opened = navigateStack([plan, list], detail('a'), plan, false)
  expect(opened).toEqual([plan, list, detail('a')])
  expect(navigateStack(opened, detail('b'), plan, false)).toEqual([plan, list, detail('b')])
})
it('keeps process entry and the OpenCode overview list distinct from a selected agent', () => {
  const process: PanelEntry = { kind: 'detail', selection: { id: 'process', selectedId: 'p' } }
  const overview: PanelEntry = { kind: 'detail', selection: { id: 'subagent', selectedId: null } }
  expect(navigateStack([], process, plan, false)).toEqual([process])
  expect(navigateStack([plan, overview], detail('a'), plan, false)).toEqual([
    plan,
    overview,
    detail('a')
  ])
})
