/** The scalar frontmatter used by skill discovery; never evaluates YAML tags. */
export function skillMetadata(text: string): Record<string, string> {
  const block = text.replace(/^\uFEFF/, '').match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!block) return {}
  const lines = block[1].split(/\r?\n/)
  const result: Record<string, string> = {}
  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i].match(/^([\w-]+):\s*(.*)$/)
    if (!entry) continue
    const [, key, raw] = entry
    let value = raw.trim()
    if (/^[>|][+-]?$/.test(value)) {
      const body: string[] = []
      while (i + 1 < lines.length && /^(\s+\S|\s*$)/.test(lines[i + 1]))
        body.push(lines[++i].trim())
      value = body.join(value.startsWith('>') ? ' ' : '\n').trim()
    } else if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value) as string
      } catch {
        value = value.slice(1, -1)
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replaceAll("''", "'")
    } else value = value.replace(/\s+#.*$/, '').trim()
    result[key] = value
  }
  return result
}
