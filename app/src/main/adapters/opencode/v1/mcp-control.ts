import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { ExtensionControl } from '../../common/extension-control'
import type { ProjectResourcePolicy } from '../../common/project-resources'
import { openCodeNativeMcp } from './native-resources'
import { openCodeProjectResources, readOpenCodeProjectSettings } from './project-settings'
import type { NativeResource } from '../../../../shared/native-resources'
import type { OpenCodeComposerCache } from './composer-cache'
import { waitForOpenCode } from './instance-lifecycle'
import { opaqueIdentity } from './diagnostics'
import { retentionTrace } from './retention-trace'

interface Attempt {
  pending: boolean
  task: Promise<void>
  failure?: NativeResource
}

/** Independent additive connections; choice changes and submissions share admission. */
export class OpenCodeMcpControl {
  private activated = false
  private activation?: Promise<void>
  private readFlight?: Promise<NativeResource[]>
  private applied?: Record<string, boolean>
  private removalFailed = false
  private readonly initialOff = new Set<string>()
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
    private readonly managed?: { choices(): Record<string, boolean> },
    private readonly idle: (beforeSubmit: boolean) => boolean = () => true,
    private readonly defaults: Record<string, boolean> = {}
  ) {
    this.startup = readOpenCodeProjectSettings(directory)
    void this.startup.catch(() => undefined)
  }

  connected(id: string): boolean {
    return this.actual.get(id)?.status === 'connected'
  }
  activate(): void {
    if (this.activated) return
    this.activated = true
    this.activation = this.choices().then((choices) => {
      this.signal.throwIfAborted()
      this.applied = choices
      for (const [id, enabled] of Object.entries(choices)) {
        if (enabled) this.connect(id)
        else this.initialOff.add(id)
      }
    })
    void this.activation.catch(() => undefined)
    void this.activation.then(() => this.reconcileChoices()).catch(() => undefined)
  }
  async prepare(): Promise<void> {
    this.activate()
    await this.activation
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
        this.actual.set(id, items.find((item) => item.id === id) ?? this.resource(id, 'failed'))
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
        await this.activation
        const revision = this.observation
        const items = await this.status(this.signal, refresh)
        // A background completion wins over an older status observation.
        if (revision === this.observation) {
          this.actual.clear()
          for (const item of items) this.actual.set(item.id, item)
        }
        if (refresh && this.safe(false))
          for (const [id, enabled] of Object.entries(await this.choices()))
            if (enabled) this.connect(id, true)
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
  /** Removal is mandatory; mentions settle; other initial connections have a bounded wait. */
  submit<T>(
    signal: AbortSignal,
    action: () => Promise<T>,
    mentioned: readonly string[] = []
  ): Promise<T> {
    this.activate()
    const combined = AbortSignal.any([signal, this.signal])
    return waitForOpenCode(
      this.run(async () => {
        for (;;) {
          while (!this.safe(true)) {
            await this.waitBounded([], combined, 20)
          }
          combined.throwIfAborted()
          await waitForOpenCode(this.apply(), combined)
          const revision = JSON.stringify(this.applied)
          await waitForOpenCode(
            Promise.all(mentioned.map((id) => this.attempts.get(id)?.task)),
            combined
          )
          const pending = [...this.attempts.values()].filter((attempt) => attempt.pending)
          if (pending.length)
            await this.waitBounded(
              pending.map((attempt) => attempt.task),
              combined,
              2000
            )
          combined.throwIfAborted()
          // A user can turn a tool off while admission is waiting for another connection.
          if (this.safe(true) && JSON.stringify(await this.choices()) === revision) break
        }
        combined.throwIfAborted()
        retentionTrace('mcp.submit-applied', { instance: opaqueIdentity(this.directory) })
        return action()
      }),
      combined
    )
  }
  private async waitBounded(
    tasks: Promise<void>[],
    signal: AbortSignal,
    ms: number
  ): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms)
    })
    try {
      await waitForOpenCode(
        tasks.length ? Promise.race([Promise.all(tasks), deadline]) : deadline,
        signal
      )
    } finally {
      clearTimeout(timer)
    }
  }
  async set(_id: string, _enabled: boolean): Promise<void> {
    void _id
    void _enabled
    throw new Error('이 MCP는 작업 경로별 제어를 지원하지 않습니다.')
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
  private async choices(project = this.startup): Promise<Record<string, boolean>> {
    const { mcp } = await project
    const global = Object.fromEntries(
      Object.entries(this.control.global('opencode'))
        .filter(([key]) => key.startsWith('mcp:'))
        .map(([key, value]) => [key.slice(4), value])
    )
    return { ...this.defaults, ...global, ...mcp, ...this.managed?.choices() }
  }
  async pending(): Promise<boolean> {
    if (!this.activated) return false
    await this.activation
    return (
      this.removalFailed || JSON.stringify(this.applied) !== JSON.stringify(await this.choices())
    )
  }
  async preview(items: NativeResource[]): Promise<NativeResource[]> {
    const choices = await this.choices(readOpenCodeProjectSettings(this.directory))
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
    return [...values.values()].map((item) => ({
      ...item,
      canToggle: false,
      ...(item.kind === 'mcp' && choices[item.id] !== undefined
        ? {
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
  private async apply(): Promise<void> {
    try {
      await this.applyChoices()
      this.removalFailed = false
    } catch (error) {
      this.removalFailed = true
      throw error
    }
  }
  private async applyChoices(): Promise<void> {
    await this.activation
    for (;;) {
      this.signal.throwIfAborted()
      const choices = await this.choices()
      const changes = Object.entries(choices).filter(
        ([id, enabled]) => this.applied?.[id] !== enabled || this.initialOff.has(id)
      )
      // A late successful connect must not re-enable an MCP after removal is acknowledged.
      for (const [id, enabled] of changes) {
        if (enabled) continue
        const signal = AbortSignal.any([this.signal, AbortSignal.timeout(120_000)])
        await waitForOpenCode(this.attempts.get(id)?.task ?? Promise.resolve(), signal)
        const items = await this.status(signal, true)
        const item = items.find((value) => value.id === id)
        if (item && item.status !== 'disabled') {
          await this.client.mcp.disconnect(
            { directory: this.directory, name: id },
            { signal, throwOnError: true }
          )
          this.cache?.invalidateMcp()
          const actual = await this.status(signal, true)
          if (actual.some((value) => value.id === id && value.status !== 'disabled'))
            throw new Error('일부 MCP 연결 해제를 확인하지 못했습니다.')
        }
        this.actual.delete(id)
        this.attempts.delete(id)
        this.initialOff.delete(id)
        this.observation++
      }
      for (const [id, enabled] of changes) if (enabled) this.connect(id, true)
      this.applied = choices
      if (JSON.stringify(await this.choices()) === JSON.stringify(choices)) return
    }
  }
}
