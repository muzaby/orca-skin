import { describe, expect, it } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import { defaultSelection, selectionExists, selectionLabel } from './modelSelection'

const agents: AgentEnvironment[] = [
  {
    key: 'orca-corp',
    adapter: 'orca',
    models: [
      {
        alias: 'custom',
        model: 'orca-private-v1',
        isCustom: true,
        oneMillionContext: false,
        isDefault: true
      }
    ],
    supported: true,
    source: 'runtime',
    readOnly: true
  }
]

describe('runtime model selection', () => {
  it('shows the custom model name verbatim', () => {
    expect(
      selectionLabel({
        providerKey: 'orca-corp',
        provider: 'corp',
        adapter: 'orca',
        modelFamily: 'orca-private-v1',
        modelAlias: 'custom'
      })
    ).toBe('corp/orca-private-v1')
  })

  it('detects a selection removed with its runtime contribution', () => {
    expect(selectionExists(agents, 'orca-corp', 'orca-private-v1')).toBe(true)
    expect(selectionExists([], 'orca-corp', 'orca-private-v1')).toBe(false)
  })

  it('keeps a restored provider while its model is awaiting default hydration', () => {
    expect(selectionExists(agents, 'orca-corp', null)).toBe(true)
  })

  it('uses actual model names as unique keys for repeated families and custom models', () => {
    const agent = structuredClone(agents[0])
    agent.models = [
      {
        alias: 'sonnet',
        model: 'sonnet-a',
        isCustom: false,
        oneMillionContext: false,
        isDefault: true
      },
      {
        alias: 'sonnet',
        model: 'sonnet-b',
        isCustom: false,
        oneMillionContext: false,
        isDefault: false
      },
      {
        alias: 'custom',
        model: 'private-v1',
        isCustom: true,
        oneMillionContext: false,
        isDefault: false
      }
    ]

    expect(defaultSelection([agent], null)?.modelFamily).toBe('sonnet-a')
    expect(selectionExists([agent], agent.key, 'sonnet-b')).toBe(true)
    expect(selectionExists([agent], agent.key, 'private-v1')).toBe(true)
  })
})
