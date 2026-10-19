import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { useAgentStore } from '../../../../shared/stores/agentStore'
import { AgentEnvironmentView } from '../../components/AgentEnvironmentView'

// Keep the production view, cards, forms, hook, store and API wrappers; adapt only
// React/browser bindings and replace the external preload boundary with API fixtures.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../../../../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    ...fakeHooks,
    useSyncExternalStore: (subscribe: (fn: () => void) => () => void, get: () => unknown) => {
      const [, force] = fakeHooks.useState(0)
      fakeHooks.useEffect(() => subscribe(() => force((value: number) => value + 1)), [subscribe])
      return get()
    }
  }
})
vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { useSyncExternalStore } = await import('react')
  const create = <T>(
    initialize: import('zustand').StateCreator<T>
  ): (<U>(select: (state: T) => U) => U) & import('zustand').StoreApi<T> => {
    const api = createStore(initialize)
    return Object.assign(
      <U>(select: (state: T) => U): U =>
        useSyncExternalStore(api.subscribe, () => select(api.getState())),
      api
    )
  }
  return { create }
})
vi.mock(
  'react-dom',
  async () => (await import('../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../../shared/ui/Modal', () => ({
  Modal: ({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) =>
    createElement('section', { role: 'dialog', 'aria-label': ariaLabel }, children)
}))
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))
vi.mock('react-i18next', async (original) => ({
  ...(await original<typeof import('react-i18next')>()),
  Trans: () => null
}))

const agents: AgentEnvironment[] = [
  { key: 'claude-first', adapter: 'claude', provider: 'first', supported: true, models: [] },
  ...(['claude', 'opencode'] as const).map((adapter) => ({
    key: `${adapter}-shared`,
    adapter,
    provider: 'shared',
    supported: true,
    models: [
      {
        alias: `${adapter}-original`,
        model: `${adapter}-original`,
        isCustom: true,
        isDefault: true,
        oneMillionContext: false
      }
    ]
  }))
]
const documents: Record<string, string> = {
  'claude-first': '{"env":{"ANTHROPIC_MODEL":"first-only"}}',
  'claude-shared': '{"env":{"ANTHROPIC_MODEL":"claude-original"}}',
  'opencode-shared':
    '{"provider":{"shared":{"models":{"opencode-original":{"name":"Original OpenCode"}}}}}'
}
let dom: FakeDom
let list: ReturnType<typeof vi.fn>
let read: ReturnType<typeof vi.fn>
let update: ReturnType<typeof vi.fn>
let remove: ReturnType<typeof vi.fn>
let add: ReturnType<typeof vi.fn>
let confirm: ReturnType<typeof vi.fn>
const nodes = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(nodes)]
const button = (text: string, root = dom.body): FakeNode => {
  const found = nodes(root).find((node) => node.tag === 'button' && node.textContent === text)
  if (!found) throw new Error(`missing button ${text}`)
  return found
}
const cardButton = (key: string, label: string): FakeNode => {
  let node = nodes(dom.body).find((candidate) => candidate.textContent === key)
  while (node) {
    const found = nodes(node).find(
      (candidate) => candidate.tag === 'button' && candidate.textContent === label
    )
    if (found) return found
    node = node.parent ?? undefined
  }
  throw new Error(`missing ${label} for ${key}`)
}
const editor = (): FakeNode | undefined => nodes(dom.body).find((node) => node.tag === 'textarea')
const change = (node: FakeNode, value: string): void =>
  dom.act(() => (node.props.onChange as (event: unknown) => void)({ target: { value } }))
const settle = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}
const mount = async (): Promise<void> => {
  dom.render(createElement(AgentEnvironmentView))
  await settle()
  expect(list).toHaveBeenCalledTimes(1)
  expect(dom.body.textContent).toContain('claude-first')
  expect(dom.body.textContent).toContain('claude-shared')
  expect(dom.body.textContent).toContain('opencode-shared')
}
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  list = vi.fn().mockResolvedValue(agents)
  read = vi.fn(async (key: string) => ({
    key,
    engine: agents.find((agent) => agent.key === key)!.adapter,
    provider: agents.find((agent) => agent.key === key)!.provider,
    settingsJson: documents[key]
  }))
  update = vi.fn().mockResolvedValue({})
  remove = vi.fn().mockResolvedValue(undefined)
  add = vi.fn().mockResolvedValue({})
  confirm = vi.fn(() => true)
  Object.assign(window, {
    confirm,
    orca: {
      agent: { list },
      engine: { read, update, delete: remove, add },
      provider: { onState: () => () => {} }
    }
  })
  useAgentStore.setState({ agents: [], loaded: false, loading: false, error: null })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each(['claude', 'opencode'] as const)(
  'adds the selected %s harness through the production menu, form and API',
  async (backend) => {
    await mount()
    dom.click(button('engine.addEngine'))
    dom.click(button(backend === 'claude' ? 'Claude' : 'OpenCode'))
    if (backend === 'claude') {
      dom.click(
        nodes(dom.body).find(
          (node) =>
            node.tag === 'button' && node.textContent.includes('engine.provider.anthropic.label')
        )!
      )
      dom.click(
        nodes(dom.body).find(
          (node) =>
            node.props.role === 'menuitem' &&
            node.textContent.includes('engine.provider.custom.label')
        )!
      )
      change(
        nodes(dom.body).find((node) => node.tag === 'input')!,
        'claude-new'
      )
      change(editor()!, '{"env":{"ANTHROPIC_MODEL":"new-claude-model"}}')
      dom.click(button('engine.form.addAction'))
    } else {
      for (const [label, value] of Object.entries({
        id: 'open-new',
        name: 'New OpenCode',
        baseURL: 'https://fixture.invalid/v1',
        modelId: 'new-open-model',
        modelName: 'New Open model'
      })) {
        change(dom.query(`[aria-label="engine.openCode.${label}"]`)!, value)
      }
      const form = nodes(dom.body).find((node) => node.tag === 'form')!
      dom.act(() => (form.props.onSubmit as (event: unknown) => void)({ preventDefault: () => {} }))
    }
    await settle()
    expect(add).toHaveBeenCalledTimes(1)
    const request = add.mock.calls[0][0]
    expect(request).toMatchObject({
      engine: backend,
      provider: backend === 'claude' ? 'claude-new' : 'open-new'
    })
    expect(JSON.parse(request.settingsJson)).toEqual(
      backend === 'claude'
        ? { env: { ANTHROPIC_MODEL: 'new-claude-model' } }
        : {
            $schema: 'https://opencode.ai/config.json',
            enabled_providers: ['open-new'],
            provider: {
              'open-new': {
                npm: '@ai-sdk/openai-compatible',
                name: 'New OpenCode',
                options: { baseURL: 'https://fixture.invalid/v1' },
                whitelist: ['new-open-model'],
                models: { 'new-open-model': { name: 'New Open model' } }
              }
            }
          }
    )
    expect(update).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(list).toHaveBeenCalledTimes(2)
    expect(dom.body.textContent).not.toContain('engine.form.titleAdd')
  }
)

it.each(['claude', 'opencode'] as const)(
  'edits the selected nonfirst %s engine through the production view, form, hook and API',
  async (backend) => {
    const key = `${backend}-shared`
    const changedAgents = agents.map((agent) =>
      agent.key === key
        ? {
            ...agent,
            models: [
              { ...agent.models[0], alias: `${backend}-changed`, model: `${backend}-changed` }
            ]
          }
        : agent
    )
    list.mockResolvedValueOnce(agents).mockResolvedValue(changedAgents)
    await mount()
    dom.click(cardButton(key, 'common.edit'))
    await settle()
    expect(read).toHaveBeenCalledExactlyOnceWith(key)
    expect(confirm).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(dom.body.textContent).toContain('engine.form.titleEdit')
    expect(dom.query('[role="dialog"]')?.textContent).toContain(
      backend === 'claude' ? 'claude' : 'OpenCode'
    )
    expect(
      nodes(dom.query('[role="dialog"]')!).some(
        (node) => node.tag === 'span' && node.textContent === 'shared'
      )
    ).toBe(true)
    expect(editor()?.props.value).toBe(documents[key])
    const edited =
      backend === 'claude'
        ? '{"env":{"ANTHROPIC_MODEL":"claude-changed"}}'
        : '{"provider":{"shared":{"models":{"opencode-changed":{"name":"Changed OpenCode"}}}}}'
    change(editor()!, edited)
    dom.click(button('common.save'))
    await settle()
    expect(update).toHaveBeenCalledExactlyOnceWith({ key, settingsJson: edited })
    expect(add).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(editor()).toBeUndefined()
    expect(list).toHaveBeenCalledTimes(2)
    expect(dom.body.textContent).toContain(`${backend}-changed`)
    const other = backend === 'claude' ? 'opencode' : 'claude'
    expect(dom.body.textContent).toContain(`${other}-original`)
    expect(useAgentStore.getState().agents.find((agent) => agent.key === 'claude-first')).toBe(
      agents[0]
    )
  }
)

it.each(['claude', 'opencode'] as const)(
  'deletes only the confirmed %s engine and refreshes the catalog',
  async (backend) => {
    const key = `${backend}-shared`
    list
      .mockResolvedValueOnce(agents)
      .mockResolvedValue(agents.filter((agent) => agent.key !== key))
    await mount()
    confirm.mockReturnValueOnce(false)
    dom.click(cardButton(key, 'common.delete'))
    await settle()
    expect(confirm).toHaveBeenCalledExactlyOnceWith('engine.deleteConfirm')
    expect(remove).not.toHaveBeenCalled()
    dom.click(cardButton(key, 'common.delete'))
    await settle()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledExactlyOnceWith(key)
    expect(read).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(list).toHaveBeenCalledTimes(2)
    expect(dom.body.textContent).not.toContain(key)
    expect(dom.body.textContent).toContain(
      backend === 'claude' ? 'opencode-shared' : 'claude-shared'
    )
    expect(dom.body.textContent).toContain('claude-first')
  }
)

it('shows read errors without opening an empty editor or mutating an engine', async () => {
  await mount()
  read.mockRejectedValueOnce(new Error('fixture read failed'))
  dom.click(cardButton('opencode-shared', 'common.edit'))
  await settle()
  expect(dom.body.textContent).toContain('fixture read failed')
  expect(editor()).toBeUndefined()
  expect(update).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it('disables only the selected card while its settings read is pending', async () => {
  await mount()
  let resolve!: (value: unknown) => void
  read.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  dom.click(cardButton('opencode-shared', 'common.edit'))
  expect(read).toHaveBeenCalledExactlyOnceWith('opencode-shared')
  expect(cardButton('opencode-shared', 'common.edit').props.disabled).toBe(true)
  expect(cardButton('claude-shared', 'common.edit').props.disabled).toBe(false)
  expect(editor()).toBeUndefined()
  resolve({
    key: 'opencode-shared',
    engine: 'opencode',
    provider: 'shared',
    settingsJson: documents['opencode-shared']
  })
  await settle()
  expect(editor()?.props.value).toBe(documents['opencode-shared'])
  expect(cardButton('opencode-shared', 'common.edit').props.disabled).toBe(false)
})

it('carries mutation busy state to the form and every engine card until saving settles', async () => {
  await mount()
  dom.click(cardButton('opencode-shared', 'common.edit'))
  await settle()
  let resolve!: (value: unknown) => void
  update.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  dom.click(button('common.save'))
  expect(button('engine.form.saving').props.disabled).toBe(true)
  for (const agent of agents) expect(cardButton(agent.key, 'common.edit').props.disabled).toBe(true)
  resolve({})
  await settle()
  expect(editor()).toBeUndefined()
  for (const agent of agents)
    expect(cardButton(agent.key, 'common.edit').props.disabled).toBe(false)
})

it('keeps the selected editor and its draft on save failure and retries the same key', async () => {
  await mount()
  dom.click(cardButton('opencode-shared', 'common.edit'))
  await settle()
  const edited = '{"provider":{"shared":{"models":{"retry":{"name":"Retry model"}}}}}'
  change(editor()!, edited)
  update.mockRejectedValueOnce(new Error('fixture save failed'))
  dom.click(button('common.save'))
  await settle()
  expect(editor()?.props.value).toBe(edited)
  expect(dom.body.textContent).toContain('fixture save failed')
  expect(list).toHaveBeenCalledTimes(1)
  dom.click(button('common.save'))
  await settle()
  expect(update.mock.calls).toEqual([
    [{ key: 'opencode-shared', settingsJson: edited }],
    [{ key: 'opencode-shared', settingsJson: edited }]
  ])
  expect(editor()).toBeUndefined()
  expect(list).toHaveBeenCalledTimes(2)
})
