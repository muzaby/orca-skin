import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import { parseJsonObject, readJsonObjectSync, writeJsonAtomic } from './json-file'

it('creates missing parents, replaces existing files and leaves no temp file', () => {
  const root = mkdtempSync(join(tmpdir(), 'orcinus-orca-json-file-'))
  try {
    const file = join(root, 'missing', 'parents', 'data.json')
    writeJsonAtomic(file, { first: true })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ first: true })
    writeJsonAtomic(file, { second: 'replacement' })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ second: 'replacement' })
    expect(readdirSync(dirname(file))).toEqual(['data.json'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('reads BOM objects, treats absent files as empty and preserves injected errors for malformed input', () => {
  const root = mkdtempSync(join(tmpdir(), 'orcinus-orca-json-read-'))
  const file = join(root, 'settings.json')
  const failure = new Error('redacted')
  const invalid = (): Error => failure
  try {
    expect(readJsonObjectSync(file, invalid)).toEqual({})
    writeFileSync(file, '\uFEFF{"enabled":true}')
    expect(readJsonObjectSync(file, invalid)).toEqual({ enabled: true })
    expect(parseJsonObject(undefined, invalid)).toEqual({})
    for (const text of ['[]', 'true', '{private']) {
      writeFileSync(file, text)
      expect(() => readJsonObjectSync(file, invalid)).toThrow(failure)
      expect(() => parseJsonObject(text, invalid)).toThrow(failure)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it.each([undefined, '', '  \r\n', '\uFEFF', '\uFEFF \n', 'null', '{}'])(
  'treats empty content %j as no settings',
  (text) => {
    expect(parseJsonObject(text, () => new Error('invalid'))).toEqual({})
  }
)

it.each(['[]', '1', '{"a":1'])('keeps non-empty invalid content %j invalid', (text) => {
  const failure = new Error('invalid')
  expect(() => parseJsonObject(text, () => failure)).toThrow(failure)
})
