import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AgentModelView } from '../../../../../shared/ipc'
import { EngineModelList } from './EngineModelList'

const model = (overrides: Partial<AgentModelView>): AgentModelView => ({
  alias: 'fable',
  model: 'claude-fable-4-6',
  isCustom: false,
  oneMillionContext: false,
  isDefault: false,
  ...overrides
})

describe('EngineModelList Fable rows', () => {
  it('renders Fable alias, exact model, 1M variant, and default badge together', () => {
    const markup = renderToStaticMarkup(
      createElement(EngineModelList, {
        models: [model({ isDefault: true }), model({ oneMillionContext: true })]
      })
    )

    expect(markup.match(/>fable</g)).toHaveLength(2)
    expect(markup.match(/claude-fable-4-6/g)).toHaveLength(2)
    expect(markup).toContain('>1M<')
    expect(markup).toContain('>✓ default<')
  })
})
