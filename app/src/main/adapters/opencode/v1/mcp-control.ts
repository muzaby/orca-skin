import { McpAdmissionError } from '../../common/turn'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeResource } from '../../../../shared/native-resources'
import type { ExtensionControl } from '../../common/extension-control'
import type { ProjectResourcePolicy } from '../../common/project-resources'
import type { OpenCodeComposerCache } from './composer-cache'
import { opaqueIdentity } from './diagnostics'
import { waitForOpenCode } from './instance-lifecycle'
import { openCodeNativeMcp } from './native-resources'
import { openCodeProjectResources, readOpenCodeProjectSettings } from './project-settings'
import { retentionTrace } from './retention-trace'

export interface DirectoryMcpSettings {
  choices(): Record<string, boolean>
  required?(alias: string): boolean
  defaults?: Record<string, boolean>
  restricted?: ReadonlySet<string>
  /** Refresh only while this directory's response owners are idle. */
  refresh?(client: OpencodeClient, directory: string, signal: AbortSignal): Promise<void>
  dirty?(): boolean
}

interface Attempt {
  pending: boolean
  task: Promise<void>
  failure?: NativeResource
}

/** Independent additive connections; choice changes and submissions share admission. */
export class OpenCodeMcpControl {
  private readonly activityWaiters = new Set<() => void>()
  private activated = false
  private activation?: Promise<void>
  private readFlight?: Promise<NativeResource[]>
  private applied?: Record<string, boolean>
  private removalFailed = false
  private readonly unregistered = new Set<string>()
  private readonly attempts = new Map<string, Attempt>()
  private readonly actual = new Map<string, NativeResource>()
  private observation = 0
  private tail: Promise<void> = Promise.resolve()
  private readonly active = new Set<() => boolean>()
  private readonly startup: ReturnType<typeof readOpenCodeProjectSettings>
  readonly policy: ProjectResourcePolicy = openCodeProjectResources

  constructor(
    private readonly client: OpencodeClient,
    private readonly directory: string,
    private readonly control: ExtensionControl,
    private readonly signal: AbortSignal,
    private readonly cache?: OpenCodeComposerCache,
    private readonly managed?: DirectoryMcpSettings,
    private readonly idle: (beforeSubmit: boolean) => boolean = () => true,
    private readonly defaults: Record<string, boolean> = {}
  ) {
    this.startup = readOpenCodeProjectSettings(directory)
    void this.startup.catch(() => undefined)
  }

  get started(): boolean {
    return this.activated
  }

  resourceActivityChanged(): void {
    for (const wake of [...this.activityWaiters]) wake()
  }
  private waitForActivity(signal: AbortSignal, timeout: number): Promise<void> {
    signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer)
        this.activityWaiters.delete(wake)
        signal.removeEventListener('abort', abort)
      }
      const wake = (): void => {
        cleanup()
        resolve()
      }
      const abort = (): void => {
        cleanup()
        reject(signal.reason)
      }
      const timer = setTimeout(wake, timeout)
      timer.unref?.()
      this.activityWaiters.add(wake)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    })
  }
  connected(id: string): boolean {
    return this.actual.get(id)?.status === 'connected'
  }
  activate(): void {
    if (this.activated) return
    this.activated = true
    this.activation = this.reconcileChoices()
    void this.activation.catch(() => undefined)
  }
  observeActivity(active: () => boolean): () => void {
    this.active.add(active)
    return () => this.active.delete(active)
  }
  private safe(beforeSubmit: boolean): boolean {
    return ![...this.active].some((active) => active()) && this.idle(beforeSubmit)
  }
  private run<T>(action: () => Promise<T>): Promise<T> {
    const task = this.tail.then(() => {
      this.signal.throwIfAborted()
      return action()
    })
    this.tail = task.then(
      () => undefined,
      () => undefined
    )
    return task
  }
  private resource(id: string, status: NativeResource['status']): NativeResource {
    return { id, name: id, kind: 'mcp', status, enabled: true, canToggle: false }
  }
  private connect(id: string, retry = false): void {
    const previous = this.attempts.get(id)
    if (previous?.pending || (previous && !retry) || this.connected(id)) return
    const attempt: Attempt = { pending: true, task: Promise.resolve() }
    this.attempts.set(id, attempt)
    attempt.task = (async () => {
      const signal = AbortSignal.any([this.signal, AbortSignal.timeout(120_000)])
      try {
        await waitForOpenCode(
          this.client.mcp.connect(
            { directory: this.directory, name: id },
            { signal, throwOnError: true }
          ),
          signal
        )
        const items = await waitForOpenCode(
          openCodeNativeMcp(this.client, this.directory, signal),
          signal
        )
        signal.throwIfAborted()
        const item = items.find((value) => value.id === id)
        if (item?.status !== 'connected') attempt.failure = item ?? this.resource(id, 'failed')
        this.actual.set(id, item ?? this.resource(id, 'failed'))
      } catch {
        if (!this.signal.aborted) {
          attempt.failure = this.resource(id, 'failed')
          this.actual.set(id, attempt.failure)
        }
      } finally {
        attempt.pending = false
        this.observation++
        this.cache?.invalidateMcp()
      }
    })()
  }
  read(signal: AbortSignal, refresh = false): Promise<NativeResource[]> {
    signal.throwIfAborted()
    this.signal.throwIfAborted()
    if (!this.activated) return Promise.resolve([])
    if (!this.readFlight) {
      const flight = (async () => {
        await this.activation?.catch(() => undefined)
        const revision = this.observation
        const items = await this.status(this.signal, refresh)
        // A background completion wins over an older status observation.
        if (revision === this.observation) {
          this.actual.clear()
          for (const item of items) this.actual.set(item.id, item)
        }
        if (refresh && this.safe(false)) {
          await this.run(async () => {
            if (this.safe(false)) await this.apply(true)
          })
        }
        return this.preview([...this.actual.values()])
      })().finally(() => {
        if (this.readFlight === flight) this.readFlight = undefined
      })
      this.readFlight = flight
    }
    return waitForOpenCode(this.readFlight, AbortSignal.any([signal, this.signal]))
  }
  async reconcileChoices(): Promise<void> {
    if (!this.activated || !this.safe(false)) return
    await this.run(async () => {
      if (this.safe(false)) await this.apply()
    })
  }
  /** Acknowledged selections and SDK submission share the directory queue. */
  submit<T>(
    signal: AbortSignal,
    action: () => Promise<T>,
    mentioned: readonly string[] = []
  ): Promise<T> {
    this.activate()
    const combined = AbortSignal.any([signal, this.signal])
    return waitForOpenCode(
      this.run(async () => {
        let retry = true
        for (;;) {
          combined.throwIfAborted()
          // Recheck the SDK even after a successful prior turn. A server can drop
          // or reconnect independently while the directory is idle.
          if (this.applied && Object.keys(this.applied).length) {
            const revision = this.observation
            try {
              const observed = await waitForOpenCode(this.status(combined, true), combined)
              if (revision === this.observation) {
                for (const id of Object.keys(this.applied)) {
                  const item = observed.find((value) => value.id === id)
                  if (item) this.actual.set(id, item)
                  else this.actual.delete(id)
                }
              }
            } catch {
              combined.throwIfAborted()
              throw new McpAdmissionError(
                'MCP 실행 상태를 확인하지 못했습니다. 다시 시도해 주세요.'
              )
            }
          }
          const desired = this.choices()
          const changed =
            this.managed?.dirty?.() ||
            this.removalFailed ||
            Object.entries(desired).some(([id, enabled]) => this.drifted(id, enabled)) ||
            JSON.stringify(desired) !== JSON.stringify(this.applied)
          const unsettled = [...this.attempts.values()].some(
            (attempt) => attempt.pending || attempt.failure
          )
          // Peer submissions with an unchanged, settled configuration do not change connections.
          if ((changed || unsettled) && !this.safe(true)) {
            await this.waitForActivity(combined, 500)
            continue
          }
          // Cancelling the caller releases its promise immediately, but the directory
          // queue retains ownership until any shared SDK mutation finishes.
          if (changed || unsettled) await this.apply(retry)
          retry = false
          const needed = (id: string): boolean => mentioned.includes(id) || this.required(id)
          const attempts = [...this.attempts]
          await waitForOpenCode(
            Promise.all(attempts.filter(([id]) => needed(id)).map(([, attempt]) => attempt.task)),
            combined
          )
          const optional = attempts.filter(([id, attempt]) => !needed(id) && attempt.pending)
          if (optional.length) {
            const bound = AbortSignal.timeout(2000)
            const settled = Promise.all(optional.map(([, attempt]) => attempt.task))
            await waitForOpenCode(settled, AbortSignal.any([combined, bound])).catch(() =>
              combined.throwIfAborted()
            )
          }
          combined.throwIfAborted()
          const current = this.choices()
          if (this.managed?.dirty?.() || JSON.stringify(current) !== JSON.stringify(this.applied))
            continue
          if (attempts.some(([id, attempt]) => current[id] && needed(id) && attempt.pending))
            continue
          const failed = Object.keys(current).find(
            (id) => current[id] && !this.unregistered.has(id) && !this.connected(id) && needed(id)
          )
          if (failed)
            throw new McpAdmissionError(
              '사용할 MCP 연결을 확인하지 못했습니다. 연결을 다시 시도하거나 해당 MCP를 끈 뒤 전송해 주세요.'
            )
          retentionTrace('mcp.submit-applied', { instance: opaqueIdentity(this.directory) })
          return action()
        }
      }),
      combined
    )
  }
  private drifted(id: string, enabled: boolean): boolean {
    const actual = this.actual.get(id)
    if (this.unregistered.has(id)) return !!actual
    if (!actual) return true
    return enabled
      ? actual.status !== 'connected' && !this.attempts.get(id)?.pending
      : actual.status !== 'disabled'
  }

  private required(id: string): boolean {
    return (
      this.control.global('opencode')[`mcp:${id}`] === true || this.managed?.required?.(id) === true
    )
  }
  async reconcile(
    revision: string,
    idle: () => boolean
  ): Promise<'applied' | 'pending' | 'restart-required'> {
    if (!idle() || !this.safe(false)) return 'pending'
    if (revision !== (await this.startup).revision) return 'restart-required'
    await this.reconcileChoices()
    return 'applied'
  }
  private choices(): Record<string, boolean> {
    const global = this.control.global('opencode')
    return {
      ...Object.fromEntries(
        Object.entries(this.defaults).map(([id, enabled]) => [id, global[`mcp:${id}`] ?? enabled])
      ),
      ...this.managed?.choices()
    }
  }
  async pending(): Promise<boolean> {
    if (!this.activated) return false
    await this.activation?.catch(() => undefined)
    return (
      this.removalFailed ||
      !!this.managed?.dirty?.() ||
      [...this.attempts].some(
        ([id, attempt]) => this.required(id) && (attempt.pending || !!attempt.failure)
      ) ||
      JSON.stringify(this.applied ?? {}) !== JSON.stringify(this.choices())
    )
  }
  async preview(items: NativeResource[]): Promise<NativeResource[]> {
    const choices = this.choices()
    const values = new Map(items.map((item) => [item.id, item]))
    for (const [id, attempt] of this.attempts) {
      if (attempt.pending && !values.has(id)) values.set(id, this.resource(id, 'disabled'))
      if (
        choices[id] &&
        attempt.failure &&
        (!values.has(id) || values.get(id)?.status === 'disabled')
      )
        values.set(id, attempt.failure)
    }
    for (const id of this.unregistered) {
      if (!values.has(id)) values.set(id, this.resource(id, 'disabled'))
    }
    return [...values.values()].map((item) => ({
      ...item,
      canToggle: false,
      ...(this.managed?.restricted?.has(item.id)
        ? { controlReason: '이 세션에서 전역 MCP와 같은 서버인지 확인할 수 없습니다.' }
        : {}),
      ...(this.unregistered.has(item.id)
        ? { controlReason: '이 세션에 등록되지 않은 MCP입니다.' }
        : {}),
      ...(item.kind === 'mcp' && choices[item.id] !== undefined
        ? {
            selected: choices[item.id],
            enabled: choices[item.id],
            ...(choices[item.id] &&
            this.attempts.get(item.id)?.pending &&
            item.status === 'disabled'
              ? { status: 'pending' as const }
              : {})
          }
        : {})
    }))
  }
  private status(signal: AbortSignal, refresh = false): Promise<NativeResource[]> {
    return (
      this.cache?.mcp(signal, refresh) ?? openCodeNativeMcp(this.client, this.directory, signal)
    )
  }
  private async apply(retry = false): Promise<void> {
    try {
      await this.applyChoices(retry)
      this.removalFailed = false
    } catch (error) {
      this.removalFailed = true
      this.signal.throwIfAborted()
      if (error instanceof McpAdmissionError) throw error
      throw new McpAdmissionError('MCP 상태를 확인하지 못했습니다. 다시 시도해 주세요.')
    }
  }
  private async applyChoices(retry: boolean): Promise<void> {
    const signal = AbortSignal.any([this.signal, AbortSignal.timeout(120_000)])
    if (this.managed?.dirty?.()) {
      await Promise.all([...this.attempts.values()].map((attempt) => attempt.task))
      await this.managed.refresh?.(this.client, this.directory, signal)
      this.cache?.invalidateMcp()
      this.applied = undefined
    }
    const choices = this.choices()
    const changes = Object.entries(choices).filter(
      ([id, enabled]) =>
        this.applied?.[id] !== enabled ||
        this.drifted(id, enabled) ||
        (enabled && retry && !!this.attempts.get(id)?.failure)
    )
    if (changes.length) {
      // A late connect must settle before an OFF can be acknowledged.
      await waitForOpenCode(
        Promise.all(changes.filter(([, on]) => !on).map(([id]) => this.attempts.get(id)?.task)),
        signal
      )
      const items = await this.status(signal, true)
      for (const [id, enabled] of changes) {
        const actual = items.find((item) => item.id === id)
        if (!actual) {
          this.unregistered.add(id)
          this.actual.delete(id)
          this.attempts.delete(id)
          continue
        }
        this.unregistered.delete(id)
        this.actual.set(id, actual)
        if (enabled) {
          if (actual.status === 'connected') {
            if (!this.attempts.get(id)?.pending) this.attempts.delete(id)
          } else this.connect(id, true)
          continue
        }
        if (actual.status !== 'disabled') {
          try {
            await this.client.mcp.disconnect(
              { directory: this.directory, name: id },
              { signal, throwOnError: true }
            )
            this.cache?.invalidateMcp()
            const observed = (await this.status(signal, true)).find((value) => value.id === id)
            if (observed?.status !== 'disabled') throw new Error()
            this.actual.set(id, observed)
          } catch {
            throw new McpAdmissionError('MCP 연결 해제를 확인하지 못했습니다. 다시 시도해 주세요.')
          }
        }
        this.attempts.delete(id)
      }
      this.observation++
    }
    this.applied = choices
  }
}
