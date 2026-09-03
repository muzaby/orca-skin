// 0215 ΔV2 · VP-21 (AR-04 ↔ IT · §10 EP-20a·EP-22) — `Composer` 를 **마운트해** 선택 모델이
// 칩 라벨까지 흘러가는지 관측한다.
//
// ΔV1 D-018 은 "`Composer` 는 `createPortal` 때문에 마운트 불가" 라고 적었고 그 전제가
// 틀렸다(D-021 이 대체). `Popover.tsx:111` 의 `if (!open) return null` 이 `:122` 의
// `createPortal` **앞**에 있고, 세 메뉴의 open 초기값이 전부 `false` 다(`Composer.tsx:151`·
// `:153`·`:155`). SSR 은 effect 를 실행하지 않으므로 `useAgents` 의 IPC 도 돌지 않는다.
//
// 그래서 경계는 *컴포넌트* 가 아니라 **실행되지 않는 영역**이다 — `Popover`·`useEffect`
// 내부는 소스 단언(`composer/composerWiring.test.ts`), 항상 렌더되는 부분은 여기서 잡는다.
//
// 시드 방법은 AT-24 와 같다 — zustand v5 의 `getServerSnapshot` 이 `getInitialState()` 라
// `setState` 시드는 SSR 렌더에 보이지 않는다. 초기 상태 객체를 제자리 변형하고 원복한다.

import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Composer } from './Composer'
import { useChatStore } from '../store/chatStore'
import { useAgentStore } from '../../../shared/stores/agentStore'
import type { AgentEnvironment } from '../../../../../shared/ipc'

const agentState = (): { agents: AgentEnvironment[] } => useAgentStore.getInitialState()
const chatSession = (): {
  providerKey: string | null
  modelFamily: string | null
  modelAlias: string | null
} => {
  const init = useChatStore.getInitialState()
  return init.sessions[init.activeKey]!.session
}

const pristine = {
  agents: agentState().agents,
  providerKey: chatSession().providerKey,
  modelFamily: chatSession().modelFamily,
  modelAlias: chatSession().modelAlias
}

afterEach(() => {
  agentState().agents = pristine.agents
  const s = chatSession()
  s.providerKey = pristine.providerKey
  s.modelFamily = pristine.modelFamily
  s.modelAlias = pristine.modelAlias
})

// 칩은 `agents.some((a) => a.supported)` 로 게이팅된다 — `supported` 없이 시드하면
// 칩 자체가 렌더되지 않아 라벨 단언이 자동으로 참이 된다(실측).
const AGENT = {
  key: 'claude',
  adapter: 'claude',
  provider: 'anthropic',
  label: 'Claude',
  supported: true,
  models: [
    { alias: 'sonnet', model: 'claude-sonnet-4-6', oneMillionContext: false, isDefault: true }
  ]
} as unknown as AgentEnvironment

const renderComposer = (selection: {
  providerKey: string | null
  modelFamily: string | null
  modelAlias: string | null
}): string => {
  agentState().agents = [AGENT]
  Object.assign(chatSession(), selection)
  return renderToStaticMarkup(createElement(Composer, { backendLabel: 'claude', canAbort: true }))
}

describe('0215 AT-26 — Composer 가 선택 모델을 칩 라벨로 낸다', () => {
  const SELECTED = {
    providerKey: 'claude',
    modelFamily: 'claude-sonnet-4-6',
    modelAlias: 'sonnet'
  }

  it('선택 모델이 있으면 칩이 provider/modelFamily 를 보인다', () => {
    const html = renderComposer(SELECTED)
    // 배선 단언 — `selectionLabel(selectedModel)` 을 폴백으로 바꾸면 red 다(verify r2 V-2c).
    expect(html).toContain('anthropic/claude-sonnet-4-6')
  })

  it('식별자가 `[1m]` 변형이면 칩도 그것을 구분해 보인다 (D-007·D-008 회귀)', () => {
    const html = renderComposer({ ...SELECTED, modelFamily: 'claude-sonnet-4-6[1m]' })
    expect(html).toContain('anthropic/claude-sonnet-4-6[1m]')
  })

  it('마운트가 실제로 칩까지 도달했다 — 시드 수단의 양성 관측', () => {
    // 이 케이스가 없으면 위 단언들은 "칩이 아예 안 그려진 출력" 과 구분되지 않는다.
    // `supported: false` 면 칩이 사라지므로 라벨도 사라진다 — 그 차이가 도달의 증거다.
    const withChip = renderComposer(SELECTED)
    agentState().agents = [{ ...AGENT, supported: false } as unknown as AgentEnvironment]
    const withoutChip = renderToStaticMarkup(
      createElement(Composer, { backendLabel: 'claude', canAbort: true })
    )
    expect(withChip).toContain('anthropic/')
    expect(withoutChip).not.toContain('anthropic/')
  })
})
