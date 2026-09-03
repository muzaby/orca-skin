import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import { ModelMenu } from './ModelMenu'
import { ModeMenu } from './ModeMenu'
import { modeMenuOptions } from './modes'
import { modelKey, selectedModelShape, type ModelSelection } from './modelSelection'

// 0215 VP-09·VP-10·VP-12 — 두 `[1m]` 변형이 각각의 행이고, haiku 는 '자동'을 내걸지 않는다.
const model = (
  alias: string,
  name: string | null,
  oneMillionContext = false,
  isDefault = false
): AgentEnvironment['models'][number] => ({
  alias,
  model: name,
  isCustom: alias === 'custom',
  oneMillionContext,
  isDefault
})

const agent = (models: AgentEnvironment['models']): AgentEnvironment => ({
  key: 'claude-anthropic',
  adapter: 'claude',
  provider: 'anthropic',
  supported: true,
  source: 'settings',
  readOnly: false,
  models
})

const selection = (modelFamily: string, modelAlias: string): ModelSelection => ({
  providerKey: 'claude-anthropic',
  modelFamily,
  modelAlias,
  adapter: 'claude'
})

const renderMenu = (models: AgentEnvironment['models'], sel: ModelSelection | null): string =>
  renderToStaticMarkup(
    createElement(ModelMenu, {
      agents: [agent(models)],
      sessionBackend: null,
      selection: sel,
      onPick: vi.fn()
    })
  )

const BOTH = [
  model('sonnet', 'claude-sonnet-4-6', false, true),
  model('sonnet', 'claude-sonnet-4-6', true)
]

describe('ModelMenu — [1m] 변형이 각각의 행이다 (AT-10)', () => {
  it('두 변형이 모두 노출되고 1M 배지로 구분된다', () => {
    const html = renderMenu(BOTH, null)
    expect(html.match(/menuitemradio/g)).toHaveLength(2)
    expect(html).toContain('>1M<')
  })

  it('활성 표시가 정확히 한 행에만 켜진다 — 식별자가 1M 을 싣는다', () => {
    const html = renderMenu(BOTH, selection('claude-sonnet-4-6[1m]', 'sonnet'))
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html.match(/aria-checked="false"/g)).toHaveLength(1)
  })

  it('형제를 맞바꾸면 다른 행이 켜진다 — 존재만 보는 단언이 아니다', () => {
    // **행 단위**로 본다. 목록 전체에서 배지·체크의 존재만 세면 두 행을 맞바꿔도 통과한다.
    const activeRow = (html: string): string | undefined =>
      html
        .split('role="menuitemradio"')
        .slice(1)
        .find((row) => row.startsWith(' aria-checked="true"'))

    const base = activeRow(renderMenu(BOTH, selection('claude-sonnet-4-6', 'sonnet')))
    const oneM = activeRow(renderMenu(BOTH, selection('claude-sonnet-4-6[1m]', 'sonnet')))
    expect(base).toBeDefined()
    expect(oneM).toBeDefined()
    // 켜진 행이 1M 행인지 아닌지가 선택마다 다르다.
    expect(base).not.toContain('>1M<')
    expect(oneM).toContain('>1M<')
  })

  it('VP-10 — 선택 식별자가 SDK 문자열과 같다 (main·renderer 가 같은 규칙)', () => {
    expect(modelKey(BOTH[0])).toBe('claude-sonnet-4-6')
    expect(modelKey(BOTH[1])).toBe('claude-sonnet-4-6[1m]')
  })
})

describe('ModeMenu — haiku 선택 시 자동 제외 (AT-11)', () => {
  const renderModes = (models: AgentEnvironment['models'], sel: ModelSelection): string =>
    renderToStaticMarkup(
      createElement(ModeMenu, {
        mode: 'accept_edits' as const,
        options: modeMenuOptions(selectedModelShape([agent(models)], sel)),
        onPick: vi.fn()
      })
    )

  it('haiku 행을 고르면 메뉴에 자동이 없다', () => {
    const models = [model('haiku', 'claude-haiku-4-5', false, true)]
    const html = renderModes(models, selection('claude-haiku-4-5', 'haiku'))
    // 라벨 '자동' 은 '편집 자동 수락' 의 부분문자열이라 설명 문구로 가른다.
    expect(html).not.toContain('Claude가 권한 결정을 처리합니다')
    expect(html).not.toContain('>자동<')
    // 양성 짝 — 다른 항목은 그대로다.
    expect(html).toContain('편집 자동 수락')
  })

  it('비-haiku 는 자동이 있다 — 음성 짝', () => {
    const models = [model('sonnet', 'claude-sonnet-4-6', false, true)]
    const html = renderModes(models, selection('claude-sonnet-4-6', 'sonnet'))
    expect(html).toContain('Claude가 권한 결정을 처리합니다')
  })
})
