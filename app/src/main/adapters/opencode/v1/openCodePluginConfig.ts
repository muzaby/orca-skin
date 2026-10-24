import { isRecord } from '../../../../shared/obj'

export type PluginEntry = string | [string, Record<string, unknown>]

/** Read JSONC without interpreting variables or returning credentials to the renderer. */
export function parseConfig(text: string): unknown {
  const stringsOrComments = /"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g
  const uncommented = text.replace(stringsOrComments, (token) =>
    token.startsWith('"') ? token : token.replace(/[^\r\n]/g, ' ')
  )
  return JSON.parse(
    uncommented
      .replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g, (token) => (token.startsWith('"') ? token : ''))
      .replace(/^\uFEFF/, '')
  )
}

export function pluginEntries(text: string): PluginEntry[] | undefined {
  const config = parseConfig(text)
  if (!isRecord(config)) throw new Error('OpenCode 설정 파일을 확인할 수 없습니다.')
  if (config.plugin === undefined) return undefined
  if (
    !Array.isArray(config.plugin) ||
    config.plugin.some(
      (entry) =>
        !(
          typeof entry === 'string' ||
          (Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === 'string' &&
            isRecord(entry[1]))
        )
    )
  )
    throw new Error('OpenCode 플러그인 설정을 확인할 수 없습니다.')
  return config.plugin as PluginEntry[]
}

export const pluginSpec = (entry: PluginEntry): string =>
  typeof entry === 'string' ? entry : entry[0]
