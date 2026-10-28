import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { ExtensionControl } from '../../common/extension-control'
import type { ProjectResourcePolicy } from '../../common/project-resources'
import { openCodeNativeMcp } from './native-resources'
import { openCodeProjectResources, readOpenCodeProjectSettings } from './project-settings'
import type { NativeResource } from '../../../../shared/native-resources'
import type { OpenCodeComposerCache } from './composer-cache'
import { waitForOpenCode } from './instance-lifecycle'

/** Directory mutations and submission admissions share a serial queue. */
export class OpenCodeMcpControl {
  private activated = false
  activate(): void {
    this.activated = true
    void this.prepare().catch(() => undefined)
  }
  private initial?: Promise<void>
  private readFlight?: Promise<NativeResource[]>
  private applied?: string
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
    private readonly idle: (beforeSubmit: boolean) => boolean = () => true
  ) {
    this.startup = readOpenCodeProjectSettings(directory)
    void this.startup.catch(() => undefined)
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
  prepare(): Promise<void> {
    this.activated = true
    this.initial ??= this.run(async () => {
      if (this.safe(false)) await this.apply()
    }).catch((error: unknown) => {
      this.initial = undefined
      throw error
    })
    return this.initial
  }
  read(signal: AbortSignal, refresh = false): Promise<NativeResource[]> {
    signal.throwIfAborted()
    if (!this.activated) return Promise.resolve([])
    if (!this.readFlight) {
      // A status read must not straddle connect/disconnect invalidation. Keep the same
      // queue as mutations, while concurrent observers still share one read flight.
      const flight = this.prepare()
        .then(() => this.run(async () => this.preview(await this.status(this.signal, refresh))))
        .finally(() => {
          if (this.readFlight === flight) this.readFlight = undefined
        })
      this.readFlight = flight
    }
    return waitForOpenCode(this.readFlight, AbortSignal.any([signal, this.signal]))
  }
  async reconcileChoices(): Promise<void> {
    if (!this.activated) return
    if (!this.safe(false)) return
    await this.run(async () => {
      if (this.safe(false)) await this.apply()
    })
  }
  /** Reserve admission synchronously in the same queue as connect/disconnect. */
  submit<T>(signal: AbortSignal, action: () => Promise<T>): Promise<T> {
    return this.run(async () => {
      const combined = AbortSignal.any([signal, this.signal])
      while (!this.safe(true)) {
        combined.throwIfAborted()
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 20)
          timer.unref?.()
        })
      }
      combined.throwIfAborted()
      await waitForOpenCode(this.apply(), combined)
      combined.throwIfAborted()
      return action()
    })
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
    return { ...global, ...mcp, ...this.managed?.choices() }
  }
  async pending(): Promise<boolean> {
    return this.applied !== JSON.stringify(await this.choices())
  }
  async preview(items: NativeResource[]): Promise<NativeResource[]> {
    const choices = await this.choices(readOpenCodeProjectSettings(this.directory))
    return items.map((item) => ({
      ...item,
      canToggle: false,
      ...(item.kind === 'mcp' && choices[item.id] !== undefined
        ? { enabled: choices[item.id] }
        : {})
    }))
  }
  private async status(signal: AbortSignal, refresh = false): Promise<NativeResource[]> {
    return (
      this.cache?.mcp(signal, refresh) ?? openCodeNativeMcp(this.client, this.directory, signal)
    )
  }
  private async apply(): Promise<void> {
    for (;;) {
      this.signal.throwIfAborted()
      const choices = await this.choices()
      const revision = JSON.stringify(choices)
      if (this.applied === revision) return
      if (!Object.keys(choices).length) {
        this.applied = revision
        return
      }
      const signal = AbortSignal.any([this.signal, AbortSignal.timeout(120_000)])
      const items = await this.status(signal)
      const changes = items.filter(
        (item) =>
          choices[item.id] !== undefined && choices[item.id] !== (item.status === 'connected')
      )
      const results = await Promise.allSettled(
        changes.map(async (item) => {
          const params = { directory: this.directory, name: item.id }
          if (choices[item.id])
            await this.client.mcp.connect(params, { signal, throwOnError: true })
          else await this.client.mcp.disconnect(params, { signal, throwOnError: true })
        })
      )
      if (changes.length) this.cache?.invalidateMcp()
      signal.throwIfAborted()
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('일부 MCP 변경을 적용하지 못했습니다.')
      const actual = changes.length ? await this.status(signal, true) : items
      if (
        Object.entries(choices).some(([id, enabled]) => {
          const item = actual.find((entry) => entry.id === id)
          return item
            ? (item.status === 'connected') !== enabled
            : enabled && !!this.managed?.choices()[id]
        })
      )
        throw new Error('일부 MCP 연결 상태를 확인하지 못했습니다.')
      // A newer desired choice may have arrived while the HTTP request was running.
      if (JSON.stringify(await this.choices()) !== revision) continue
      this.applied = revision
      return
    }
  }
}
