import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanOffenders, stripCommentsAndStrings } from '../infra/source-scan'

const MAIN_ROOT = join(__dirname, '..')
const AUTH_SUBSCRIBE = /\bauth\s*\.\s*subscribe\s*\(/
const TRANSFORMED_CONTRIBUTIONS = /\bRUNTIME_MODEL_CONTRIBUTIONS\s*\./
const START_RUNTIME_MODEL_CATALOG = /\bstartRuntimeModelCatalogAfterDeploy\s*\(/
const INSTALL_AUTH_RESUME = /\bcreateRuntimeModelAuthResume\s*\(/
// 아래 넷이 0202 D-008 의 **무동작 배선**을 막는다. 필수 필드라 *부재*는 typecheck 가 잡지만,
// `reconcileVerified: () => {}` 나 굳은 snapshot 은 타입이 맞아 전건 초록으로 지나간다.
const BUILD_AUTH_RESUME = /\bcreateAuthResume\s*\(/
const RECONCILE_VERIFIED_WIRING =
  /\breconcileVerified\s*:\s*createRuntimeModelReconcileVerified\s*\(/
const BUILD_RUNTIME_MODEL_CATALOG = /\bcreateRuntimeModelCatalog(?:Bridge)?\s*\(/
const SNAPSHOT_READER_WIRING = /\bsnapshotOf\s*:\s*createRuntimeModelSnapshotReader\s*\(/
// 불변식의 주어로 쓰는 음성 술어 — seam 이 store 를 손으로 다시 읽으면 여기 걸린다.
const INLINE_SNAPSHOT_READ = /\.\s*bind\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\.\s*snapshot\s*\(\s*\)/
// 정의 파일은 조립 지점이 아니다 — 면제하지 않으면 `export function` 선언이 자기 스윕에 걸린다.
const AUTH_RESUME_DEFINITION = new Set(['auth-resume.ts'])
const CATALOG_DEFINITION = new Set(['runtime-catalog.ts'])

// 스윕은 `infra/source-scan.ts` 가 소유한다 (0197 A-5) — 여기서 다시 적으면 같은 경로-구분자
// 버그를 두 벌 고쳐야 한다. 단언은 파일 이름으로 읽는 편이 좌표로 짧아 basename 으로 되돌린다.
function matchingFiles(root: string, pattern: RegExp, exempt: ReadonlySet<string>): string[] {
  return scanOffenders(root, (source) => pattern.test(source), exempt).map((path) => basename(path))
}

function authSubscribeFiles(root: string): string[] {
  return matchingFiles(root, AUTH_SUBSCRIBE, new Set())
}

// 호출 형태(`이름(`)만 실재로 센다 — import 절의 식별자 언급은 배선이 아니다.
// 정의 파일(`runtime-model-startup.ts`)을 제외하므로 production 호출부가 사라지면 빈 배열이 된다.
function productionCallers(root: string, callPattern: RegExp): string[] {
  return matchingFiles(root, callPattern, new Set(['runtime-model-startup.ts']))
}

function runtimeModelStartupCallers(root: string): string[] {
  return productionCallers(root, START_RUNTIME_MODEL_CATALOG)
}

function authResumeInstallers(root: string): string[] {
  return productionCallers(root, INSTALL_AUTH_RESUME)
}

// 조립 지점(`assembles`)을 훑고 그중 실배선(`wires`)이 없는 파일만 남긴다 — 분모는 내가 쓴
// 헬퍼 이름이 아니라 **불변식의 주어**(복원 batch 를 만드는 지점 · 카탈로그를 만드는 지점)다.
function unwiredSeams(
  root: string,
  assembles: RegExp,
  wires: RegExp,
  exempt: ReadonlySet<string> = new Set()
): string[] {
  return scanOffenders(root, (source) => assembles.test(source) && !wires.test(source), exempt).map(
    (path) => basename(path)
  )
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

  it('wires the verified-reconcile sink wherever it builds the resume batch', () => {
    expect(
      unwiredSeams(MAIN_ROOT, BUILD_AUTH_RESUME, RECONCILE_VERIFIED_WIRING, AUTH_RESUME_DEFINITION)
    ).toEqual([])
    expect(matchingFiles(MAIN_ROOT, RECONCILE_VERIFIED_WIRING, new Set())).toEqual(['bootstrap.ts'])
  })

  it('wires the live snapshot reader wherever it builds the catalog or its bridge', () => {
    expect(
      unwiredSeams(
        MAIN_ROOT,
        BUILD_RUNTIME_MODEL_CATALOG,
        SNAPSHOT_READER_WIRING,
        CATALOG_DEFINITION
      )
    ).toEqual([])
    expect(matchingFiles(MAIN_ROOT, SNAPSHOT_READER_WIRING, new Set())).toEqual(['bootstrap.ts'])
  })

  it('reads Auth snapshots only through the shared reader', () => {
    // 면제는 reader 정의 파일 하나다 — 그 파일이 곧 `auth.bind(id).snapshot()` 의 유일한 자리다.
    expect(
      matchingFiles(MAIN_ROOT, INLINE_SNAPSHOT_READ, new Set(['runtime-model-startup.ts']))
    ).toEqual([])
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

  it('flags a resume batch whose reconcile sink is inert, commented, or stringified', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-sink-'))
    mkdirSync(join(root, 'nested'))
    const inert = ['const resume = createAuthResume({', '  reconcileVerified: () => {}', '})'].join(
      '\n'
    )
    writeFileSync(join(root, 'nested', 'bootstrap.ts'), inert)
    writeFileSync(join(root, 'ignored.test.ts'), inert)
    expect(unwiredSeams(root, BUILD_AUTH_RESUME, RECONCILE_VERIFIED_WIRING)).toEqual([
      'bootstrap.ts'
    ])

    writeFileSync(
      join(root, 'nested', 'bootstrap.ts'),
      [
        'const resume = createAuthResume({',
        '  // reconcileVerified: createRuntimeModelReconcileVerified(deps)',
        '})'
      ].join('\n')
    )
    expect(unwiredSeams(root, BUILD_AUTH_RESUME, RECONCILE_VERIFIED_WIRING)).toEqual([
      'bootstrap.ts'
    ])

    writeFileSync(
      join(root, 'nested', 'bootstrap.ts'),
      [
        'const resume = createAuthResume({',
        '  reconcileVerified: createRuntimeModelReconcileVerified(deps)',
        '})'
      ].join('\n')
    )
    expect(unwiredSeams(root, BUILD_AUTH_RESUME, RECONCILE_VERIFIED_WIRING)).toEqual([])
  })

  it('flags a catalog built without the shared snapshot reader, and ad-hoc store reads', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-reader-'))
    writeFileSync(
      join(root, 'bootstrap.ts'),
      [
        'const catalog = createRuntimeModelCatalog({',
        '  snapshotOf: (authId) => auth.bind(authId).snapshot()',
        '})'
      ].join('\n')
    )
    expect(unwiredSeams(root, BUILD_RUNTIME_MODEL_CATALOG, SNAPSHOT_READER_WIRING)).toEqual([
      'bootstrap.ts'
    ])
    expect(matchingFiles(root, INLINE_SNAPSHOT_READ, new Set())).toEqual(['bootstrap.ts'])

    writeFileSync(
      join(root, 'bootstrap.ts'),
      [
        'const bridge = createRuntimeModelCatalogBridge({',
        '  snapshotOf: createRuntimeModelSnapshotReader(auth)',
        '})'
      ].join('\n')
    )
    expect(unwiredSeams(root, BUILD_RUNTIME_MODEL_CATALOG, SNAPSHOT_READER_WIRING)).toEqual([])
    expect(matchingFiles(root, INLINE_SNAPSHOT_READ, new Set())).toEqual([])
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
