// 0225 제품 식별자 계약 — 이름의 SSOT 와 그 사본들이 어긋나지 않는지 본다.
//
// 여기서만 할 수 있는 단언이 셋이다.
//   ① 빌드 설정 2개 파일(`package.json`·`electron-builder.yml`)은 코드에서 import 할 수 없어
//      값을 복제한다. 파일을 파싱해 SSOT 와 대조하는 것이 그 사본을 검증된 사본으로 만든다.
//   ② 표시명·레거시 상수의 **전수 스윕**은 파일 트리를 읽어야 성립한다.
//   ③ 모듈 사설 상수(store name·마커)는 electron 을 물어 import 할 수 없다 — 소스 텍스트로 본다.
//      구조적 proxy 이므로 각 단언은 "새 표기가 있다" 와 "옛 리터럴이 없다" 를 **함께** 본다.

import { readFileSync, readdirSync } from 'node:fs'
import { join, posix, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_USER_MODEL_ID,
  LEGACY_PRODUCT_SLUG,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_SLUG
} from '../shared/product'

// vitest cwd = `app/`.
const APP_ROOT = process.cwd()
const REPO_ROOT = join(APP_ROOT, '..')

function read(...parts: string[]): string {
  return readFileSync(join(APP_ROOT, ...parts), 'utf8')
}

function walk(dir: string, accept: (file: string) => boolean): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, accept))
    else if (accept(full)) out.push(full)
  }
  return out
}

function relative(file: string): string {
  return file
    .slice(APP_ROOT.length + 1)
    .split(sep)
    .join(posix.sep)
}

const PROD_SOURCE = (file: string): boolean =>
  /\.(ts|tsx|html)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file)

// ── ① 빌드 식별자 — §10 EP-01 / EP-02 ─────────────────────────────────────────
describe('빌드 식별자 (EP-01 · EP-02)', () => {
  const pkg = JSON.parse(read('package.json')) as Record<string, unknown>
  const builder = read('electron-builder.yml')

  it('package.json name 이 슬러그다 — 설치 디렉토리·${name} 매크로·업데이트 캐시의 출처', () => {
    expect(pkg.name).toBe(PRODUCT_SLUG)
  })

  it('package.json 에 productName 키가 없다 (D-016)', () => {
    // 키가 생기면 app.getName() 이 `productName ?? name` 이라 userData 가 공백 포함
    // 경로(`Orcinus orca`)로 조용히 옮겨간다.
    expect('productName' in pkg).toBe(false)
  })

  it('electron-builder appId 가 SSOT 와 같고 옛 값이 아니다 (D-013)', () => {
    expect(builder).toMatch(new RegExp(`^appId: ${APP_USER_MODEL_ID}$`, 'm'))
    expect(builder).not.toContain('com.orca.app')
  })

  it('electron-builder productName 이 표시명이다 — 바로가기·제거 표시 이름', () => {
    expect(builder).toMatch(new RegExp(`^productName: ${PRODUCT_DISPLAY_NAME}$`, 'm'))
  })

  it('win.executableName 이 슬러그다', () => {
    expect(builder).toMatch(new RegExp(`^ {2}executableName: ${PRODUCT_SLUG}$`, 'm'))
  })

  it('nsis artifactName 이 ${name} 매크로를 쓴다 — 설치 파일이 슬러그를 따라간다', () => {
    expect(builder).toContain('artifactName: ${name}-${version}-setup.${ext}')
  })

  it('main 프로세스가 SSOT 값으로 AppUserModelID 를 설정한다', () => {
    const source = read('src', 'main', 'index.ts')
    expect(source).toContain('setAppUserModelId(APP_USER_MODEL_ID)')
    expect(source).not.toContain('com.orca.app')
  })
})

// ── ② 화면 표시명 — §10 EP-04 (31지점) ────────────────────────────────────────
describe('표시명 (EP-04)', () => {
  const RENDERER = join(APP_ROOT, 'src', 'renderer')
  // 불변식의 **주어** — 홀로 선 제품명 단어. 코드 식별자(`OrcaLogo`·`orcaApi`)는 단어 경계가
  // 성립하지 않아 걸리지 않고, 새 표기 `Orcinus orca` 의 소문자 `orca` 도 걸리지 않는다.
  const SUBJECT = /\bOrca\b/

  it('SSOT 값이 요구 표기다', () => {
    expect(PRODUCT_DISPLAY_NAME).toBe('Orcinus orca')
    expect(PRODUCT_SLUG).toBe('orcinus-orca')
  })

  it('renderer prod 전체에 옛 표기가 0건이다 (음성 스윕)', () => {
    const hits: string[] = []
    for (const file of walk(RENDERER, PROD_SOURCE)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (SUBJECT.test(line)) hits.push(`${relative(file)}:${index + 1}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('표시명을 그리는 renderer 파일이 SSOT 를 참조한다 (양성 — 소비처 삭제를 잡는다)', () => {
    const consumers = [
      ['src', 'renderer', 'src', 'app', 'Header.tsx'],
      ['src', 'renderer', 'src', 'app', 'Sidebar.tsx'],
      ['src', 'renderer', 'src', 'app', 'AppLayout.tsx'],
      ['src', 'renderer', 'src', 'app', 'GateFrame.tsx'],
      ['src', 'renderer', 'src', 'app', 'BootFailureFrame.tsx'],
      ['src', 'renderer', 'src', 'app', 'boot', 'BootScreen.tsx'],
      ['src', 'renderer', 'src', 'app', 'hooks', 'useCompletionNotifier.ts'],
      ['src', 'renderer', 'src', 'features', 'providers', 'components', 'GateLogin.tsx'],
      ['src', 'renderer', 'src', 'shared', 'ui', 'OrcaLogo.tsx'],
      ['src', 'renderer', 'src', 'shared', 'i18n', 'resources', 'ko.ts'],
      ['src', 'renderer', 'src', 'shared', 'i18n', 'resources', 'en.ts']
    ]
    const missing = consumers.filter((parts) => !read(...parts).includes('PRODUCT_DISPLAY_NAME'))
    expect(missing).toEqual([])
  })

  it('index.html title 이 SSOT 값과 문자열 일치한다 (import 불가라 사본이다)', () => {
    expect(read('src', 'renderer', 'index.html')).toContain(
      `<title>${PRODUCT_DISPLAY_NAME}</title>`
    )
  })

  // main 은 전수 스윕 대상이 아니다 — 프롬프트 본문·주석의 `Orca` 가 D-012 로 남는다.
  // 대신 사용자 대면 7지점을 열거된 양성 단언으로 잠근다.
  it('main 의 사용자 대면 문구 7지점이 SSOT 파생이다', () => {
    const sites: [string[], string][] = [
      [['src', 'main', 'app', 'bootstrap.ts'], '`${PRODUCT_DISPLAY_NAME} 스킬`'],
      [['src', 'main', 'app', 'bootstrap.ts'], '`${PRODUCT_DISPLAY_NAME} 설정 디렉터리 보장`'],
      [['src', 'main', 'app', 'bootstrap.ts'], '`${PRODUCT_SLUG}.json 로드`'],
      [['src', 'main', 'features', 'extensions', 'deployer.ts'], '`${PRODUCT_DISPLAY_NAME} 스킬`'],
      [
        ['src', 'main', 'app', 'handlers', 'skills.ts'],
        '`${PRODUCT_DISPLAY_NAME} 스킬만 제거할 수 있습니다.`'
      ],
      [
        ['src', 'main', 'features', 'extensions', 'skills', 'sources.ts'],
        '`${PRODUCT_DISPLAY_NAME} 스킬 sources 안의 항목만 제거할 수 있습니다.`'
      ],
      [
        ['src', 'main', 'features', 'extensions', 'harness-plugins', 'claude.ts'],
        '`${PRODUCT_DISPLAY_NAME}에서 구성된 skill 및 mcp`'
      ]
    ]
    for (const [parts, expected] of sites) {
      const source = read(...parts)
      expect(source, relative(join(APP_ROOT, ...parts))).toContain(expected)
    }
    expect(read('src', 'main', 'app', 'bootstrap.ts')).not.toContain("'Orca ")
    expect(read('src', 'main', 'features', 'extensions', 'deployer.ts')).not.toContain("'Orca ")
    expect(read('src', 'main', 'app', 'bootstrap.ts')).not.toContain("'orca.json 로드'")
  })
})

// ── ③ 레거시 경로 상수의 소비자 — §10 EP-05 / D-010 ───────────────────────────
describe('레거시 경로 상수 (EP-05)', () => {
  const LEGACY_SYMBOLS = /legacyConfigDir|legacyUserDataDir/

  it('prod 코드에서 이 둘을 언급하는 파일은 정의 1 + 이관 모듈 1 뿐이다 (음성 스윕)', () => {
    const files = walk(join(APP_ROOT, 'src'), PROD_SOURCE)
      .filter((file) => LEGACY_SYMBOLS.test(readFileSync(file, 'utf8')))
      .map(relative)
      .sort()
    expect(files).toEqual([
      'src/main/infra/config/migrate-legacy.ts',
      'src/main/infra/config/paths.ts'
    ])
  })

  it('이관 모듈이 두 함수를 실제로 호출한다 (양성 — 스윕이 0건인 이유가 "아무도 안 쓴다" 가 아님)', () => {
    const source = read('src', 'main', 'infra', 'config', 'migrate-legacy.ts')
    expect(source).toContain('legacyConfigDir()')
    expect(source).toContain('legacyUserDataDir(input.appDataDir, input.isDev)')
  })

  it('이관 모듈이 읽기 전용 폴백을 공개 API 로 노출하지 않는다', () => {
    const exported = [
      ...read('src', 'main', 'infra', 'config', 'migrate-legacy.ts').matchAll(
        /^export (?:function|const) (\w+)/gm
      )
    ].map((match) => match[1])
    expect(exported).toEqual(['migrateLegacyRoots', 'migrationBlocksBoot'])
  })
})

// ── ④ 파일시스템 이름 6종 + 플러그인 2종 — §10 EP-03 ──────────────────────────
// 소스 텍스트로 보는 구조적 proxy 다. "새 표기가 있다" 와 "옛 리터럴이 없다" 를 함께 본다 —
// 앞쪽만 보면 옛 리터럴을 되살린 두 번째 자리를 못 잡고, 뒤쪽만 보면 상수를 지운 것을 못 잡는다.
describe('내부 저장 이름 (EP-03)', () => {
  const cases: [string, string[], string, string][] = [
    [
      'settings-store',
      ['src', 'main', 'infra', 'settings-store.ts'],
      '`${PRODUCT_SLUG}-settings`',
      "'orca-settings'"
    ],
    [
      'secret-store',
      ['src', 'main', 'infra', 'config', 'secret-store.ts'],
      '`${PRODUCT_SLUG}-secrets`',
      "'orca-secrets'"
    ],
    [
      'provider grants',
      ['src', 'main', 'features', 'auth', 'store-file.ts'],
      '`${PRODUCT_SLUG}-provider-grants`',
      "'orca-provider-grants'"
    ],
    [
      'provider oauth',
      ['src', 'main', 'features', 'auth', 'store-file.ts'],
      '`${PRODUCT_SLUG}-provider-oauth`',
      "'orca-provider-oauth'"
    ],
    [
      'deploy marker',
      ['src', 'main', 'features', 'extensions', 'deployer.ts'],
      '`.${PRODUCT_SLUG}-deploy.json`',
      "'.orca-deploy.json'"
    ],
    [
      'seed marker',
      ['src', 'main', 'features', 'extensions', 'skills', 'seed.ts'],
      '`.${PRODUCT_SLUG}-builtin.json`',
      "'.orca-builtin.json'"
    ],
    ['db 파일', ['src', 'main', 'infra', 'db', 'index.ts'], '`${PRODUCT_SLUG}.db`', "'orca.db'"],
    [
      'db 백업',
      ['src', 'main', 'infra', 'db', 'migrate.ts'],
      '`${PRODUCT_SLUG}.db.backup.before-',
      "'orca.db.backup"
    ],
    [
      '로그 디렉토리',
      ['src', 'main', 'infra', 'log', 'index.ts'],
      "join(orcaConfigDir(), 'logs')",
      "'.config', 'orca'"
    ],
    [
      'artifacts 루트',
      ['src', 'main', 'app', 'bootstrap.ts'],
      "join(orcaConfigDir(), 'artifacts'",
      "'.config', 'orca'"
    ]
  ]

  for (const [label, parts, present, absent] of cases) {
    it(`${label} 이름이 PRODUCT_SLUG 파생이다`, () => {
      const source = read(...parts)
      expect(source).toContain(present)
      expect(source).not.toContain(absent)
    })
  }

  it('플러그인 디렉토리 이름과 스킬 네임스페이스가 슬러그다 (D-015)', () => {
    const source = read('src', 'main', 'adapters', 'claude-plugin.ts')
    expect(source).toContain('export const ORCA_PLUGIN_NAME = PRODUCT_SLUG')
    // sourceKind enum 은 코드 식별자라 불변이다 (D-012).
    expect(source).toContain("skill.sourceKind === 'orca'")
  })
})

// ── ⑤ 코드 식별자 불변 — §10 EP-11 / D-012 ────────────────────────────────────
describe('코드 식별자 불변 (EP-11)', () => {
  const ipc = read('src', 'shared', 'ipc.ts')

  it('IPC 채널 접두가 그대로 `orca:` 이고 개수가 생성물과 일치한다', () => {
    const channels = new Set(
      (ipc.match(/'orca:[a-zA-Z0-9:._-]+'/g) ?? []).map((raw) => raw.slice(1, -1))
    )
    expect(channels.size).toBeGreaterThan(0)
    const inventory = readFileSync(join(REPO_ROOT, 'docs', 'generated', 'inventory.md'), 'utf8')
    const recorded = /\| IPC 채널 \| \*\*(\d+)\*\* \|/.exec(inventory)?.[1]
    expect(Number(recorded)).toBe(channels.size)
  })

  it('sourceKind enum 과 프롬프트 sentinel 4군이 그대로다', () => {
    expect(read('src', 'main', 'features', 'extensions', 'skills', 'scan.ts')).toContain(
      "sourceKind: 'orca' | 'adapter' | 'workspace'"
    )
    const protocolAndShared = walk(join(APP_ROOT, 'src'), PROD_SOURCE)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    for (const sentinel of [
      'ORCA_ATTACHMENT_START',
      'ORCA_DIFF_REQUIREMENT_START',
      'ORCA_PLAN_COMMENT_START',
      'ORCA_PLAN_FEEDBACK_START'
    ]) {
      expect(protocolAndShared).toContain(sentinel)
    }
  })

  it('레거시 슬러그 상수가 옛 이름을 그대로 갖는다 — 이관의 source 가 여기서 나온다', () => {
    expect(LEGACY_PRODUCT_SLUG).toBe('orca')
  })
})

// ── ⑥ 운영 문서 — §10 EP-12 ───────────────────────────────────────────────────
describe('운영 문서 (EP-12)', () => {
  const doc = readFileSync(join(REPO_ROOT, 'docs', 'guides', 'release-operations.md'), 'utf8')

  it('새 산출물명과 새 데이터 경로를 서술한다', () => {
    expect(doc).toContain(`${PRODUCT_SLUG}-`)
    expect(doc).toContain(`%APPDATA%/${PRODUCT_SLUG}`)
    expect(doc).not.toContain('%APPDATA%/orca/')
  })

  it('구버전 수동 제거 절차 문단을 갖는다 (D-013)', () => {
    expect(doc).toContain('## 구버전(orca) 수동 제거')
  })
})

// ── ⑦ 이관 배선 — §10 EP-07 · EP-06 · EP-08 의 **호출부** ─────────────────────
// 단위(`migrationBlocksBoot`·`rebaseStoredPaths`·`repairMovedWorktrees`)는 각자의 스위트가
// 잠근다. 여기서 잠그는 것은 **그것을 부르는 줄** 이다 — 배선을 지운 회귀는 단위 테스트를
// 전건 통과한 채로 지나간다. 이 환경에서는 electron 바이너리가 없어 `Bootstrap` 을 실행할 수
// 없으므로 소스 순서로 본다(구조적 proxy).
describe('이관 배선 (EP-06 · EP-07 · EP-08)', () => {
  const index = read('src', 'main', 'index.ts')
  const bootstrap = read('src', 'main', 'app', 'bootstrap.ts')

  it('index.ts 가 이관을 startup sequence 로 부르고 결과를 Bootstrap 에 넘긴다', () => {
    expect(index).toContain('runStartupSequence({')
    expect(index).toContain('migrateLegacy: () =>')
    expect(index).toContain('migrateLegacyRoots({')
    // 결과를 넘기지 않으면 부팅 차단 게이트가 영원히 no-op 이다.
    expect(index).toMatch(/new Bootstrap\([\s\S]*?legacyMigration\s*\)/)
  })

  it('부팅 차단 게이트가 critical 이고 DB 오픈보다 앞에 있다 (D-018)', () => {
    const gate = bootstrap.indexOf("'legacy-migration'")
    const dbInit = bootstrap.indexOf("'db-init'")
    expect(gate).toBeGreaterThan(-1)
    expect(dbInit).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(dbInit)
    // **이 단계 자신의 옵션** 을 본다. `gate`~`dbInit` 구간을 통째로 훑으면 그 사이의 다른
    // critical 단계가 대신 통과시켜 강등을 놓친다(실측: MUT-K 가 그렇게 새어 나갔다).
    expect(bootstrap).toMatch(/'legacy-migration',\s*\{ critical: true,/)
    expect(bootstrap.slice(gate, dbInit)).toContain('migrationBlocksBoot(this.legacyMigration)')
  })

  it('rebase·repair 단계가 DB 오픈 뒤·핸들러 등록 앞에 있다', () => {
    const dbInit = bootstrap.indexOf("'db-init'")
    const step = bootstrap.indexOf("'legacy-paths'")
    const handlers = bootstrap.indexOf('registerChatHandlers({')
    expect(step).toBeGreaterThan(dbInit)
    expect(step).toBeLessThan(handlers)
    const body = bootstrap.slice(step, handlers)
    expect(body).toContain('rebaseStoredPaths(connection, legacy, current)')
    expect(body).toContain('repairMovedWorktrees(')
  })
})
