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
// 아래 넷이 0202 D-008 의 **무동작 배선**을 막는다. 필수 필드라 *부재*는 typecheck 가 잡지만,
// `reconcileVerified: () => {}` 나 굳은 snapshot 은 타입이 맞아 전건 초록으로 지나간다.
const BUILD_AUTH_RESUME = /\bcreateAuthResume\s*\(/
const RECONCILE_VERIFIED_WIRING =
  /\breconcileVerified\s*:\s*createRuntimeModelReconcileVerified\s*\(/
// 공유 상수가 **진짜 factory 로** 만들어졌는지 — 이름만 같고 몸이 가짜면 토큰 스윕은 통과한다.
const SHARED_READER_BUILD =
  /\bconst\s+runtimeModelSnapshotOf\s*=\s*createRuntimeModelSnapshotReader\s*\(\s*auth\s*\)/
const SHARED_SINK_BUILD =
  /\bconst\s+reconcileRuntimeModelSnapshot\s*=\s*createRuntimeModelReconcileSnapshot\s*\(\s*runtimeModelCatalogBridge\s*\)/
// 불변식의 주어로 쓰는 음성 술어 — seam 이 store 를 손으로 다시 읽으면 여기 걸린다.
// 손으로 쓴 bridge forwarding — factory 정의 파일 밖에서는 0건이어야 한다.
const BRIDGE_FORWARD = /\.\s*onSnapshot\s*\(/
const INLINE_SNAPSHOT_READ = /\.\s*bind\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\.\s*snapshot\s*\(\s*\)/
// **주입 지점 단위 판정** (0202 D4). 파일 단위 boolean 은 `bootstrap.ts` 에 리터럴이 한 벌만
// 남아 있어도 통과시켜서, seam 하나가 개별로 무동작이 돼도 초록이었다. 그래서 `키:` 출현을
// **전부** 뽑아 허용 형태와 대조한다 — 분모는 불변식의 주어(재조정 축에 주입되는 인자)다.
const INJECTION_RULES: ReadonlyArray<{ key: string; allow: readonly RegExp[] }> = [
  {
    key: 'snapshotOf',
    allow: [
      /^runtimeModelSnapshotOf\b/, // 컴포지션 루트의 단일 reader 참조
      /^input\.snapshotOf\b/, // 순수 helper 내부 전달
      /^\(authId: AuthId\) => AuthSnapshot/ // 포트 타입 선언
    ]
  },
  {
    key: 'reconcileVerified',
    allow: [/^createRuntimeModelReconcileVerified\s*\(/, /^\(authId: AuthId\) => void/]
  },
  {
    key: 'reconcile',
    allow: [/^reconcileRuntimeModelSnapshot\b/, /^input\.reconcile\b/]
  },
  {
    key: 'bridge',
    allow: [
      /^runtimeModelCatalogBridge\b/,
      /^Pick<RuntimeModelCatalogBridge/,
      /^RuntimeModelCatalogBridge\b/
    ]
  },
  {
    key: 'invalidateForAuth',
    allow: [/^invalidateHarnessForAuth\b/, /^\(authId: AuthId\) => void/]
  },
  {
    key: 'onChange',
    allow: [
      /^createRuntimeModelAuthChangeHandler\s*\(/,
      /^pushConnectionState\b/,
      /^ActiveTurnCountListener\b/ // 재조정 축이 아닌 동명 생성자 인자
    ]
  }
]

// 뒤 60자면 형태를 가르기에 충분하다 — 줄바꿈은 첫 줄만 남겨 보고를 짧게 유지한다.
function injectionViolations(root: string): string[] {
  return sourceFiles(root).flatMap((file) => {
    const source = stripCommentsAndStrings(readFileSync(file, 'utf8'))
    return INJECTION_RULES.flatMap((rule) =>
      [...source.matchAll(new RegExp(`\\b${rule.key}\\s*:\\s*`, 'g'))]
        .map((match) =>
          source.slice(match.index + match[0].length, match.index + match[0].length + 60).trim()
        )
        .filter((tail) => !rule.allow.some((form) => form.test(tail)))
        .map((tail) => `${basename(file)} :: ${rule.key}: ${tail.split('\n')[0].trim()}`)
    )
  })
}

// 정의 파일은 조립 지점이 아니다 — 면제하지 않으면 `export function` 선언이 자기 스윕에 걸린다.
const AUTH_RESUME_DEFINITION = new Set(['auth-resume.ts'])

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

  it('builds the shared reader and bridge sink from the real factories', () => {
    // 토큰 스윕은 `runtimeModelSnapshotOf` 라는 **이름**만 요구한다. 그 이름의 몸이 실제
    // factory 인지는 여기가 잠근다 — 갈리면 이름만 맞는 가짜가 통과한다.
    expect(matchingFiles(MAIN_ROOT, SHARED_READER_BUILD, new Set())).toEqual(['bootstrap.ts'])
    expect(matchingFiles(MAIN_ROOT, SHARED_SINK_BUILD, new Set())).toEqual(['bootstrap.ts'])
  })

  it('wires every catalog-reconcile injection point to a locked form', () => {
    // 파일이 아니라 **출현**을 센다 — seam 하나만 굳어도 여기 걸린다.
    expect(injectionViolations(MAIN_ROOT)).toEqual([])
  })

  it('forwards to the catalog bridge only from the composition factories', () => {
    expect(matchingFiles(MAIN_ROOT, BRIDGE_FORWARD, new Set(['runtime-model-startup.ts']))).toEqual(
      []
    )
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

  it('flags one inert injection even when sibling seams keep the locked form', () => {
    // 이것이 D4 의 본체다 — r2 의 파일 단위 판정은 아래 fixture 를 통과시켰다.
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-injection-'))
    mkdirSync(join(root, 'nested'))
    const seams = (second: string): string =>
      [
        'const bridge = createRuntimeModelCatalogBridge({ snapshotOf: runtimeModelSnapshotOf })',
        `const catalog = createRuntimeModelCatalog({ snapshotOf: ${second} })`
      ].join('\n')
    writeFileSync(join(root, 'nested', 'bootstrap.ts'), seams('(authId) => frozen'))
    writeFileSync(join(root, 'ignored.test.ts'), seams('(authId) => frozen'))

    expect(injectionViolations(root)).toEqual(['bootstrap.ts :: snapshotOf: (authId) => frozen })'])

    writeFileSync(join(root, 'nested', 'bootstrap.ts'), seams('runtimeModelSnapshotOf'))
    expect(injectionViolations(root)).toEqual([])
  })

  it('flags an inert bridge argument and a hand-written forwarding', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-runtime-model-forward-'))
    writeFileSync(
      join(root, 'bootstrap.ts'),
      [
        'const sink = createRuntimeModelReconcileVerified({',
        '  bridge: { onSnapshot: async () => undefined },',
        '  snapshotOf: runtimeModelSnapshotOf',
        '})'
      ].join('\n')
    )
    // 가짜 bridge 는 **인자 형태**가 잡는다 — 객체 리터럴 키는 forwarding 이 아니다.
    expect(injectionViolations(root).map((entry) => entry.split(' :: ')[1])).toEqual([
      'bridge: { onSnapshot: async () => undefined },'
    ])
    expect(matchingFiles(root, BRIDGE_FORWARD, new Set())).toEqual([])

    // 손으로 쓴 forwarding 은 **음성 스윕**이 잡는다 — 두 장치가 서로 다른 것을 본다.
    writeFileSync(
      join(root, 'bootstrap.ts'),
      [
        'const sink = createRuntimeModelReconcileVerified({',
        '  bridge: runtimeModelCatalogBridge,',
        '  snapshotOf: runtimeModelSnapshotOf',
        '})',
        'void runtimeModelCatalogBridge.onSnapshot(authId, snapshot)'
      ].join('\n')
    )
    expect(injectionViolations(root)).toEqual([])
    expect(matchingFiles(root, BRIDGE_FORWARD, new Set())).toEqual(['bootstrap.ts'])
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
