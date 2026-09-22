import type { FileEntry } from '../../../../../shared/ipc'
import type { PluginMention } from './pluginMention'

const QUOTED_PARTIAL_RE = /(?:^|\s)@"([^"\n]*)$/
const PLAIN_PARTIAL_RE = /(?:^|\s)@([^\s"]*)$/

export interface MentionToken {
  partial: string
  tokenStart: number
  dirPath: string
  prefix: string
  quoted: boolean
}

export type MentionSuggestion = PluginMention | { kind: 'file'; entry: FileEntry; path: string }

export interface MentionGroup {
  kind: 'plugin' | 'path'
  suggestions: MentionSuggestion[]
}

export function parseMentionToken(text: string, caret: number): MentionToken | null {
  const before = text.slice(0, caret)
  const quoted = before.match(QUOTED_PARTIAL_RE)
  if (quoted) {
    const partial = quoted[1]
    return {
      partial,
      tokenStart: caret - partial.length - 2,
      ...splitDirAndPrefix(partial),
      quoted: true
    }
  }
  const plain = before.match(PLAIN_PARTIAL_RE)
  if (!plain) return null
  const partial = plain[1]
  return {
    partial,
    tokenStart: caret - partial.length - 1,
    ...splitDirAndPrefix(partial),
    quoted: false
  }
}

export function splitDirAndPrefix(partial: string): { dirPath: string; prefix: string } {
  const lastSlash = partial.lastIndexOf('/')
  if (lastSlash === -1) return { dirPath: '', prefix: partial }
  return { dirPath: partial.slice(0, lastSlash), prefix: partial.slice(lastSlash + 1) }
}

export function filterFileSuggestions(entries: readonly FileEntry[], prefix: string): FileEntry[] {
  const query = prefix.toLowerCase()
  const showHidden = prefix.startsWith('.')
  return entries
    .filter((entry) => {
      if (!showHidden && entry.name.startsWith('.')) return false
      return entry.name.toLowerCase().startsWith(query)
    })
    .slice(0, 8)
}

export function groupMentionSuggestions(
  token: MentionToken,
  plugins: readonly PluginMention[],
  entries: readonly FileEntry[] | undefined
): MentionGroup[] {
  const rootPlain = !token.quoted && token.dirPath === ''
  const groups: MentionGroup[] = []
  if (entries) {
    const pathSuggestions = filterFileSuggestions(entries, token.prefix).map((entry) => ({
      kind: 'file' as const,
      entry,
      path: token.dirPath === '' ? entry.name : `${token.dirPath}/${entry.name}`
    }))
    if (pathSuggestions.length > 0 || !rootPlain || plugins.length === 0) {
      groups.push({ kind: 'path', suggestions: pathSuggestions })
    }
  }
  if (rootPlain && plugins.length > 0) {
    groups.push({ kind: 'plugin', suggestions: [...plugins] })
  }
  return groups
}

export function flattenMentionGroups(groups: readonly MentionGroup[]): MentionSuggestion[] {
  return groups.flatMap((group) => group.suggestions)
}

export function applyMentionSuggestion(
  text: string,
  caret: number,
  token: MentionToken,
  suggestion: MentionSuggestion
): { text: string; caret: number } {
  const before = text.slice(0, token.tokenStart)
  const after = text.slice(caret)
  const followingWhitespace = /^\s/.test(after)
  if (suggestion.kind === 'plugin') {
    const replacement = `@${suggestion.id}${followingWhitespace ? '' : ' '}`
    return { text: `${before}${replacement}${after}`, caret: before.length + replacement.length }
  }

  const body = suggestion.entry.isDirectory ? `${suggestion.path}/` : suggestion.path
  const hasClosingQuote = token.quoted && text[caret] === '"'
  if (hasClosingQuote) {
    const replacement = `@"${body}`
    return {
      text: `${before}${replacement}${after}`,
      caret: before.length + replacement.length + (suggestion.entry.isDirectory ? 0 : 1)
    }
  }
  const wrapped = /\s/.test(body) ? `"${body}"` : body
  const replacement = suggestion.entry.isDirectory
    ? `@${wrapped}`
    : `@${wrapped}${followingWhitespace ? '' : ' '}`
  return { text: `${before}${replacement}${after}`, caret: before.length + replacement.length }
}

export function mentionGroupOptions(groups: readonly MentionGroup[]): MentionSuggestion[] {
  return flattenMentionGroups(groups)
}
