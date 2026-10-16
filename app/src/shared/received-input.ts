import type { ReceivedMessageOrigin } from './session-schedules'

export type ReceivedInputFormat = NonNullable<ReceivedMessageOrigin['format']>

/**
 * Classify complete outer envelopes without interpreting their contents as HTML.
 * Callers must establish provider provenance first: tags alone are not evidence
 * of an automatic input or a request to send anything back to the provider.
 */
export function classifyReceivedInput(text: string): ReceivedInputFormat {
  const source = text.trim()
  if (!source) return 'plain'
  // Quoted attributes may contain `>`; a new `<` outside a quote is not a tag.
  const tag = /<\/?([A-Za-z][A-Za-z0-9_.:-]*)(?:[^<>"']|"[^"]*"|'[^']*')*>/g
  let cursor = 0
  let reminder = false
  while (cursor < source.length) {
    tag.lastIndex = cursor
    const opening = tag.exec(source)
    if (!opening || opening.index !== cursor || opening[0].startsWith('</')) return 'plain'
    const name = opening[1]
    reminder ||= name === 'system-reminder'
    let depth = /\/\s*>$/.test(opening[0]) ? 0 : 1
    while (depth > 0) {
      const next = tag.exec(source)
      if (!next) return 'plain'
      if (next[1] !== name) continue
      if (next[0].startsWith('</')) depth -= 1
      else if (!/\/\s*>$/.test(next[0])) depth += 1
    }
    cursor = tag.lastIndex
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1
  }
  return reminder ? 'system-reminder' : 'tagged'
}

export function withReceivedInputFormat(
  text: string,
  origin: ReceivedMessageOrigin
): ReceivedMessageOrigin {
  return { ...origin, format: classifyReceivedInput(text) }
}
