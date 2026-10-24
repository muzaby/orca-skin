import { expect, it } from 'vitest'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { writeJsonAtomic } from './json-file'

it('creates missing parents, replaces existing files and leaves no temp file', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-json-file-'))
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
