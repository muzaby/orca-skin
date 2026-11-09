import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../../infra/error-report'
import {
  readClaudePluginManifest,
  readClaudePluginManifestAsync,
  readClaudeSettingsObject,
  readClaudeSettingsObjectAsync
} from './native-settings-file'

vi.mock('../../infra/error-report', () => ({ reportError: vi.fn() }))

let temp: string
beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'orca-native-settings-'))
  vi.mocked(reportError).mockClear()
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))

const write = (file: string, text: string): void => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const reasons = (): unknown[] =>
  vi.mocked(reportError).mock.calls.map(([input]) => input.data?.reason)

describe.each([
  ['sync', (file: string) => Promise.resolve(readClaudeSettingsObject(file))],
  ['async', readClaudeSettingsObjectAsync]
] as const)('Claude settings document reader (%s)', (_mode, read) => {
  it('treats an absent file as no settings', async () => {
    expect(await read(join(temp, 'settings.json'))).toEqual({})
    expect(reportError).not.toHaveBeenCalled()
  })
  it.each(['', '  \r\n', '﻿', 'null'])('treats empty content %j as no settings', async (text) => {
    const file = join(temp, 'settings.json')
    write(file, text)
    expect(await read(file)).toEqual({})
    expect(reportError).not.toHaveBeenCalled()
  })
  it('returns a valid object unchanged', async () => {
    const file = join(temp, 'settings.json')
    write(file, '﻿{"enabledPlugins":{"a@m":true}}')
    expect(await read(file)).toEqual({ enabledPlugins: { 'a@m': true } })
    expect(reportError).not.toHaveBeenCalled()
  })
  it.each([
    ['a trailing comma', '{"a":1,}', 'parse'],
    ['a non-object', '[]', 'shape']
  ])('skips %s with one warning that names the file', async (_name, text, reason) => {
    const file = join(temp, 'settings.json')
    write(file, text)
    expect(await read(file)).toEqual({})
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][0]).toEqual({
      event: 'claude.native-settings.skipped',
      scope: 'claude',
      title: 'configInvalid',
      level: 'warn',
      detail: `Claude 설정 파일을 읽지 못해 이 파일 없이 진행합니다: ${file}`,
      data: { file, reason }
    })
  })
  it('skips an unreadable path with one read warning', async () => {
    const file = join(temp, 'settings.json')
    mkdirSync(file)
    expect(await read(file)).toEqual({})
    expect(reasons()).toEqual(['read'])
    expect(vi.mocked(reportError).mock.calls[0][0].detail).toContain(file)
  })
  it('warns once per file state and again when the broken content changes', async () => {
    const file = join(temp, 'settings.json')
    write(file, '{"secret":"first",}')
    await read(file)
    await read(file)
    expect(reportError).toHaveBeenCalledTimes(1)
    write(file, '{"secret":"second",}')
    await read(file)
    await read(file)
    expect(reportError).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toMatch(/first|second/)
  })
  it('warns again after the file was repaired and broke again', async () => {
    const file = join(temp, 'settings.json')
    write(file, '{"a":1,}')
    await read(file)
    write(file, '{"a":1}')
    expect(await read(file)).toEqual({ a: 1 })
    write(file, '{"a":1,}')
    await read(file)
    expect(reportError).toHaveBeenCalledTimes(2)
  })
})

describe.each([
  ['sync', (root: string) => Promise.resolve(readClaudePluginManifest(root))],
  ['async', readClaudePluginManifestAsync]
] as const)('Claude plugin manifest reader (%s)', (_mode, read) => {
  const manifest = (root: string): string => join(root, '.claude-plugin', 'plugin.json')
  it('treats an absent manifest as an empty manifest', async () => {
    expect(await read(join(temp, 'plugin'))).toEqual({})
    expect(reportError).not.toHaveBeenCalled()
  })
  it('treats an empty manifest as an empty manifest', async () => {
    const root = join(temp, 'plugin')
    write(manifest(root), '')
    expect(await read(root)).toEqual({})
    expect(reportError).not.toHaveBeenCalled()
  })
  it('excludes a plugin whose manifest is broken, with one warning', async () => {
    const root = join(temp, 'plugin')
    write(manifest(root), '{"name":"p",')
    expect(await read(root)).toBeUndefined()
    expect(await read(root)).toBeUndefined()
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][0]).toMatchObject({
      detail: `Claude 플러그인 설정을 읽지 못해 이 플러그인을 제외했습니다: ${manifest(root)}`,
      data: { file: manifest(root), reason: 'parse' }
    })
  })
})
