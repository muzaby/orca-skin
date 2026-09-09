import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import { selectedModelShape } from './modelSelection'
import { modeMenuOptions } from './modes'
import { ModeMenu } from './ModeMenu'

describe('r6 selected catalog to actual permission menu', () => {
  for (const kind of ['work', 'code'] as const) {
    it.each([
      ['claude-haiku-4-5', false, false],
      ['claude-sonnet-4-5', false, false],
      ['claude-opus-4-5', false, false],
      ['claude-haiku-4-6', false, true],
      ['claude-sonnet-4-6', false, true],
      ['claude-opus-4-6', false, true],
      ['claude-sonnet-4-6', true, false],
      ['corp-model-9', true, false]
    ] as const)(`${kind}: %s custom=%s`, (name, isCustom, allowed) => {
      const agent: AgentEnvironment = {
        key: 'claude-test',
        adapter: 'claude',
        supported: true,
        models: [
          { alias: 'sonnet', model: name, isCustom, isDefault: true, oneMillionContext: false }
        ]
      }
      const shape = selectedModelShape([agent], {
        providerKey: agent.key,
        adapter: 'claude',
        modelFamily: name,
        modelAlias: 'sonnet'
      })
      const options = modeMenuOptions(shape, kind)
      expect(options.some((o) => o.mode === 'auto_classified')).toBe(allowed)
      const html = renderToStaticMarkup(
        createElement(ModeMenu, { mode: 'default', options, onPick: () => {} })
      )
      expect(html.includes('Claude가 권한 결정을 처리합니다')).toBe(allowed)
    })
    it(`${kind}: unknown catalog never enables auto from an unverified selection`, () => {
      const shape = selectedModelShape([], {
        providerKey: 'missing',
        adapter: 'claude',
        modelFamily: 'claude-sonnet-4-6',
        modelAlias: 'sonnet'
      })
      expect(modeMenuOptions(shape, kind).some((o) => o.mode === 'auto_classified')).toBe(false)
    })
  }
})
