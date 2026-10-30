import { expect, it } from 'vitest'
import { orderAgentEnvironments } from './agentOrder'

it('ranks claude, opencode, then unknown adapters and keeps order within a harness', () => {
  const agents = [
    { key: 'oc-1', adapter: 'opencode' },
    { key: 'legacy', adapter: 'legacy' },
    { key: 'cl-1', adapter: 'claude' },
    { key: 'oc-2', adapter: 'opencode' },
    { key: 'cl-2', adapter: 'claude' }
  ]
  expect(orderAgentEnvironments(agents).map((agent) => agent.key)).toEqual([
    'cl-1',
    'cl-2',
    'oc-1',
    'oc-2',
    'legacy'
  ])
  expect(agents[0]!.key).toBe('oc-1')
})
