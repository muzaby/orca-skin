import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', async (original) => {
  const actual = await original<typeof import('../../../../shared/i18n')>()
  return { ...actual, useI18n: () => ({ tr: actual.i18n.t.bind(actual.i18n), locale: 'ko' }) }
})
const fixture = vi.hoisted(() => ({
  state: {
    sessionId: 'A',
    backend: 'claude' as 'claude' | 'opencode',
    cwd: '/repo' as string | null,
    projectId: 'shared',
    pendingProjectId: null
  },
  remove: vi.fn()
}))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: typeof fixture.state) => unknown) => select(fixture.state),
  chatActions: { removeRightPanelTile: fixture.remove }
}))
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { NativeResourcesTileContent, NativeResourcesTileHeader } from './NativeResourcesTile'
import { useNativeResources } from '../../hooks/useNativeResources'
import type {
  NativeResources,
  NativeResourcesChanged
} from '../../../../../../shared/native-resources'

const snapshot = (): NativeResources => ({
  state: 'connected',
  generation: 'A-live',
  items: [
    {
      id: 'filesystem',
      kind: 'mcp',
      name: 'Filesystem',
      enabled: true,
      status: 'connected',
      canToggle: true
    },
    {
      id: 'github',
      kind: 'mcp',
      name: 'GitHub',
      enabled: true,
      status: 'needs-auth',
      canToggle: false
    },
    {
      id: 'powers',
      kind: 'plugin',
      name: 'Superpowers',
      enabled: true,
      status: 'enabled',
      canToggle: true
    }
  ]
})
const read = vi.fn<(request: string) => Promise<NativeResources>>()
const write = vi.fn<() => Promise<NativeResources>>()
const open = vi.fn()
let changed: (event: NativeResourcesChanged) => void
let dom: FakeDom
let composer: ReturnType<typeof useNativeResources>
function Surface({ panel = true }: { panel?: boolean }): React.JSX.Element {
  const native = useNativeResources('A', true, fixture.state.backend)
  useLayoutEffect(() => {
    composer = native
  }, [native])
  return createElement('div', null, panel && createElement(NativeResourcesTileContent))
}
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  vi.useFakeTimers()
  fixture.state.backend = 'claude'
  fixture.state.cwd = '/repo'
  fixture.remove.mockClear()
  read.mockReset().mockResolvedValue(snapshot())
  write.mockReset().mockResolvedValue(snapshot())
  open.mockReset().mockResolvedValue(undefined)
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  Object.assign(window, {
    orca: {
      session: {
        nativeResources: (request: string, observation?: { active: boolean }) =>
          observation ? Promise.resolve({ state: 'disconnected', items: [] }) : read(request),
        setNativeResource: write,
        openNativePlugin: open,
        onNativeResourcesChanged: (listener: typeof changed) => {
          changed = listener
          return () => {}
        }
      }
    }
  })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('shares one cold read between panel and Composer and reuses live cache on reopen and remount', async () => {
  let finish!: (value: NativeResources) => void
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  dom.render(createElement(Surface))
  await settle()
  expect(read).toHaveBeenCalledExactlyOnceWith('A')
  finish(snapshot())
  await settle()
  expect(dom.query('[data-native-status]')?.textContent).toContain('Filesystem')
  expect(dom.query('[data-native-status]')?.textContent).toContain('Superpowers')
  dom.render(createElement(Surface, { panel: false }))
  await settle()
  dom.render(createElement(Surface))
  await settle()
  dom.render(createElement('div'))
  await settle()
  dom.render(createElement(Surface))
  await settle()
  expect(read).toHaveBeenCalledTimes(1)
  expect(composer.view).toMatchObject({ value: { generation: 'A-live' } })
})

it('uses the native rows for statuses, independent async switches, native reveal and shared project pushes', async () => {
  dom.render(createElement(Surface))
  await settle()
  expect(dom.queryAll('[data-status-tone]').map((node) => node.props['data-status-tone'])).toEqual([
    'green',
    'amber',
    'green'
  ])
  expect(dom.queryAll('[data-cascade-level="1"]')).toHaveLength(0)
  dom.click(dom.query('[data-cascade-index="1"]')!)
  await settle()
  expect(open).toHaveBeenLastCalledWith({ sessionId: 'A', id: 'filesystem', kind: 'mcp' })
  dom.click(dom.query('[data-cascade-index="4"]')!)
  await settle()
  expect(open).toHaveBeenLastCalledWith({ sessionId: 'A', id: 'powers' })
  let finish!: (value: NativeResources) => void
  write.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  dom.click(dom.query('[aria-label="Filesystem: 프로젝트에서 비활성화"]')!)
  await settle()
  expect(dom.query('[data-toggle-thumb]')?.querySelector('[data-toggle-spinner]')).not.toBeNull()
  expect(dom.query('[aria-label="Superpowers: 프로젝트에서 비활성화"]')?.props.disabled).toBeFalsy()
  const disabled = snapshot()
  disabled.items[0] = { ...disabled.items[0], enabled: false, status: 'disabled' }
  changed({ sessionId: 'A', resources: disabled })
  finish(disabled)
  await settle()
  expect(dom.query('[aria-label="Filesystem: 프로젝트에서 활성화"]')?.props['aria-checked']).toBe(
    false
  )
  expect(dom.query('[data-toggle-spinner]')).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
})

it('shows the correct branded project title, rename and workspace fallback for both harnesses', async () => {
  for (const backend of ['claude', 'opencode'] as const) {
    fixture.state.backend = backend
    dom.render(
      createElement(NativeResourcesTileHeader, {
        projectName: '프로젝트 Alpha',
        projectPath: '/project-root'
      })
    )
    await settle()
    const name = backend === 'claude' ? 'Claude' : 'OpenCode'
    expect(dom.query('[data-native-status-title]')?.textContent).toBe(
      name + ' 상태 · 프로젝트 Alpha'
    )
    expect(dom.query('[data-native-status-title]')?.props.title).toBe('/project-root')
    expect(dom.query('[viewBox]')?.props.className).toContain(
      backend === 'claude' ? 'text-spinner' : 'text-oc-ink'
    )
    expect(dom.query('[data-native-status-title]')?.children[1].props.className).toContain(
      'font-normal'
    )
    expect(dom.queryAll('[viewBox]')).toHaveLength(1)
    expect(dom.query('[viewBox]')?.props.viewBox).toBe(
      backend === 'claude' ? '0 0 248 248' : '0 0 16 20'
    )
    dom.render(
      createElement(NativeResourcesTileHeader, {
        projectName: '이름 변경',
        projectPath: '/changed-root'
      })
    )
    await settle()
    expect(dom.query('[data-native-status-title]')?.textContent).toBe(name + ' 상태 · 이름 변경')
    expect(dom.query('[data-native-status-title]')?.props.title).toBe('/changed-root')
    fixture.state.cwd = '/workspace/child'
    dom.render(createElement(NativeResourcesTileHeader, {}))
    await settle()
    expect(dom.query('[data-native-status-title]')?.textContent).toBe(name + ' 상태 · child')
    expect(dom.query('[data-native-status-title]')?.props.title).toBe('/workspace/child')
    fixture.state.cwd = null
    dom.render(createElement(NativeResourcesTileHeader, {}))
    await settle()
    expect(dom.query('[data-native-status-title]')?.props.title).toBeUndefined()
  }
})

it('lists read-only OpenCode resources without inventing unsupported controls', async () => {
  fixture.state.backend = 'opencode'
  const value = snapshot()
  value.items = value.items.map((item) => ({ ...item, canToggle: false }))
  read.mockResolvedValueOnce(value)
  dom.render(createElement(Surface))
  await settle()
  expect(dom.query('[data-native-status="opencode"]')?.textContent).toContain('Superpowers')
  expect(dom.queryAll('[role="menuitemcheckbox"]')).toHaveLength(0)
  dom.click(dom.query('[data-cascade-index="1"]')!)
  await settle()
  expect(open).toHaveBeenCalledOnce()
  expect(write).not.toHaveBeenCalled()
})
