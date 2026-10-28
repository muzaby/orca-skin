/** Keep a native identifier with spaces as one @ token, just like a quoted file reference. */
export function pluginMentionToken(id: string): string {
  return `@${/[\s"]/.test(id) ? JSON.stringify(id) : id}`
}

/** Parse only complete whitespace-delimited tokens, using the renderer's JSON quoting. */
export function pluginMentionIds(text: string): string[] {
  const ids = new Set<string>()
  for (const match of text.matchAll(/(?:^|\s)@("(?:\\.|[^"\\])*"|[^\s"]+)(?=\s|$)/g)) {
    try {
      ids.add(match[1].startsWith('"') ? JSON.parse(match[1]) : match[1])
    } catch {
      // An incomplete or invalid quoted token is ordinary prompt text.
    }
  }
  return [...ids]
}
