import type { NativeHistoryMessage } from '../../adapters/common/native-history'
import type { NativeMessageBinding } from '../../infra/db/native-history-queries'

/** A provider fork can copy, omit or re-key inherited messages. Only its child suffix is new display history. */
export function forkNativeSuffix(
  messages: NativeHistoryMessage[],
  bindings: NativeMessageBinding[],
  marker: number
): NativeHistoryMessage[] {
  const inherited = new Set<string>()
  const child = new Set<string>()
  for (const b of bindings) (b.message_id <= marker ? inherited : child).add(b.native_message_id)
  let lastInherited = -1
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const ids = [m.id, ...(m.sourceIds ?? [])]
    if (ids.some((id) => child.has(id)))
      return messages.slice(lastInherited >= 0 ? lastInherited + 1 : i)
    if (ids.some((id) => inherited.has(id))) lastInherited = i
  }
  return lastInherited >= 0 ? messages.slice(lastInherited + 1) : []
}
