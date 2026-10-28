import { randomUUID } from 'node:crypto'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeComposerCatalog } from '../../../../shared/native-resources'
import type { ComposerCatalogData } from '../../../../shared/composer-catalog'
import { openCodeNativeMcp, openCodeNativePlugins } from './native-resources'
import { openCodeComposerAgents, openCodeComposerModels } from './composer-catalog'
import { waitForOpenCode } from './instance-lifecycle'
import { openCodeRetention } from './retention-policy'
import { retentionTrace } from './retention-trace'

interface Slot<T> {
  value?: T
  flight?: Promise<T>
  updatedAt?: number
  epoch?: number
}

/** Native /agent bootstraps its own directory. No config, SSE or model barrier here. */
export class OpenCodeComposerCache {
  private readonly agentSlot: Slot<NativeComposerCatalog['agents']> = {}
  private readonly modelSlot: Slot<NativeComposerCatalog['models']> = {}
  private readonly mcpSlot: Slot<ComposerCatalogData['mcp']> = {}
  private readonly pluginSlot: Slot<ComposerCatalogData['plugins']> = {}
  constructor(
    private readonly client: OpencodeClient,
    private readonly directory: string,
    readonly signal: AbortSignal,
    readonly generation: string = randomUUID()
  ) {}

  agents(signal: AbortSignal, refresh = false): Promise<NativeComposerCatalog['agents']> {
    return this.read(this.agentSlot, openCodeComposerAgents, signal, refresh, 'agents')
  }

  models(signal: AbortSignal, refresh = false): Promise<NativeComposerCatalog['models']> {
    return this.read(this.modelSlot, openCodeComposerModels, signal, refresh, 'models')
  }

  mcp(signal: AbortSignal, refresh = false): Promise<ComposerCatalogData['mcp']> {
    return this.read(
      this.mcpSlot,
      openCodeNativeMcp,
      signal,
      refresh || Date.now() - (this.mcpSlot.updatedAt ?? -Infinity) >= openCodeRetention.mcpFreshMs,
      'mcp'
    )
  }

  invalidateMcp(): void {
    this.mcpSlot.epoch = (this.mcpSlot.epoch ?? 0) + 1
    this.mcpSlot.updatedAt = undefined
    this.mcpSlot.flight = undefined
  }

  plugins(
    signal: AbortSignal,
    refresh = false,
    env?: NodeJS.ProcessEnv
  ): Promise<ComposerCatalogData['plugins']> {
    return this.read(
      this.pluginSlot,
      (client, directory, requestSignal) =>
        openCodeNativePlugins(client, directory, env, requestSignal),
      signal,
      refresh,
      'plugins'
    )
  }

  private read<T>(
    slot: Slot<T>,
    load: (client: OpencodeClient, directory: string, signal: AbortSignal) => Promise<T>,
    caller: AbortSignal,
    refresh: boolean,
    part: keyof ComposerCatalogData
  ): Promise<T> {
    caller.throwIfAborted()
    this.signal.throwIfAborted()
    if (!slot.flight && !refresh && slot.value !== undefined) {
      retentionTrace('slot.hit', { instance: this.generation, part })
      return Promise.resolve(slot.value)
    }
    if (!slot.flight) {
      retentionTrace('slot.http', { instance: this.generation, part })
      const epoch = slot.epoch
      // First reads include native plugin/config-hook initialization. Warm reads only revalidate.
      const signal = AbortSignal.any([
        this.signal,
        AbortSignal.timeout(slot.value === undefined ? 120_000 : 15_000)
      ])
      const flight = load(this.client, this.directory, signal)
        .then((value) => {
          signal.throwIfAborted()
          if (slot.epoch !== epoch)
            throw new Error('OpenCode 목록이 변경되었습니다. 다시 조회해 주세요.')
          slot.value = value
          slot.updatedAt = Date.now()
          return value
        })
        .finally(() => {
          if (slot.flight === flight) slot.flight = undefined
        })
      slot.flight = flight
    }
    return waitForOpenCode(slot.flight, AbortSignal.any([caller, this.signal]))
  }
}
