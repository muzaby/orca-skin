export type MailQuery =
  | { readonly mode: 'match'; readonly expression: string; readonly parameter: string }
  | { readonly mode: 'like'; readonly expression: string; readonly parameter: string }

export function buildMailQuery(input: string): MailQuery {
  const value = Array.from(input.trim(), (character) =>
    character.charCodeAt(0) <= 0x1f ? ' ' : character
  ).join('')
  if (Array.from(value).length < 3) {
    return { mode: 'like', expression: 'LIKE ?', parameter: `%${value.replace(/[%_]/g, '\\$&')}%` }
  }
  const tokens = value
    .split(/\s+/u)
    .filter(Boolean)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
  return { mode: 'match', expression: 'MATCH ?', parameter: tokens.join(' AND ') }
}
