import { expect, it } from 'vitest'
import { resolveAgentSelection } from './agentSelection'

const agents = [{ name: 'z-first' }, { name: 'a-second' }]
it('uses returned order, keeps a valid choice and clears an authoritative empty list', () => {
  expect(resolveAgentSelection('', agents, true, 'ready')).toBe('z-first')
  expect(resolveAgentSelection('a-second', agents, true, 'ready')).toBe('a-second')
  expect(resolveAgentSelection('gone', agents, true, 'ready')).toBe('z-first')
  expect(resolveAgentSelection('gone', [], true, 'ready')).toBe('')
})
it.each(['loading', 'error'] as const)('retains the known selection while %s', (status) => {
  expect(resolveAgentSelection('known', [], true, status)).toBe('known')
  expect(resolveAgentSelection(undefined, undefined, false, status)).toBe('')
})
