import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
import { createElement, useLayoutEffect } from 'react'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { NativeResourcesMenu } from '../components/NativeResourcesMenu'
import { useNativeResources } from './useNativeResources'
import type { NativeResource, NativeResources } from '../../../../../shared/native-resources'

const resource: NativeResource = {
  id: 'native-B',
  kind: 'mcp',
  name: 'Native B',
  status: 'connected',
  enabled: true,
  canToggle: true
}
const snapshot = (generation = 'gen-B'): NativeResources => ({
  state: 'connected',
  generation,
  items: [resource]
})
let dom: FakeDom
let current: ReturnType<typeof useNativeResources>
const read = vi.fn<(id: string) => Promise<NativeResources>>()
const write = vi.fn<(req: unknown) => Promise<NativeResources>>()
function Probe({ id, open = true }: { id: string | null; open?: boolean }): null {
  const result = useNativeResources(id, open)
  useLayoutEffect(() => {
    current = result
  }, [result])
  return null
}
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  vi.useFakeTimers()
  read.mockReset().mockResolvedValue(snapshot())
  write.mockReset().mockResolvedValue({
    ...snapshot(),
    items: [{ ...resource, enabled: false, status: 'disabled' }]
  })
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  Object.assign(window, { orca: { session: { nativeResources: read, setNativeResource: write } } })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('native resources session lifecycle', () => {
  it('carries session/generation/resource fields and serializes toggles, without optimistic success', async () => {
    dom.render(createElement(Probe, { id: 'session-B' }))
    await settle()
    expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
    expect(current.view).toEqual({ status: 'ready', value: snapshot() })
    let finish!: (result: NativeResources) => void
    write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = current.toggle(resource)
    await current.toggle(resource)
    dom.act(() => {})
    expect(current.busy).toBe(true)
    expect(write).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'session-B',
      generation: 'gen-B',
      kind: 'mcp',
      id: 'native-B',
      enabled: false
    })
    expect(current.view).toEqual({ status: 'ready', value: snapshot() })
    finish({ ...snapshot(), items: [{ ...resource, enabled: false, status: 'disabled' }] })
    await pending
    await settle()
    await current.toggle({ ...resource, enabled: false })
    expect(write).toHaveBeenLastCalledWith({
      sessionId: 'session-B',
      generation: 'gen-B',
      kind: 'mcp',
      id: 'native-B',
      enabled: true
    })
    await current.toggle({ ...resource, kind: 'plugin', canToggle: false })
    expect(write).toHaveBeenCalledTimes(2)
  })
  it.each(['read', 'write'] as const)(
    'discards a late %s after changing session',
    async (operation) => {
      let finish!: (result: NativeResources) => void
      if (operation === 'read')
        read.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve
            })
        )
      dom.render(createElement(Probe, { id: 'session-A' }))
      await settle()
      let pending: Promise<void> | undefined
      if (operation === 'write') {
        write.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve
            })
        )
        pending = current.toggle(resource)
      }
      read.mockResolvedValueOnce(snapshot('gen-C'))
      dom.render(createElement(Probe, { id: 'session-C' }))
      expect(current.view.status).toBe('loading')
      await settle()
      finish(snapshot('stale'))
      await pending
      await settle()
      expect(current.view).toEqual({ status: 'ready', value: snapshot('gen-C') })
    }
  )
  it('distinguishes disconnected from failure and retries on reopening; closing discards pending state', async () => {
    dom.render(createElement(Probe, { id: null }))
    await settle()
    expect(current.view).toEqual({ status: 'ready', value: { state: 'disconnected', items: [] } })
    expect(read).not.toHaveBeenCalled()
    read.mockRejectedValueOnce(new Error('offline'))
    dom.render(createElement(Probe, { id: 'session-B' }))
    await settle()
    expect(current.view).toEqual({ status: 'error' })
    dom.render(createElement(Probe, { id: 'session-B', open: false }))
    dom.render(createElement(Probe, { id: 'session-B', open: true }))
    await settle()
    expect(current.view.status).toBe('ready')
    write.mockRejectedValueOnce(new Error('denied'))
    await current.toggle(resource)
    await settle()
    expect(current.view.status).toBe('error')
  })
})

it('renders the live session menu and keeps it open while the MCP toggle refreshes', async () => {
  const onClose = vi.fn()
  dom.render(
    createElement(NativeResourcesMenu, {
      sessionId: 'session-B',
      backend: 'opencode',
      anchorRef: { current: null },
      onClose
    })
  )
  await settle()
  expect(read).toHaveBeenCalledExactlyOnceWith('session-B')
  expect(dom.query('[data-native-resources="opencode"]')?.textContent).toContain('OpenCode')
  dom.click(dom.query('[data-cascade-level="0"][data-cascade-index="0"]')!)
  const item = dom.query('[data-cascade-level="1"][data-cascade-index="0"]')!
  expect(item.props['aria-checked']).toBe(true)
  dom.click(item)
  await settle()
  expect(write).toHaveBeenCalledExactlyOnceWith({
    sessionId: 'session-B',
    generation: 'gen-B',
    kind: 'mcp',
    id: 'native-B',
    enabled: false
  })
  expect(dom.query('[data-cascade-level="1"][data-cascade-index="0"]')?.props['aria-checked']).toBe(
    false
  )
  expect(onClose).not.toHaveBeenCalled()
  dom.keyDown('Escape')
  expect(onClose).toHaveBeenCalledOnce()
})
