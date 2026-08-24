import { describe, expect, it } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import { selectionExists, selectionLabel } from './modelSelection'

const agents: AgentEnvironment[] = [
  {
    key: 'orca-corp',
    adapter: 'orca',
    models: [
      {
        alias: 'orca-private-v1',
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
})
