import {
  Virtualizer,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type PartialKeys,
  type VirtualizerOptions
} from '@tanstack/virtual-core'
import { fakeHooks } from '../../../../shared/ui/renderHarness.testfixture'

/**
 * Bridges `@tanstack/react-virtual`'s `useVirtualizer` to the REAL `@tanstack/virtual-core`
 * `Virtualizer` under `fakeHooks` (needed because externalized `@tanstack/react-virtual` imports
 * native CJS React rather than Vitest's `vi.mock('react')`).
 */
export function useRealVirtualizerWithFakeHooks<
  TScrollElement extends Element,
  TItemElement extends Element
>(
  options: PartialKeys<
    VirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >
): Virtualizer<TScrollElement, TItemElement> {
  const [, rerender] = fakeHooks.useReducer((x: unknown) => (x as number) + 1, 0) as [
    number,
    () => void
  ]
  const inRenderRef = fakeHooks.useRef(false) as { current: boolean }
  const didInitialRenderRef = fakeHooks.useRef(false) as { current: boolean }

  const resolvedOptions: VirtualizerOptions<TScrollElement, TItemElement> = {
    observeElementRect: (instance, cb) => {
      const el = instance.scrollElement
      if (el) {
        const rect = el.getBoundingClientRect()
        cb({ width: rect.width || 600, height: rect.height || 400 })
      }
      return observeElementRect(instance, cb)
    },
    observeElementOffset: (instance, cb) => {
      const el = instance.scrollElement as unknown as {
        scrollTop?: number
        addEventListener?: (type: string, fn: () => void) => void
        removeEventListener?: (type: string, fn: () => void) => void
      } | null
      if (el) cb(el.scrollTop ?? 0, false)
      const onScroll = (): void => {
        if (el) cb(el.scrollTop ?? 0, false)
      }
      el?.addEventListener?.('scroll', onScroll)
      const cleanup = observeElementOffset(instance, cb)
      return () => {
        el?.removeEventListener?.('scroll', onScroll)
        cleanup?.()
      }
    },
    scrollToFn: elementScroll,
    ...options,
    measureElement: options.measureElement
      ? (el, entry, inst) => {
          const measured = options.measureElement!(el, entry, inst)
          if (measured > 0) return measured
          const idx = Number(el.getAttribute('data-index') ?? 0)
          return options.estimateSize(idx)
        }
      : undefined,
    onChange: (instance, sync) => {
      if (!inRenderRef.current && !didInitialRenderRef.current) {
        didInitialRenderRef.current = true
        rerender()
      }
      options.onChange?.(instance, sync)
    }
  }

  const [instance] = fakeHooks.useState(() => new Virtualizer(resolvedOptions)) as [
    Virtualizer<TScrollElement, TItemElement>,
    unknown
  ]

  inRenderRef.current = true
  try {
    instance.setOptions(resolvedOptions)
    instance._willUpdate()
  } finally {
    inRenderRef.current = false
  }

  fakeHooks.useLayoutEffect(() => {
    return instance._didMount()
  }, [])

  return instance
}

export async function createFakeZustand(
  original: () => Promise<typeof import('zustand')>
): Promise<typeof import('zustand')> {
  const actual = await original()
  const { createStore } = await import('zustand/vanilla')
  const useStore = <T, U>(store: import('zustand').StoreApi<T>, select: (state: T) => U): U =>
    fakeHooks.useSyncExternalStore(store.subscribe, () => select(store.getState())) as U
  const bind = <T>(
    initializer: import('zustand').StateCreator<T>
  ): import('zustand').StoreApi<T> & (<U>(selector: (state: T) => U) => U) => {
    const store = createStore(initializer)
    return Object.assign(<U>(selector: (state: T) => U): U => useStore(store, selector), store)
  }
  const create = (initializer?: import('zustand').StateCreator<unknown>): unknown =>
    initializer ? bind(initializer) : bind
  return {
    ...actual,
    useStore: useStore as typeof actual.useStore,
    create: create as typeof actual.create
  }
}
