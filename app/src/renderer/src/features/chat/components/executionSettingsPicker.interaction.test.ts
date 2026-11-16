// 실행 설정 칩 — 칩을 실제로 열고 컴포저 메뉴 항목을 누르면 고른 값이 `onChange` 로 나가고
// 나머지 필드는 유지되는지 본다(0320 AC36 · EP-10 B). 값이 없으면 카탈로그 기본 모델로 채운다.

import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../shared/ipc'
import type { PromptExecution } from '../../../../../shared/scheduled-tasks'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'

const agents: AgentEnvironment[] = [
  {
    key: 'claude:team',
    adapter: 'claude',
    supported: true,
    models: [
      {
        alias: 'sonnet',
        model: 'sonnet-m',
        isCustom: false,
        oneMillionContext: false,
        isDefault: true
      },
      {
        alias: 'opus',
        model: 'opus-m',
        isCustom: false,
        oneMillionContext: false,
        isDefault: false
      }
    ]
  }
]
vi.mock('react', async (original) => {
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...(await original<typeof import('react')>()),
    ...fakeHooks,
    useId: () => fakeHooks.useMemo(() => 'test-id', [])
  }
})
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../shared/hooks/useAgents', () => ({ useAgents: () => agents }))
vi.mock('../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
import { ExecutionSettingsPicker } from './ExecutionSettingsPicker'

const base: PromptExecution = {
  backend: 'claude',
  agentKind: 'code',
  providerKey: 'claude:team',
  modelFamily: 'sonnet-m',
  permissionMode: 'default'
}

let dom: FakeDom
let onChange: ReturnType<typeof vi.fn<(value: PromptExecution | null) => void>>

const render = (value: PromptExecution | null): void =>
  dom.render(createElement(ExecutionSettingsPicker, { value, onChange }))
// 칩을 열고 텍스트가 `label` 로 시작하는 메뉴 항목을 누른다.
const pick = (chipTitle: string, label: string): void => {
  const chip = dom.query(`[data-menu-chip][aria-label="${chipTitle}"]`)
  expect(chip, chipTitle).not.toBeNull()
  dom.click(chip!)
  const item = dom
    .queryAll('[role="menuitemradio"]')
    .find((node: FakeNode) => node.textContent.trim().toLowerCase().startsWith(label.toLowerCase()))
  expect(item, `${chipTitle} → ${label}`).toBeDefined()
  dom.click(item!)
}
const last = (): PromptExecution | null => {
  expect(onChange).toHaveBeenCalledTimes(1)
  return onChange.mock.calls[0]![0]
}

beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1400, innerHeight: 900 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  onChange = vi.fn<(value: PromptExecution | null) => void>()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('ExecutionSettingsPicker — 고른 값이 나간다', () => {
  it('값이 없으면 카탈로그 기본 모델로 채우고, 값이 있으면 건드리지 않는다', () => {
    render(null)
    expect(last()).toMatchObject({
      backend: 'claude',
      providerKey: 'claude:team',
      modelFamily: 'sonnet-m'
    })
    onChange.mockClear()
    dom.unmount()
    render({ ...base, modelFamily: 'opus-m' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('모델을 고르면 그 모델이 되고 권한은 유지된다', () => {
    render({ ...base, permissionMode: 'plan' })
    pick('schedules.modal.model', 'opus')
    expect(last()).toMatchObject({
      modelFamily: 'opus-m',
      providerKey: 'claude:team',
      permissionMode: 'plan'
    })
  })

  it('작업 종류를 고르면 그 종류가 되고 나머지는 유지된다', () => {
    render({ ...base, effort: 'high' })
    pick('schedules.modal.agentKind', 'chat.agent.work')
    expect(last()).toMatchObject({ agentKind: 'work', modelFamily: 'sonnet-m', effort: 'high' })
  })

  it('노력을 고르면 그 값이 된다', () => {
    render(base)
    pick('schedules.modal.effort', 'chat.composer.effort.low.label')
    expect(last()).toMatchObject({
      effort: 'low',
      permissionMode: 'default',
      modelFamily: 'sonnet-m'
    })
  })

  it('권한을 고르면 그 값이 된다', () => {
    render(base)
    pick('schedules.modal.permission', 'chat.composer.modes.plan.label')
    expect(last()).toMatchObject({
      permissionMode: 'plan',
      agentKind: 'code',
      modelFamily: 'sonnet-m'
    })
  })
})
