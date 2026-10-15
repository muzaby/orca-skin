import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import type {
  Backend,
  CreateEngineRequest,
  EngineUserSettingsResult
} from '../../../../../../shared/ipc'
import { EngineFormModal } from '../../components/EngineFormModal'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
vi.mock('react-i18next', () => ({ Trans: () => null }))
vi.mock('../../../../shared/ui/Modal', () => ({
  Modal: ({ children, onClose }: { children: ReactNode; onClose: () => void }) =>
    createElement('section', { onClose }, children)
}))

let dom: FakeDom
let read: ReturnType<typeof vi.fn<(engine: Backend) => Promise<EngineUserSettingsResult>>>
let submit: ReturnType<typeof vi.fn<(payload: CreateEngineRequest) => Promise<void>>>
let close: ReturnType<typeof vi.fn<() => void>>
function mount(engine: Backend = 'opencode', busy = false): void {
  dom.render(
    createElement(EngineFormModal, { mode: 'add', engine, busy, onSubmit: submit, onClose: close })
  )
}
function nodes(root = dom.body): FakeNode[] {
  return [root, ...root.children.flatMap((child) => nodes(child))]
}
function button(text: string): FakeNode {
  const found = nodes().find((node) => node.tag === 'button' && node.textContent === text)
  if (!found) throw new Error(`missing button: ${text}`)
  return found
}
const editor = (): FakeNode => nodes().find((node) => node.tag === 'textarea')!
function change(node: FakeNode, value: string): void {
  dom.act(() =>
    (node.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  )
}
function deferred(): {
  promise: Promise<EngineUserSettingsResult>
  resolve: (value: EngineUserSettingsResult) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: EngineUserSettingsResult) => void
  let reject!: (error: Error) => void
  const promise = new Promise<EngineUserSettingsResult>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  dom.act(() => {})
}
function importButton(engine: Backend = 'opencode'): FakeNode {
  return button(
    engine === 'opencode' ? 'engine.form.openCodeImportButton' : 'engine.form.importButton'
  )
}
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  read = vi.fn().mockResolvedValue({ exists: true, settingsJson: '{"model":"fixture/한국어"}' })
  Object.assign(window, { orca: { engine: { importUserSettings: read } } })
  submit = vi.fn(async () => {})
  close = vi.fn()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('engine form settings import', () => {
  it.each(['opencode', 'claude'] as const)(
    'loads selected harness into the draft and imports then submits without changing the provider: %s',
    async (engine) => {
      mount(engine)
      const provider = nodes().find((node) => node.tag === 'input')!.props.value
      dom.click(importButton(engine))
      expect(read).toHaveBeenCalledExactlyOnceWith(engine)
      expect(submit).not.toHaveBeenCalled()
      await settle()
      expect(editor().props.value).toBe('{"model":"fixture/한국어"}')
      dom.click(button('engine.form.addAction'))
      expect(submit).toHaveBeenCalledExactlyOnceWith({
        engine,
        provider,
        settingsJson: '{"model":"fixture/한국어"}'
      })
    }
  )

  it('prevents duplicate imports and retries after failure', async () => {
    const pending = deferred()
    read.mockReturnValueOnce(pending.promise)
    mount()
    const click = importButton().props.onClick as () => void
    dom.act(() => {
      click()
      click()
    })
    expect(read).toHaveBeenCalledTimes(1)
    expect(button('common.loading').props.disabled).toBe(true)
    expect(button('engine.form.addAction').props.disabled).toBe(true)
    pending.reject(new Error('fixture IPC failure'))
    await settle()
    expect(dom.body.textContent).toContain('engine.form.openCodeImportFailed')
    expect(editor().props.value).toBe('{}')
    dom.click(importButton())
    await settle()
    expect(read).toHaveBeenCalledTimes(2)
    expect(dom.body.textContent).not.toContain('engine.form.openCodeImportFailed')
  })

  it.each(['opencode', 'claude'] as const)(
    'preserves the draft when the %s file is absent',
    async (engine) => {
      read.mockResolvedValue({ exists: false, settingsJson: '' })
      mount(engine)
      change(editor(), '{"draft":true}')
      dom.click(importButton(engine))
      await settle()
      expect(editor().props.value).toBe('{"draft":true}')
      expect(dom.body.textContent).toContain(
        engine === 'opencode' ? 'engine.form.openCodeImportNotFound' : 'engine.form.importNotFound'
      )
    }
  )

  it('keeps invalid imported JSON editable and prevents saving it', async () => {
    read.mockResolvedValue({ exists: true, settingsJson: '{broken' })
    mount()
    dom.click(importButton())
    await settle()
    expect(editor().props.value).toBe('{broken')
    expect(button('engine.form.addAction').props.disabled).toBe(true)
    change(editor(), '{}')
    expect(button('engine.form.addAction').props.disabled).toBe(false)
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores stale results and errors after harness changes: %s',
    async (outcome) => {
      const old = deferred()
      const current = deferred()
      read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)
      mount()
      dom.click(importButton())
      change(
        nodes().find((node) => node.tag === 'select')!,
        'claude'
      )
      const draft = editor().props.value
      dom.click(importButton('claude'))
      if (outcome === 'resolve') old.resolve({ exists: true, settingsJson: '{"old":true}' })
      else old.reject(new Error('stale'))
      await settle()
      expect(editor().props.value).toBe(draft)
      expect(button('common.loading').props.disabled).toBe(true)
      expect(dom.body.textContent).not.toContain('ImportFailed')
      current.resolve({ exists: true, settingsJson: '{"current":true}' })
      await settle()
      expect(editor().props.value).toBe('{"current":true}')
    }
  )

  it.each(['edit', 'provider', 'cancel', 'dismiss', 'unmount'] as const)(
    'discards responses after %s',
    async (action) => {
      const pending = deferred()
      read.mockReturnValueOnce(pending.promise)
      mount(action === 'provider' ? 'claude' : 'opencode')
      dom.click(importButton(action === 'provider' ? 'claude' : 'opencode'))
      if (action === 'edit') change(editor(), '{"new":true}')
      if (action === 'provider') {
        dom.click(nodes().find((node) => node.props['aria-haspopup'] === 'menu')!)
        dom.click(nodes().filter((node) => node.props.role === 'menuitem')[1]!)
      }
      if (action === 'cancel') dom.click(button('common.cancel'))
      if (action === 'dismiss')
        dom.act(() =>
          (nodes().find((node) => node.tag === 'section')!.props.onClose as () => void)()
        )
      if (action === 'unmount') dom.unmount()
      const before = action === 'unmount' ? undefined : editor().props.value
      pending.resolve({ exists: true, settingsJson: '{"stale":true}' })
      await settle()
      expect(action === 'unmount' ? undefined : editor().props.value).toBe(before)
      if (action === 'cancel' || action === 'dismiss') expect(close).toHaveBeenCalledOnce()
    }
  )

  it('disables importing while the form is saving', () => {
    mount('opencode', true)
    expect(importButton().props.disabled).toBe(true)
    dom.click(importButton())
    expect(read).not.toHaveBeenCalled()
  })
})
