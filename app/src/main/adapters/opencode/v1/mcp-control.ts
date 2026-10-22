import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { ExtensionControl } from '../../common/extension-control'
import type { ProjectResourcePolicy } from '../../common/project-resources'
import { openCodeNativeMcp } from './native-resources'
import { openCodeProjectResources, readOpenCodeProjectSettings } from './project-settings'
import type { NativeResource } from '../../../../shared/native-resources'

/** One native directory owns this state. Global changes never invalidate it. */
export class OpenCodeMcpControl {
  private readonly defaults: Record<string, boolean>
  private initial?: Promise<void>
  private readonly startup: ReturnType<typeof readOpenCodeProjectSettings>
  readonly policy: ProjectResourcePolicy
  constructor(
    private readonly client: OpencodeClient,
    private readonly directory: string,
    control: ExtensionControl,
    private readonly signal: AbortSignal
  ) {
    this.defaults = Object.fromEntries(
      Object.entries(control.global('opencode'))
        .filter(([key]) => key.startsWith('mcp:'))
        .map(([key, value]) => [key.slice(4), value])
    )
    this.policy = openCodeProjectResources
    this.startup = readOpenCodeProjectSettings(directory)
    void this.startup.catch(() => undefined)
  }

  prepare(): Promise<void> {
    this.initial ??= this.apply()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.initial = undefined
        throw error
      })
    return this.initial
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
    if (!idle()) return 'pending'
    return revision === (await this.startup).revision ? 'applied' : 'restart-required'
  }

  async preview(items: NativeResource[]): Promise<NativeResource[]> {
    const { mcp } = await readOpenCodeProjectSettings(this.directory)
    return items.map((item) => ({
      ...item,
      canToggle: false,
      ...(item.kind === 'mcp' && mcp[item.id] !== undefined ? { enabled: mcp[item.id] } : {})
    }))
  }

  private requestSignal(): AbortSignal {
    return AbortSignal.any([this.signal, AbortSignal.timeout(120_000)])
  }

  private async apply(): Promise<boolean> {
    const project = await this.startup
    const choices = Object.fromEntries(
      Object.entries(this.defaults).filter(([id]) => project.mcp[id] === undefined)
    )
    if (!Object.keys(choices).length) return true
    const signal = this.requestSignal()
    const items = await openCodeNativeMcp(this.client, this.directory, signal)
    // Independent servers connect in parallel, after native config/plugin initialization.
    const results = await Promise.allSettled(
      items
        .filter((item) => choices[item.id] !== undefined && choices[item.id] !== item.enabled)
        .map(async (item) => {
          const params = { directory: this.directory, name: item.id }
          if (choices[item.id])
            await this.client.mcp.connect(params, { signal, throwOnError: true })
          else await this.client.mcp.disconnect(params, { signal, throwOnError: true })
        })
    )
    signal.throwIfAborted()
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('일부 MCP 변경을 적용하지 못했습니다.')
    return true
  }
}
