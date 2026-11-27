import type { MarkdownDefinition } from '../protocol'

// CommonMark labels contain at most 999 characters. Escaped brackets are part of a label.
export function usedDefinitions(
  text: string,
  definitions: ReadonlyMap<string, string>
): MarkdownDefinition[] {
  if (!definitions.size || !text.includes('[')) return []
  const used = new Map<string, string>()
  for (const match of text.matchAll(/\[((?:\\[\s\S]|[^[\]\\]){1,999})\]/gu)) {
    const key = match[1]
      .replace(/[\t\n\r ]+/g, ' ')
      .replace(/^ | $/g, '')
      .toLowerCase()
      .toUpperCase()
      .toLowerCase()
    const line = definitions.get(key)
    if (line !== undefined) used.set(key, line)
  }
  return [...used]
}
