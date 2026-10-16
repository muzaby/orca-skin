import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { EngineFormModal } from '../../components/EngineFormModal'
import type { CreateEngineRequest, EngineUserSettingsResult } from '../../../../../../shared/ipc'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/ui/Modal', () => ({
  Modal: ({ children, onClose }: { children: ReactNode; onClose: () => void }) =>
    createElement('section', { onClose }, children)
}))
vi.mock('../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string, values?: { count?: number }) => key + (values?.count ?? '') })
}))
const api = vi.hoisted(() => ({ read: vi.fn<() => Promise<EngineUserSettingsResult>>() }))
vi.mock('../../../../shared/api/ipc', () => ({ engineApi: { importUserSettings: api.read } }))
let dom: FakeDom
const submit = vi.fn<(payload: CreateEngineRequest) => Promise<void>>(async () => {}),
  close = vi.fn()
const nodes = (root: FakeNode): FakeNode[] => [root, ...root.children.flatMap(nodes)]
const button = (label: string): FakeNode =>
  nodes(dom.body).find(
    (node) =>
      node.tag === 'button' && (node.textContent === label || node.props['aria-label'] === label)
  )!
const field = (label: string): FakeNode =>
  nodes(dom.body).find(
    (node) => node.tag === 'input' && node.props['aria-label'] === 'engine.openCode.' + label
  )!
function change(node: FakeNode, value: string): void {
  dom.act(() =>
    (node.props.onChange as (e: { target: { value: string } }) => void)({ target: { value } })
  )
}
function mount(): void {
  dom.render(
    createElement(EngineFormModal, {
      mode: 'add',
      engine: 'opencode',
      onSubmit: submit,
      onClose: close
    })
  )
}
function send(): void {
  dom.act(() =>
    (
      nodes(dom.body).find((node) => node.tag === 'form')!.props.onSubmit as (e: {
        preventDefault: () => void
      }) => void
    )({ preventDefault: vi.fn() })
  )
}
function fill(): void {
  for (const [key, value] of Object.entries({
    id: 'fixture',
    name: 'Fixture',
    baseURL: 'http://localhost:1234/v1',
    modelId1: 'first',
    modelName1: 'First'
  }))
    change(field(key), value)
}
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  submit.mockReset().mockResolvedValue()
  close.mockReset()
  api.read.mockReset()
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpenCode provider form through production engine router', () => {
  it('validates fields, adds and removes rows and submits native settings with the selected harness', async () => {
    mount()
    send()
    expect(submit).not.toHaveBeenCalled()
    expect(dom.body.textContent).toContain('engine.openCode.required')
    fill()
    dom.click(button('engine.openCode.addModel'))
    change(field('modelId2'), 'second')
    change(field('modelName2'), 'Second')
    dom.click(button('engine.openCode.addHeader'))
    change(field('headerKey2'), 'X-Mode')
    change(field('headerValue2'), 'test')
    dom.click(button('engine.openCode.removeHeader1'))
    expect(field('headerKey1').props.value).toBe('X-Mode')
    expect(button('engine.openCode.removeHeader1').props.disabled).toBe(true)
    send()
    await settle()
    expect(submit).toHaveBeenCalledOnce()
    const payload = submit.mock.calls[0][0] as unknown as {
      engine: string
      provider: string
      settingsJson: string
    }
    expect(payload).toMatchObject({ engine: 'opencode', provider: 'fixture' })
    expect(JSON.parse(payload.settingsJson).provider.fixture).toMatchObject({
      npm: '@ai-sdk/openai-compatible',
      options: { baseURL: 'http://localhost:1234/v1', headers: { 'X-Mode': 'test' } },
      models: { first: { name: 'First' }, second: { name: 'Second' } }
    })
    expect(nodes(dom.body).filter((node) => node.tag === 'textarea')).toHaveLength(0)
  })
  it('retains the draft on save failure and prevents repeated synchronous submits', async () => {
    submit.mockRejectedValueOnce(new Error('Save failed'))
    mount()
    fill()
    send()
    send()
    await settle()
    expect(submit).toHaveBeenCalledOnce()
    expect(dom.body.textContent).toContain('Save failed')
    expect(field('id').props.value).toBe('fixture')
    expect(close).not.toHaveBeenCalled()
  })
  it('imports compatible provider fields and submits only the selected provider without hidden metadata', async () => {
    const source = {
      provider: Object.fromEntries(
        ['one', 'two'].map((id) => [
          id,
          {
            npm: '@ai-sdk/openai-compatible',
            name: id,
            options: { baseURL: 'https://example.test/v1', timeout: 3000 },
            models: { model: { name: 'Model', limit: { context: 8000 } } }
          }
        ])
      )
    }
    api.read.mockResolvedValue({ exists: true, settingsJson: JSON.stringify(source) })
    mount()
    dom.click(button('engine.form.openCodeImportButton'))
    await settle()
    expect(api.read).toHaveBeenCalledExactlyOnceWith('opencode')
    expect(submit).not.toHaveBeenCalled()
    const select = nodes(dom.body).find((node) => node.tag === 'select')!
    change(select, 'two')
    expect(field('id').props.value).toBe('two')
    send()
    await settle()
    const payload = submit.mock.calls[0][0] as unknown as { settingsJson: string }
    expect(JSON.parse(payload.settingsJson)).toEqual({
      $schema: 'https://opencode.ai/config.json',
      enabled_providers: ['two'],
      provider: {
        two: {
          npm: '@ai-sdk/openai-compatible',
          name: 'two',
          options: { baseURL: 'https://example.test/v1' },
          whitelist: ['model'],
          models: { model: { name: 'Model' } }
        }
      }
    })
  })
  it.each(['edit', 'cancel', 'dismiss', 'unmount'] as const)(
    'discards a pending import after %s',
    async (action) => {
      let resolve!: (result: EngineUserSettingsResult) => void
      api.read.mockReturnValue(
        new Promise((done) => {
          resolve = done
        })
      )
      mount()
      fill()
      dom.click(button('engine.form.openCodeImportButton'))
      expect(button('engine.form.addAction').props.disabled).toBe(true)
      if (action === 'edit') change(field('name'), 'New name')
      if (action === 'cancel') dom.click(button('common.cancel'))
      if (action === 'dismiss')
        dom.act(() =>
          (nodes(dom.body).find((node) => node.tag === 'section')!.props.onClose as () => void)()
        )
      if (action === 'unmount') dom.unmount()
      resolve({ exists: true, settingsJson: '{broken' })
      await settle()
      expect(dom.body.textContent).not.toContain('engine.form.openCodeImportFailed')
      if (action === 'edit') expect(field('name').props.value).toBe('New name')
      if (action === 'cancel' || action === 'dismiss') expect(close).toHaveBeenCalledOnce()
    }
  )
  it.each([
    ['absent', { exists: false, settingsJson: '' }, 'engine.form.openCodeImportNotFound'],
    ['unsupported', { exists: true, settingsJson: '{}' }, 'engine.openCode.importUnsupported'],
    ['invalid', { exists: true, settingsJson: '{broken' }, 'engine.form.openCodeImportFailed']
  ] as const)('keeps the draft on %s import and supports retry', async (_, result, message) => {
    api.read.mockResolvedValue(result)
    mount()
    fill()
    dom.click(button('engine.form.openCodeImportButton'))
    await settle()
    expect(dom.body.textContent).toContain(message)
    expect(field('id').props.value).toBe('fixture')
    dom.click(button('engine.form.openCodeImportButton'))
    await settle()
    expect(api.read).toHaveBeenCalledTimes(2)
  })
})
