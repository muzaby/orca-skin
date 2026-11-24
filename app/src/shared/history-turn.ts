export function isTurnStart(
  previous: { role: 'user' | 'assistant' } | undefined,
  current: { role: 'user' | 'assistant' }
): boolean {
  return previous === undefined || (previous.role === 'assistant' && current.role === 'user')
}
