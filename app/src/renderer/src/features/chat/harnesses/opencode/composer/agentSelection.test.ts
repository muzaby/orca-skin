import { describe, expect, it } from 'vitest'
import { agentPlaceholder, resolveAgentSelection } from './agentSelection'

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

describe('agentPlaceholder (0291 D-016)', () => {
  it('uses provider catalog agents, then the shared defaults, only without an authoritative list', () => {
    const rows = [
      { key: 'a', adapter: 'opencode', models: [], supported: true, agents: [{ name: 'x' }] },
      { key: 'b', adapter: 'opencode', models: [], supported: true, agents: [] }
    ]
    expect(agentPlaceholder('a', rows)).toEqual([{ name: 'x' }])
    expect(agentPlaceholder('b', rows)).toEqual([{ name: 'build' }, { name: 'plan' }])
    expect(agentPlaceholder(null, rows)).toEqual([{ name: 'build' }, { name: 'plan' }])
    // 저장 판정은 placeholder 를 보지 않는다 — 비-authoritative 면 기존 선택(빈 값) 그대로.
    expect(resolveAgentSelection(undefined, undefined, false, 'loading')).toBe('')
  })
})
