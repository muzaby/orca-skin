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
      issue?: 'refresh' | 'control' | 'open'
    }
type Ready = Extract<NativeResourcesView, { status: 'ready' }>
type Issue = 'control' | 'open'
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
  return {
    status: 'ready',
    value: { ...value, items: [...value.items, ...retained], ...(commands ? { commands } : {}) },
    ...(retained.length || (!value.commands && commands?.length) ? { stale: true } : {})
  }
}

/** A navigation-independent observation and operation owner for one session/backend. */
export class NativeResourceState {
  private listeners = new Set<() => void>()
  private operations = new Map<string, number>()
  private serial = 0
  private readSerial = 0
  private pushSerial = 0
  private flight: { serial: number; task: Promise<void> } | undefined
  private epoch = 0
  private retired = new Set<string>()
  private snapshot: { view: NativeResourcesView; pending: ReadonlySet<string> } = {
    view: { status: 'loading' },
    pending: new Set()
  }
  constructor(readonly request: string | DraftNativeResourcesRequest | undefined) {}
  getSnapshot = (): typeof this.snapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(view = this.snapshot.view): void {
    this.snapshot = { view, pending: new Set(this.operations.keys()) }
    for (const listener of this.listeners) listener()
  }
  accept(value: NativeResources): void {
    if (value.generation && this.retired.has(value.generation)) return
    this.pushSerial++
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
    this.epoch++
    this.readSerial++
    this.operations.clear()
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
  refresh = (issue?: Issue, report = true): Promise<void> => {
    if (this.flight?.serial === this.readSerial) return this.flight.task
    const read = ++this.readSerial
    const task = this.readResources(read, issue, report)
    this.flight = { serial: read, task }
    const finish = (): void => {
      if (this.flight?.task === task) this.flight = undefined
    }
    void task.then(finish, finish)
    return task
  }
  private async readResources(read: number, issue?: Issue, report = true): Promise<void> {
    const previous = this.snapshot.view
    if (previous.status === 'ready') this.publish({ ...previous, refreshing: true, issue })
    try {
      const value = this.request
        ? await sessionApi.nativeResources(this.request)
        : { state: 'disconnected' as const, items: [] }
      if (read !== this.readSerial) return
      this.apply(value)
      if (issue && this.snapshot.view.status === 'ready')
        this.publish({ ...this.snapshot.view, issue })
    } catch (error) {
      if (read !== this.readSerial) return
      if (report && this.listeners.size)
        reportError({
          event: 'chat.native-resources.load-failed',
          scope: 'native-resources',
          title: 'loadFailed',
          error
        })
      // Failed revalidation does not change an observed live process or its controls.
      this.publish(
        previous.status === 'ready'
          ? { ...previous, refreshing: false, stale: true, issue: issue ?? 'refresh' }
          : { status: 'error' }
      )
    }
  }
  private begin(
    resource: NativeResource
  ): { key: string; token: number; epoch: number } | undefined {
    const key = nativeResourceKey(resource)
    if (this.operations.has(key)) return
    const token = ++this.serial
    this.operations.set(key, token)
    this.readSerial++
    const view = this.snapshot.view
    this.publish(view.status === 'ready' && view.refreshing ? { ...view, refreshing: false } : view)
    return { key, token, epoch: this.epoch }
  }
  private finish(operation: { key: string; token: number }): void {
    if (this.operations.get(operation.key) !== operation.token) return
    this.operations.delete(operation.key)
    this.publish()
  }
  openPlugin = async (resource: NativeResource): Promise<void> => {
    if (!this.request) return
    const operation = this.begin(resource)
    if (!operation) return
    try {
      await sessionApi.openNativePlugin(
        typeof this.request === 'string'
          ? {
              sessionId: this.request,
              id: resource.id,
              ...(resource.kind === 'mcp' ? { kind: resource.kind } : {})
            }
          : {
              ...this.request,
              id: resource.id,
              ...(resource.kind === 'mcp' ? { kind: resource.kind } : {})
            }
      )
      if (
        operation.epoch === this.epoch &&
        this.snapshot.view.status === 'ready' &&
        this.snapshot.view.issue === 'open'
      )
        this.publish({ ...this.snapshot.view, issue: undefined })
    } catch (error) {
      if (operation.epoch !== this.epoch) return
      if (this.listeners.size)
        reportError({
          event: 'chat.native-resources.open-failed',
          scope: 'native-resources',
          title: 'openFailed',
          error
        })
      await this.refresh('open', false)
    } finally {
      this.finish(operation)
    }
  }
  toggle = async (resource: NativeResource): Promise<void> => {
    const view = this.snapshot.view
    if (typeof this.request !== 'string' || view.status !== 'ready' || !view.value.generation)
      return
    const current = view.value.items.find(
      (item) => nativeResourceKey(item) === nativeResourceKey(resource)
    )
    if (!current?.canToggle) return
    const generation = view.value.generation
    const push = this.pushSerial
    const operation = this.begin(current)
    if (!operation) return
    try {
      const value = await sessionApi.setNativeResource({
        sessionId: this.request,
        generation,
        kind: current.kind,
        id: current.id,
        enabled: !current.enabled
      })
      if (
        operation.epoch !== this.epoch ||
        this.retired.has(generation) ||
        push !== this.pushSerial
      )
        return
      this.readSerial++
      this.apply(value)
    } catch (error) {
      if (operation.epoch !== this.epoch) return
      if (this.listeners.size)
        reportError({
          event: 'chat.native-resources.control-failed',
          scope: 'native-resources',
          title: 'actionFailed',
          error
        })
      await this.refresh('control', false)
    } finally {
      this.finish(operation)
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
    window.orca?.session?.onNativeResourcesChanged?.(({ sessionId, resources }) => {
      for (const state of owned.values()) {
        if (state.request === sessionId) state.accept(resources)
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
