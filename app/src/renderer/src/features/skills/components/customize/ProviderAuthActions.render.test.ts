import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProviderInfo } from '../../../../../../shared/ipc'

// 컴포넌트를 직접 호출해 반환 트리의 MenuItem·Button props를 읽는다. Popover는 열린 뒤에만
// 본문을 그리므로 static render로는 메뉴 항목과 onClick 배선을 관측할 수 없다.
const h = vi.hoisted(() => ({ open: false, log: [] as string[] }))
vi.mock('react', async (original) => ({
  ...((await original()) as object),
  useRef: () => ({ current: null }),
  useState: () => [
    h.open,
    (value: unknown) => {
      h.open =
        typeof value === 'function' ? (value as (v: boolean) => boolean)(h.open) : Boolean(value)
      h.log.push(`setOpen(${h.open})`)
    }
  ]
}))
vi.mock('../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))

import { ProviderAuthActions, type ProviderAuthActionsProps } from './ProviderAuthActions'
import { Button } from '../../../../shared/ui/Button'
import { MenuItem } from '../../../../shared/ui/MenuItem'

type Props = Record<string, unknown>

function provider(status: ProviderInfo['status']): ProviderInfo {
  return {
    id: 'jira-dc',
    label: 'Jira',
    kind: 'service',
    origin: 'builtin',
    auth: [],
    status,
    activeAuthKind: null,
    principal: null,
    expiresAt: null,
    tools: []
  }
}

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

function callbacks(): Pick<ProviderAuthActionsProps, 'onLogin' | 'onReauth' | 'onRevoke'> & {
  onLogin: ReturnType<typeof vi.fn<ProviderAuthActionsProps['onLogin']>>
  onReauth: ReturnType<typeof vi.fn<ProviderAuthActionsProps['onReauth']>>
  onRevoke: ReturnType<typeof vi.fn<ProviderAuthActionsProps['onRevoke']>>
} {
  return {
    onLogin: vi.fn<ProviderAuthActionsProps['onLogin']>(() => void h.log.push('login')),
    onReauth: vi.fn<ProviderAuthActionsProps['onReauth']>(() => void h.log.push('reauth')),
    onRevoke: vi.fn<ProviderAuthActionsProps['onRevoke']>(() => void h.log.push('revoke'))
  }
}

beforeEach(() => {
  h.open = false
  h.log = []
})

describe('ProviderAuthActions rendered wiring (AC13~AC16)', () => {
  it('none renders one primary 인증 button that calls login and no menu', () => {
    const cb = callbacks()
    const tree = ProviderAuthActions({ provider: provider('none'), authKind: 'pat', ...cb })
    const buttons = collect(tree, Button)
    expect(buttons).toHaveLength(1)
    expect(buttons[0].props).toMatchObject({
      variant: 'primary',
      children: 'skills.provider.authenticate'
    })
    expect(buttons[0].props.dropdown).toBeUndefined()
    expect(collect(tree, MenuItem)).toEqual([])
    ;(buttons[0].props.onClick as () => void)()
    expect(cb.onLogin).toHaveBeenCalledExactlyOnceWith('pat')
  })

  it.each(['valid', 'expired', 'unknown'] as const)(
    '%s renders the 재인증 dropdown with 재인증 first and a red 연결 해제 second',
    (status) => {
      const tree = ProviderAuthActions({
        provider: provider(status),
        authKind: null,
        ...callbacks()
      })
      const [trigger] = collect(tree, Button)
      expect(trigger.props).toMatchObject({ variant: 'primary', dropdown: true, expanded: false })
      const items = collect(tree, MenuItem)
      expect(items.map((item) => item.props.children)).toEqual([
        'skills.provider.reauth',
        'skills.provider.revoke'
      ])
      expect(items.map((item) => item.props.danger === true)).toEqual([false, true])
    }
  )

  it('each menu item closes the popup first, then calls exactly its own callback once', () => {
    const cb = callbacks()
    const tree = ProviderAuthActions({ provider: provider('valid'), authKind: 'pat', ...cb })
    const [reauth, revoke] = collect(tree, MenuItem)
    ;(reauth.props.onClick as () => void)()
    ;(revoke.props.onClick as () => void)()
    expect(h.log).toEqual(['setOpen(false)', 'reauth', 'setOpen(false)', 'revoke'])
    expect(cb.onReauth).toHaveBeenCalledExactlyOnceWith('pat')
    expect(cb.onRevoke).toHaveBeenCalledTimes(1)
    expect(cb.onLogin).not.toHaveBeenCalled()
  })
})
