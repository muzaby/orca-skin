import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanOffenders, sourceFiles, stripCommentsAndStrings } from '../infra/source-scan'

const MAIN_ROOT = join(__dirname, '..')
const AUTH_SUBSCRIBE = /\bauth\s*\.\s*subscribe\s*\(/
const TRANSFORMED_CONTRIBUTIONS = /\bRUNTIME_MODEL_CONTRIBUTIONS\s*\./

function authSubscribeFiles(root: string): string[] {
  return sourceFiles(root)
    .filter((file) => AUTH_SUBSCRIBE.test(stripCommentsAndStrings(readFileSync(file, 'utf8'))))
    .map((file) => basename(file))
}

describe('runtime model Auth composition seam', () => {
  it('installs Auth listeners in exactly one production file', () => {
    expect(authSubscribeFiles(MAIN_ROOT)).toEqual(['runtime-model-startup.ts'])
  })

  it('passes runtime model contribution declarations without transforming them', () => {
    expect(scanOffenders(MAIN_ROOT, (source) => TRANSFORMED_CONTRIBUTIONS.test(source))).toEqual([])
  })

  it('target set includes nested production files and excludes tests', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-seam-'))
    mkdirSync(join(root, 'nested'))
    writeFileSync(join(root, 'nested', 'install.ts'), 'auth.subscribe(listener)\n')
    writeFileSync(join(root, 'ignored.test.ts'), 'auth.subscribe(listener)\n')

    expect(authSubscribeFiles(root)).toEqual(['install.ts'])
  })

  it('detects Auth subscription calls but ignores comments and strings', () => {
    expect(AUTH_SUBSCRIBE.test('auth.subscribe(listener)')).toBe(true)
    expect(AUTH_SUBSCRIBE.test('runtime.auth.subscribe(listener)')).toBe(true)
    expect(AUTH_SUBSCRIBE.test(stripCommentsAndStrings('// auth.subscribe(listener)'))).toBe(false)
    expect(
      AUTH_SUBSCRIBE.test(stripCommentsAndStrings("const hint = 'auth.subscribe(listener)'"))
    ).toBe(false)
  })

  it('detects contribution transforms without matching an intact declaration', () => {
    expect(TRANSFORMED_CONTRIBUTIONS.test('RUNTIME_MODEL_CONTRIBUTIONS.filter(predicate)')).toBe(
      true
    )
    expect(TRANSFORMED_CONTRIBUTIONS.test('RUNTIME_MODEL_CONTRIBUTIONS.map(project)')).toBe(true)
    expect(TRANSFORMED_CONTRIBUTIONS.test('contributions: RUNTIME_MODEL_CONTRIBUTIONS')).toBe(false)
  })
})
