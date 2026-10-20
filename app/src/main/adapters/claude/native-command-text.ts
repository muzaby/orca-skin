/** Decode only Claude's complete command display envelope; never interpret arbitrary XML. */
export function nativeCommandText(text: string): string {
  const match = text.match(
    /^\s*<command-message>([^<>\r\n]+)<\/command-message>\s*<command-name>(\/[^<>\s]+)<\/command-name>(?:\s*<command-args>([\s\S]*)<\/command-args>)?\s*$/
  )
  if (!match || match[1] !== match[2].slice(1)) return text
  return match[2] + (match[3] ? ` ${match[3]}` : '')
}
