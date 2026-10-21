import { randomUUID } from 'node:crypto'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeComposerCatalog } from '../../../../shared/native-resources'
import { openCodeComposerAgents, openCodeComposerModels } from './composer-catalog'
import { waitForOpenCode } from './instance-lifecycle'

interface Slot<T> {
  value?: T
  flight?: Promise<T>
}

/** Native /agent bootstraps its own directory. No config, SSE or model barrier here. */
export class OpenCodeComposerCache {
  readonly generation = randomUUID()
  private readonly agentSlot: Slot<NativeComposerCatalog['agents']> = {}
  private readonly modelSlot: Slot<NativeComposerCatalog['models']> = {}
  constructor(
    private readonly client: OpencodeClient,
    private readonly directory: string,
    readonly signal: AbortSignal
  ) {}

  agents(signal: AbortSignal, refresh = false): Promise<NativeComposerCatalog['agents']> {
    return this.read(this.agentSlot, openCodeComposerAgents, signal, refresh)
  }

  models(signal: AbortSignal, refresh = false): Promise<NativeComposerCatalog['models']> {
    return this.read(this.modelSlot, openCodeComposerModels, signal, refresh)
  }

  private read<T>(
    slot: Slot<T>,
    load: (client: OpencodeClient, directory: string, signal: AbortSignal) => Promise<T>,
    caller: AbortSignal,
    refresh: boolean
  ): Promise<T> {
    caller.throwIfAborted()
    this.signal.throwIfAborted()
    if (!slot.flight && !refresh && slot.value !== undefined) return Promise.resolve(slot.value)
    if (!slot.flight) {
      // First reads include native plugin/config-hook initialization. Warm reads only revalidate.
      const signal = AbortSignal.any([
        this.signal,
        AbortSignal.timeout(slot.value === undefined ? 120_000 : 15_000)
      ])
      const flight = load(this.client, this.directory, signal)
        .then((value) => {
          signal.throwIfAborted()
          slot.value = value
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
