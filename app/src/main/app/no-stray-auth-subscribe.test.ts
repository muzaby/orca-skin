import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanOffenders, sourceFiles, stripCommentsAndStrings } from '../infra/source-scan'

const MAIN_ROOT = join(__dirname, '..')
const AUTH_SUBSCRIBE = /\bauth\s*\.\s*subscribe\s*\(/
const TRANSFORMED_CONTRIBUTIONS = /\bRUNTIME_MODEL_CONTRIBUTIONS\s*\./
const START_RUNTIME_MODEL_CATALOG = /\bstartRuntimeModelCatalogAfterDeploy\s*\(/
const INSTALL_AUTH_RESUME = /\bcreateRuntimeModelAuthResume\s*\(/

function authSubscribeFiles(root: string): string[] {
  return sourceFiles(root)
    .filter((file) => AUTH_SUBSCRIBE.test(stripCommentsAndStrings(readFileSync(file, 'utf8'))))
    .map((file) => basename(file))
}

// 호출 형태(`이름(`)만 실재로 센다 — import 절의 식별자 언급은 배선이 아니다.
// 정의 파일(`runtime-model-startup.ts`)을 제외하므로 production 호출부가 사라지면 빈 배열이 된다.
function productionCallers(root: string, callPattern: RegExp): string[] {
  return sourceFiles(root)
    .filter((file) => basename(file) !== 'runtime-model-startup.ts')
    .filter((file) => callPattern.test(stripCommentsAndStrings(readFileSync(file, 'utf8'))))
    .map((file) => basename(file))
}

function runtimeModelStartupCallers(root: string): string[] {
  return productionCallers(root, START_RUNTIME_MODEL_CATALOG)
}

function authResumeInstallers(root: string): string[] {
  return productionCallers(root, INSTALL_AUTH_RESUME)
}

describe('runtime model Auth composition seam', () => {
  it('installs Auth listeners in exactly one production file', () => {
    expect(authSubscribeFiles(MAIN_ROOT)).toEqual(['runtime-model-startup.ts'])
  })

  it('starts the runtime model catalog from the production composition root', () => {
    expect(runtimeModelStartupCallers(MAIN_ROOT)).toEqual(['bootstrap.ts'])
  })

  it('installs the Auth resume listener helper from the production composition root', () => {
    expect(authResumeInstallers(MAIN_ROOT)).toEqual(['bootstrap.ts'])
  })

  it('passes runtime model contribution declarations without transforming them', () => {
    expect(scanOffenders(MAIN_ROOT, (source) => TRANSFORMED_CONTRIBUTIONS.test(source))).toEqual([])
  })

  it('target set includes nested production files and excludes tests', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-seam-'))
    mkdirSync(join(root, 'nested'))
    writeFileSync(join(root, 'nested', 'install.ts'), 'auth.subscribe(listener)\n')
    writeFileSync(join(root, 'ignored.test.ts'), 'auth.subscribe(listener)\n')
    writeFileSync(
      join(root, 'nested', 'bootstrap.ts'),
      ['startRuntimeModelCatalogAfterDeploy(input)', 'createRuntimeModelAuthResume(input)'].join(
        '\n'
      )
    )
    writeFileSync(
      join(root, 'ignored-startup.test.ts'),
      ['startRuntimeModelCatalogAfterDeploy(input)', 'createRuntimeModelAuthResume(input)'].join(
        '\n'
      )
    )

    expect(authSubscribeFiles(root)).toEqual(['install.ts'])
    expect(runtimeModelStartupCallers(root)).toEqual(['bootstrap.ts'])
    expect(authResumeInstallers(root)).toEqual(['bootstrap.ts'])
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

  it('detects startup calls but ignores the definition, comments, and strings', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-startup-'))
    writeFileSync(
      join(root, 'runtime-model-startup.ts'),
      'export function startRuntimeModelCatalogAfterDeploy() {}\n'
    )
    writeFileSync(
      join(root, 'bootstrap.ts'),
      [
        '// startRuntimeModelCatalogAfterDeploy(commented)',
        "const hint = 'startRuntimeModelCatalogAfterDeploy(string)'"
      ].join('\n')
    )

    expect(runtimeModelStartupCallers(root)).toEqual([])

    writeFileSync(join(root, 'bootstrap.ts'), 'await startRuntimeModelCatalogAfterDeploy(input)\n')
    expect(runtimeModelStartupCallers(root)).toEqual(['bootstrap.ts'])
  })

  it('detects resume installer calls but ignores the definition, imports, comments, and strings', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-resume-'))
    writeFileSync(
      join(root, 'runtime-model-startup.ts'),
      'export function createRuntimeModelAuthResume() {}\n'
    )
    writeFileSync(
      join(root, 'bootstrap.ts'),
      [
        "import { createRuntimeModelAuthResume } from './runtime-model-startup'",
        '// createRuntimeModelAuthResume(commented)',
        "const hint = 'createRuntimeModelAuthResume(string)'"
      ].join('\n')
    )

    expect(authResumeInstallers(root)).toEqual([])

    writeFileSync(join(root, 'bootstrap.ts'), 'resumeAuth: createRuntimeModelAuthResume(input)\n')
    expect(authResumeInstallers(root)).toEqual(['bootstrap.ts'])
  })
})
