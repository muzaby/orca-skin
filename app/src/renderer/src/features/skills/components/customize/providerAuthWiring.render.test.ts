import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderInfo } from '../../../../../../shared/ipc'

// 두 부모가 인증 callback을 넘기는 edge를 반환 트리의 props로 관측한다(AC15).
//   ExtensionsCatalogView → ProviderDetail → ProviderAuthActions
// 자식 컴포넌트는 element로만 남으므로 hook을 실행하지 않는다.
const h = vi.hoisted(() => ({
  selection: null as unknown,
  providers: null as unknown
}))
vi.mock('react', async (original) => ({
  ...((await original()) as object),
  useId: () => 'id',
  useRef: () => ({ current: null }),
  useMemo: (calculate: () => unknown) => calculate(),
  useState: (initial: unknown) => {
    const value = typeof initial === 'function' ? (initial as () => unknown)() : initial
    const isSelection =
      value !== null && typeof value === 'object' && 'tab' in value && 'selectedId' in value
    return [isSelection && h.selection ? h.selection : value, () => {}]
  }
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' }),
  formatDateMedium: () => ''
}))
vi.mock('../../hooks/useCustomizeSkills', () => ({ useCustomizeSkills: () => ({ list: [] }) }))
vi.mock('../../hooks/useMcpServers', () => ({ useMcpServers: () => ({ list: [] }) }))
vi.mock('../../hooks/useProviders', () => ({ useProviders: () => h.providers }))

import { ProviderDetail } from './ProviderDetail'
import { ProviderAuthActions } from './ProviderAuthActions'
import { ExtensionsCatalogView } from './ExtensionsCatalogView'

type Props = Record<string, unknown>

function collect(tree: unknown, type: unknown): ReactElement<Props>[] {
  const found: ReactElement<Props>[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const element = node as ReactElement<Props>
    if (element.type === type) found.push(element)
    walk(element.props?.children)
  }
  walk(tree)
  return found
}

const PROVIDER: ProviderInfo = {
  id: 'jira-dc',
  label: 'Jira',
  kind: 'service',
  origin: 'builtin',
  auth: [
    { kind: 'pat', label: 'PAT', fields: [] },
    { kind: 'oauth', label: 'OAuth', fields: [] }
  ],
  status: 'valid',
  activeAuthKind: 'oauth',
  principal: null,
  expiresAt: null,
  tools: []
}

beforeEach(() => {
  h.selection = null
  h.providers = null
})

describe('ProviderDetail → ProviderAuthActions (D14 · VP-10)', () => {
  it('passes each auth callback to its own prop and the current auth kind', () => {
    const cb = { onLogin: vi.fn(), onSubmit: vi.fn(), onReauth: vi.fn(), onRevoke: vi.fn() }
    const tree = ProviderDetail({ provider: PROVIDER, step: null, ...cb })
    const [actions] = collect(tree, ProviderAuthActions)
    expect(actions.props.provider).toBe(PROVIDER)
    expect(actions.props.onLogin).toBe(cb.onLogin)
    expect(actions.props.onReauth).toBe(cb.onReauth)
    expect(actions.props.onRevoke).toBe(cb.onRevoke)
    // initialAuthKind — 활성 방식이 첫 방식(pat)보다 우선한다.
    expect(actions.props.authKind).toBe('oauth')
  })
})

describe('ExtensionsCatalogView → ProviderDetail sink (D15)', () => {
  it('binds login/reauth/revoke to the selected provider id and the matching providers method', () => {
    const providers = {
      list: [PROVIDER],
      step: null,
      login: vi.fn(async () => undefined),
      submit: vi.fn(async () => undefined),
      reauth: vi.fn(async () => undefined),
      revoke: vi.fn(async () => undefined),
      clearStep: vi.fn()
    }
    h.providers = providers
    h.selection = { tab: 'providers', selectedId: 'jira-dc' }
    const [detail] = collect(ExtensionsCatalogView(), ProviderDetail)
    expect(detail.props.provider).toBe(PROVIDER)
    ;(detail.props.onReauth as (kind?: string) => void)('pat')
    expect(providers.reauth).toHaveBeenCalledExactlyOnceWith('jira-dc', 'pat')
    ;(detail.props.onRevoke as () => void)()
    expect(providers.revoke).toHaveBeenCalledExactlyOnceWith('jira-dc')
    ;(detail.props.onLogin as (kind?: string) => void)('oauth')
    expect(providers.login).toHaveBeenCalledExactlyOnceWith('jira-dc', 'oauth')
    expect(providers.reauth).toHaveBeenCalledTimes(1)
    expect(providers.revoke).toHaveBeenCalledTimes(1)
  })
})
