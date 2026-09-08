import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { TweakProvider, createTweakStore, useTweakContext, type Tweaks } from './TweakProvider'

// 실제 hook의 값·deps·cleanup만 구동한다. React 브라우저 scheduler를 재현하지 않는다.
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  context: null as unknown,
  effects: [] as { run: () => void | (() => void); deps: unknown[] }[],
  get: vi.fn(),
  patch: vi.fn(),
  changeLanguage: vi.fn(),
  setProperty: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useState: (initial: () => unknown) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = initial()
    return [h.slots[index], vi.fn()]
  },
  useRef: (initial: unknown) => {
    const index = h.cursor++
    if (!(index in h.slots)) h.slots[index] = { current: initial }
    return h.slots[index]
  },
  useContext: () => h.context,
  useCallback: (fn: unknown) => fn,
  useDebugValue: () => {},
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useEffect: (run: () => void | (() => void), deps: unknown[]) => h.effects.push({ run, deps })
}))
vi.mock('../api/ipc', () => ({
  settingsApi: { get: h.get, set: h.patch },
  getPlatform: () => 'win32'
}))
vi.mock('../i18n', () => ({ i18n: { changeLanguage: h.changeLanguage } }))
vi.mock('zustand', async (original) => ({
  ...(await original<typeof import('zustand')>()),
  useStore: (store: { getState: () => unknown }, selector: (state: unknown) => unknown) =>
    selector(store.getState())
}))
vi.mock('zustand/react/shallow', async () => {
  const { shallow } = await import('zustand/vanilla/shallow')
  return {
    useShallow: (selector: (state: unknown) => unknown) => {
      const index = h.cursor++
      return (state: unknown) => {
        const next = selector(state)
        if (!(index in h.slots) || !shallow(h.slots[index], next)) h.slots[index] = next
        return h.slots[index]
      }
    }
  }
})

beforeEach(() => {
  h.slots = []
  h.cursor = 0
  h.context = null
  h.effects = []
  h.get.mockReset().mockReturnValue(new Promise(() => {}))
  h.patch.mockReset().mockResolvedValue(undefined)
  h.changeLanguage.mockClear()
  h.setProperty.mockClear()
  vi.stubGlobal('document', {
    documentElement: { dataset: {}, style: { setProperty: h.setProperty } }
  })
})

afterEach(() => vi.unstubAllGlobals())

function renderProvider(): {
  store: ReturnType<typeof createTweakStore>
  effects: typeof h.effects
} {
  h.cursor = 0
  h.effects = []
  const element = TweakProvider({ children: null }) as ReactElement<{
    value: ReturnType<typeof createTweakStore>
  }>
  h.context = element.props.value
  return { store: element.props.value, effects: [...h.effects] }
}

describe('actual TweakProvider lifecycle and selector connection', () => {
  it('retains its store port and wires load cleanup and the existing DOM effects', () => {
    const first = renderProvider()
    const cleanup = first.effects.map(({ run }) => run())
    expect(h.get).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset).toEqual({ theme: 'white', platform: 'win32' })
    expect(document.documentElement.style.fontSize).toBe('13px')
    expect(h.setProperty).toHaveBeenCalledExactlyOnceWith('--font-app', 'var(--font-sans)')
    expect(h.changeLanguage).toHaveBeenCalledExactlyOnceWith('ko')
    expect(document.documentElement.lang).toBe('ko')
    expect(cleanup.filter((fn) => typeof fn === 'function')).toHaveLength(1)
    first.store.getState().setTweak('sidebarWidth', 420)
    const widthOnly = renderProvider()
    expect(widthOnly.store).toBe(first.store)
    expect(widthOnly.effects.map((effect) => effect.deps)).toEqual(
      first.effects.map((effect) => effect.deps)
    )
    first.store.getState().setTweak('theme', 'dark')
    first.store.getState().setTweak('uiLocale', 'en')
    first.store.getState().setTweak('density', 'compact')
    first.store.getState().setTweak('appFont', 'mono')
    const changed = renderProvider()
    changed.effects.forEach((effect, index) => {
      if (effect.deps.some((dep, i) => !Object.is(dep, first.effects[index].deps[i]))) effect.run()
    })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.fontSize).toBe('11.5px')
    expect(h.setProperty).toHaveBeenLastCalledWith('--font-app', 'var(--font-mono)')
    expect(h.changeLanguage).toHaveBeenLastCalledWith('en')
    expect(document.documentElement.lang).toBe('en')
    expect(h.get).toHaveBeenCalledOnce()
    cleanup.forEach((fn) => fn?.())
  })

  it('selects only requested values and retains shallow-equal selections and stable actions', () => {
    const store = createTweakStore()
    h.context = store
    function SelectionProbe(): ReturnType<typeof useTweakContext<Pick<Tweaks, 'theme'>>> {
      h.cursor = 0
      return useTweakContext((t) => ({ theme: t.theme }))
    }
    const first = SelectionProbe()
    first.setTweak('sidebarWidth', 350)
    const unrelated = SelectionProbe()
    expect(unrelated.t).toBe(first.t)
    expect(unrelated.setTweak).toBe(first.setTweak)
    first.setTweak('theme', 'dark')
    expect(SelectionProbe().t).toEqual({ theme: 'dark' })
  })
})
