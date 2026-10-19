import type { AssistantMessage } from '@opencode-ai/sdk/v2'
import { isRecord } from '../../../../shared/obj'

export function openCodeContextWindow(config: Record<string, unknown>, model?: string): number {
  const slash = model?.indexOf('/') ?? -1
  const providers = config.provider
  const provider =
    model && slash > 0 && isRecord(providers) ? providers[model.slice(0, slash)] : undefined
  const models = isRecord(provider) ? provider.models : undefined
  const definition = model && isRecord(models) ? models[model.slice(slash + 1)] : undefined
  const limit = isRecord(definition) ? definition.limit : undefined
  const context = isRecord(limit) ? limit.context : undefined
  return typeof context === 'number' && Number.isFinite(context) && context > 0 ? context : 200000
}

export function lastOpenCodeStep(
  messages: Iterable<AssistantMessage>
): AssistantMessage | undefined {
  let last: AssistantMessage | undefined
  for (const message of messages) {
    if (
      !last ||
      message.time.created > last.time.created ||
      (message.time.created === last.time.created && message.id > last.id)
    )
      last = message
  }
  return last
}

export function openCodeStepContext(message?: AssistantMessage): number | undefined {
  const tokens = message?.tokens
  const counts = [tokens?.input, tokens?.cache?.read, tokens?.cache?.write]
  return counts.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    ? counts.reduce<number>((sum, value) => sum + value!, 0)
    : undefined
}
