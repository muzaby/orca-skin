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
    // 배지는 자기 행에 붙는다 — 1M·default 조건을 맞바꾸면 두 문자열은 남아도 행 귀속이 바뀐다.
    const rows = markup.split('rounded-lg bg-bg2').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => [row.includes('>1M<'), row.includes('>✓ default<')])).toEqual([
      [false, true],
      [true, false]
    ])
  })
})
