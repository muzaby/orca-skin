import type { DbQueries } from '../../infra/db'
import { readHistorySource } from './reader'

/** Copy the authoritative parent view in the arrival transaction, before the first child input. */
export function copyForkDisplay(db: DbQueries, parent: string, child: string): number {
  const source = readHistorySource(db, parent, undefined, db.historyIndex.headers(parent))
  const copies = new Map<number, number>()
  for (const m of source.messages) {
    const content = m.parts
      .flatMap((p) => (p.type === 'text' && !p.parentToolRunId ? [p.text] : []))
      .join('\n')
    const id = db.appendMessage({
      sessionId: child,
      messageKey: m.id,
      role: m.role,
      createdAt: m.createdAt,
      complete: m.incomplete ? 0 : 1,
      content
    })
    for (const part of m.parts) {
      const { type, ...fields } = part
      db.appendPart({
        messageId: id,
        type,
        toolRunId: 'toolRunId' in part ? (part.toolRunId ?? null) : null,
        payloadJson: JSON.stringify(fields)
      })
    }
    for (const alias of source.aliases.get(m.id) ?? []) {
      if (alias.source === 'local') copies.set(Number(alias.identity), id)
      if (alias.source === 'native') db.nativeHistory.bind(id, alias.identity)
    }
  }
  db.artifacts.copyForFork(parent, child, copies)
  return source.messages.length
}
