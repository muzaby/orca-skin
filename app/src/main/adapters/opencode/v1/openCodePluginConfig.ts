import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser'
import { isRecord } from '../../../../shared/obj'
import type { OpenCodeDisabledPlugin } from '../../../../shared/native-resources'

export type PluginEntry = OpenCodeDisabledPlugin['entry']

export function parseConfig(text: string): unknown {
  const errors: ParseError[] = []
  const value: unknown = parse(text.replace(/^\uFEFF/, ''), errors, { allowTrailingComma: true })
  if (errors.length) throw new Error('OpenCode 설정 파일을 확인할 수 없습니다.')
  return value
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

function edit(text: string, index: number, value: PluginEntry | undefined, insert = false): string {
  const indent = /\r?\n([\t ]+)\S/.exec(text)?.[1] ?? '  '
  return applyEdits(
    text,
    modify(text, ['plugin', index], value, {
      isArrayInsertion: insert,
      formattingOptions: {
        insertSpaces: !indent.includes('\t'),
        tabSize: indent.length,
        eol: text.includes('\r\n') ? '\r\n' : '\n'
      }
    })
  )
}

export function removePluginEntry(text: string, index: number): string {
  return edit(text, index, undefined)
}

export function insertPluginEntry(text: string, entry: PluginEntry, index: number): string {
  const entries = pluginEntries(text)
  if (!entries) throw new Error('OpenCode 플러그인 설정이 변경되었습니다.')
  return edit(text, Math.min(index, entries.length), entry, true)
}
