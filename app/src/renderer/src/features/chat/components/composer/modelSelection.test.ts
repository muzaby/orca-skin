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
        modelFamily: 'orca-private-v1'
      })
    ).toBe('corp/orca-private-v1')
  })

  it('detects a selection removed with its runtime contribution', () => {
    const selection = {
      providerKey: 'orca-corp',
      adapter: 'orca',
      modelFamily: 'orca-private-v1'
    }
    expect(selectionExists(agents, selection)).toBe(true)
    expect(selectionExists([], selection)).toBe(false)
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
    expect(
      selectionExists([agent], {
        providerKey: agent.key,
        modelFamily: 'sonnet-b',
        adapter: agent.adapter
      })
    ).toBe(true)
    expect(
      selectionExists([agent], {
        providerKey: agent.key,
        modelFamily: 'private-v1',
        adapter: agent.adapter
      })
    ).toBe(true)
  })
})
