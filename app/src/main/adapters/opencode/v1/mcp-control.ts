import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { ExtensionControl } from '../../common/extension-control'
import type { ProjectResourcePolicy } from '../../common/project-resources'
import { openCodeNativeMcp } from './native-resources'

/** One native directory owns this state. Global changes never invalidate it. */
export class OpenCodeMcpControl {
  private readonly defaults: Record<string, boolean>
  private initial?: Promise<void>
  readonly policy: ProjectResourcePolicy
  constructor(
    private readonly client: OpencodeClient,
    private readonly directory: string,
    private readonly control: ExtensionControl,
    private readonly signal: AbortSignal
  ) {
    this.defaults = Object.fromEntries(
      Object.entries(control.global('opencode'))
        .filter(([key]) => key.startsWith('mcp:'))
        .map(([key, value]) => [key.slice(4), value])
    )
    this.policy = { files: () => [], read: async () => ({ revision: this.revision() }) }
  }

  private revision(): string {
    return JSON.stringify(this.control.projectMcp(this.directory))
  }

  prepare(): Promise<void> {
    this.initial ??= this.apply(() => true)
      .then(() => undefined)
      .catch((error: unknown) => {
        this.initial = undefined
        throw error
      })
    return this.initial
  }

  async set(id: string, enabled: boolean): Promise<void> {
    const items = await openCodeNativeMcp(this.client, this.directory, this.requestSignal())
    this.signal.throwIfAborted()
    if (!items.some((item) => item.id === id))
      throw new Error('현재 프로젝트에서 MCP를 찾을 수 없습니다.')
    // ProjectResourceSync applies this only once every peer in the project is idle.
    this.control.setProjectMcp(this.directory, id, enabled)
  }

  async reconcile(revision: string, idle: () => boolean): Promise<'applied' | 'pending'> {
    if (!idle() || revision !== this.revision()) return 'pending'
    const applied = await this.apply(() => idle() && revision === this.revision())
    return applied ? 'applied' : 'pending'
  }

  private requestSignal(): AbortSignal {
    return AbortSignal.any([this.signal, AbortSignal.timeout(120_000)])
  }

  private async apply(idle: () => boolean): Promise<boolean> {
    const choices = { ...this.defaults, ...this.control.projectMcp(this.directory) }
    if (!Object.keys(choices).length) return true
    const signal = this.requestSignal()
    const items = await openCodeNativeMcp(this.client, this.directory, signal)
    if (!idle()) return false
    // Independent servers connect in parallel, after native config/plugin initialization.
    const results = await Promise.allSettled(
      items
        .filter((item) => choices[item.id] !== undefined && choices[item.id] !== item.enabled)
        .map(async (item) => {
          if (!idle()) return
          const params = { directory: this.directory, name: item.id }
          if (choices[item.id])
            await this.client.mcp.connect(params, { signal, throwOnError: true })
          else await this.client.mcp.disconnect(params, { signal, throwOnError: true })
        })
    )
    signal.throwIfAborted()
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('일부 MCP 변경을 적용하지 못했습니다.')
    return idle()
  }
}
