import type { GrammarState, HighlighterCore } from 'shiki/core'
import {
  TOKENS_CHECKPOINT_LINES,
  TOKENS_JOB_BUDGET_MS,
  TOKENS_THEME_CHAINS,
  TOKENIZE_MAX_LINE_CHARS,
  TOKENIZE_LINE_TIME_LIMIT_MS
} from '../limits'
import type { TokensRequest, TokenRows } from '../protocol'

export interface TokenDocument {
  text: string
  starts?: Uint32Array
  chains: Map<string, Map<number, GrammarState | undefined>>
}

function lineStarts(text: string): Uint32Array {
  let count = 1
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) count++
  const offsets = new Uint32Array(count)
  let row = 1
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) offsets[row++] = i + 1
  return offsets
}

export function* tokensRange(
  doc: TokenDocument,
  request: TokensRequest,
  highlighter: HighlighterCore,
  now: () => number
): Generator<'continue', { rows: TokenRows }> {
  let started = now()
  const { text } = doc
  const { start, lang, theme } = request
  const starts = (doc.starts ??= lineStarts(text))
  const end = Math.min(request.end, starts.length)
  const rows: TokenRows = []
  if (start >= end) return { rows }
  const key = lang + '|' + theme
  const chain = doc.chains.get(key) ?? new Map<number, GrammarState | undefined>()
  doc.chains.delete(key)
  doc.chains.set(key, chain)
  if (doc.chains.size > TOKENS_THEME_CHAINS) doc.chains.delete(doc.chains.keys().next().value!)
  let index = Math.floor(start / TOKENS_CHECKPOINT_LINES) * TOKENS_CHECKPOINT_LINES
  while (index > 0 && !chain.has(index)) index -= TOKENS_CHECKPOINT_LINES
  let grammarState = chain.get(index)
  while (index < end) {
    let stop = index + 1 < starts.length ? starts[index + 1] - 1 : text.length
    if (index + 1 < starts.length && text[stop - 1] === '\r') stop--
    const line = text.slice(starts[index], stop)
    const result = highlighter.codeToTokens(line, {
      lang,
      theme,
      grammarState,
      tokenizeMaxLineLength: TOKENIZE_MAX_LINE_CHARS,
      tokenizeTimeLimit: TOKENIZE_LINE_TIME_LIMIT_MS
    })
    grammarState = result.grammarState
    if (index >= start) rows.push(result.tokens[0])
    index++
    if (index % TOKENS_CHECKPOINT_LINES === 0) chain.set(index, grammarState)
    if (index === end) return { rows }
    if (now() - started >= TOKENS_JOB_BUDGET_MS) {
      yield 'continue'
      started = now()
    }
  }
  return { rows }
}
