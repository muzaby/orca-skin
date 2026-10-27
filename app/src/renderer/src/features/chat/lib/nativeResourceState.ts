import type {
  DraftNativeResourcesRequest,
  NativeResource,
  NativeResources
} from '../../../../../shared/native-resources'
import { sessionApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'

export type NativeResourcesView =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      value: NativeResources
      refreshing?: boolean
      stale?: boolean
      issue?: 'refresh'
    }
type Ready = Extract<NativeResourcesView, { status: 'ready' }>
let nextObserver = 0
export const nativeResourceKey = (resource: NativeResource): string =>
  `${resource.kind}:${resource.id}`

function readOnly(value: NativeResources): NativeResources {
  return {
    ...value,
    generation: undefined,
    items: value.items.map((item) => ({
      ...item,
      canToggle: false,
      status: item.status === 'connected' || item.status === 'enabled' ? 'configured' : item.status
    }))
  }
}
function observed(value: NativeResources, previous: NativeResourcesView): Ready {
  if (previous.status !== 'ready' || (value.state === 'connected' && !value.partial))
    return { status: 'ready', value }
  const ids = new Set(value.items.map(nativeResourceKey))
  const sameLiveGeneration =
    value.state === 'connected' &&
    !!value.generation &&
    value.generation === previous.value.generation
  const retained = (sameLiveGeneration ? previous.value : readOnly(previous.value)).items.filter(
    (item) =>
      !ids.has(nativeResourceKey(item)) && !(item.kind === 'plugin' && value.pluginsAuthoritative)
  )
  const commands = value.commands ?? previous.value.commands
  const composer = value.composer ?? (sameLiveGeneration ? previous.value.composer : undefined)
  return {
    status: 'ready',
    value: {
      ...value,
      items: [...value.items, ...retained],
      ...(commands ? { commands } : {}),
      ...(composer ? { composer } : {})
    },
    ...(retained.length || (!value.commands && commands?.length) ? { stale: true } : {})
  }
}

/** A navigation-independent observation owner for one session/backend. */
export class NativeResourceState {
  private readonly owner = `resources:${++nextObserver}`
  private listeners = new Set<() => void>()
  private readSerial = 0
  private flight: { serial: number; task: Promise<void> } | undefined
  private retired = new Set<string>()
  private snapshot: { view: NativeResourcesView } = {
    view: { status: 'loading' }
  }
  constructor(readonly request: string | DraftNativeResourcesRequest | undefined) {}
  getSnapshot = (): typeof this.snapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    const first = this.listeners.size === 0
    this.listeners.add(listener)
    if (first && this.request && typeof window !== 'undefined')
      void sessionApi
        .nativeResources(this.request, { owner: this.owner, active: true })
        .catch(() => undefined)
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size && this.request && typeof window !== 'undefined')
        void sessionApi
          .nativeResources(this.request, { owner: this.owner, active: false })
          .catch(() => undefined)
    }
  }
  private publish(view = this.snapshot.view): void {
    this.snapshot = { view }
    for (const listener of this.listeners) listener()
  }
  accept(value: NativeResources): void {
    if (value.generation && this.retired.has(value.generation)) return
    this.readSerial++
    this.apply(value)
  }
  private apply(value: NativeResources): void {
    if (value.generation && this.retired.has(value.generation)) return
    const previous = this.snapshot.view
    if (
      previous.status === 'ready' &&
      previous.value.generation &&
      value.generation &&
      previous.value.generation !== value.generation
    )
      this.retire(previous.value.generation, false)
    this.publish(observed(value, this.snapshot.view))
  }
  retire(generation: string, refresh = true): void {
    if (this.retired.has(generation)) return
    this.retired.add(generation)
    const view = this.snapshot.view
    if (view.status === 'ready' && view.value.generation && view.value.generation !== generation)
      return
    this.readSerial++
    this.publish(
      view.status === 'ready'
        ? {
            status: 'ready',
            value: { ...readOnly(view.value), state: 'disconnected' },
            stale: true
          }
        : view
    )
    if (refresh && this.listeners.size) void this.refresh()
  }
  ensure = (): Promise<void> => {
    const view = this.snapshot.view
    if (
      view.status === 'ready' &&
      view.value.state === 'connected' &&
      !view.value.partial &&
      !view.stale &&
      !view.issue
    )
      return Promise.resolve()
    return this.refresh()
  }
  reconnect(): void {
    // A connection event can race a metadata read started before the new process existed.
    this.readSerial++
    void this.refresh()
  }
  managedMcpChanged(): void {
    this.readSerial++
    const view = this.snapshot.view
    if (view.status === 'ready')
      this.publish({
        ...view,
        value: { ...view.value, items: view.value.items.filter((item) => !item.managedSource) },
        stale: true
      })
    if (this.listeners.size) void this.refresh()
  }
  refresh = (): Promise<void> => {
    if (this.flight?.serial === this.readSerial) return this.flight.task
    const read = ++this.readSerial
    const task = this.readResources(read)
    this.flight = { serial: read, task }
    const finish = (): void => {
      if (this.flight?.task === task) this.flight = undefined
    }
    void task.then(finish, finish)
    return task
  }
  private async readResources(read: number): Promise<void> {
    const previous = this.snapshot.view
    if (previous.status === 'ready')
      this.publish({ ...previous, refreshing: true, issue: undefined })
    try {
      const value = this.request
        ? await sessionApi.nativeResources(this.request)
        : { state: 'disconnected' as const, items: [] }
      if (read !== this.readSerial) return
      this.apply(value)
    } catch (error) {
      if (read !== this.readSerial) return
      if (this.listeners.size)
        reportError({
          event: 'chat.native-resources.load-failed',
          scope: 'native-resources',
          title: 'loadFailed',
          error
        })
      // Failed revalidation preserves the last observed live resources.
      this.publish(
        previous.status === 'ready'
          ? { ...previous, refreshing: false, stale: true, issue: 'refresh' }
          : { status: 'error' }
      )
    }
  }
}

const windows = new WeakMap<Window, Map<string, NativeResourceState>>()
export function nativeResourceState(
  key: string,
  request: string | DraftNativeResourcesRequest | undefined
): NativeResourceState {
  if (typeof window === 'undefined') return new NativeResourceState(request)
  let cache = windows.get(window)
  if (!cache) {
    cache = new Map()
    windows.set(window, cache)
    const owned = cache
    sessionApi.onManagedMcpChanged?.(() => {
      for (const state of owned.values()) state.managedMcpChanged()
    })
    window.orca?.session?.onNativeResourcesChanged?.(({ sessionId, scope, resources }) => {
      for (const state of owned.values()) {
        if (
          (sessionId && state.request === sessionId) ||
          (scope &&
            typeof state.request === 'object' &&
            state.request.backend === scope.backend &&
            state.request.providerKey === scope.providerKey &&
            state.request.agentKind === scope.agentKind &&
            state.request.cwd === scope.cwd &&
            state.request.projectId === scope.projectId)
        )
          state.accept(resources)
      }
    })
    window.orca?.chat?.onBackgroundEvent?.((event) => {
      if (event.type !== 'background.connection') return
      for (const state of owned.values()) {
        if (state.request !== event.sessionId) continue
        if (event.state === 'terminated') state.retire(event.source.generation)
        else if (event.state === 'connected') state.reconnect()
      }
    })
  }
  let state = cache.get(key)
  if (!state) {
    state = new NativeResourceState(request)
    cache.set(key, state)
  }
  return state
}
