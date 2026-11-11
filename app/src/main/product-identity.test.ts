// 제품 식별자 계약(0225 · 0306) — 이름의 SSOT 와 그 사본들이 어긋나지 않는지 본다.
//
// 옛 이름 리터럴은 이 파일에 직접 적지 않는다 — 슬러그의 마지막 마디에서 만든다. 옛 표기
// 재유입은 `scripts/check-product-naming.mjs` 가 트리 전체에서 막는다(0306 D-007).
//
// 여기서만 할 수 있는 단언이 셋이다.
//   ① 빌드 설정 2개 파일(`package.json`·`electron-builder.yml`)은 코드에서 import 할 수 없어
//      값을 복제한다. 파일을 파싱해 SSOT 와 대조하는 것이 그 사본을 검증된 사본으로 만든다.
//   ② 표시명·옛 저장 경로의 **전수 스윕**은 파일 트리를 읽어야 성립한다.
//   ③ 모듈 사설 상수(store name·마커)는 electron 을 물어 import 할 수 없다 — 소스 텍스트로 본다.
//      구조적 proxy 이므로 각 단언은 "새 표기가 있다" 와 "옛 리터럴이 없다" 를 **함께** 본다.

import { readFileSync, readdirSync } from 'node:fs'
import { join, posix, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_USER_MODEL_ID, PRODUCT_DISPLAY_NAME, PRODUCT_SLUG } from '../shared/product'

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

// 옛 표기 — 음성 단언의 재료. 옛 이름은 새 슬러그의 마지막 마디다(리터럴로 적으면 이름
// 검사기에 걸린다).
const OLD = PRODUCT_SLUG.split('-')[1]
const OLD_TITLE = OLD[0].toUpperCase() + OLD.slice(1)

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
    expect(builder).not.toContain(`com.${OLD}.app`)
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
    expect(source).not.toContain(`com.${OLD}.app`)
  })
})

// ── ② 화면 표시명 — §10 EP-04 (31지점) ────────────────────────────────────────
describe('표시명 (EP-04)', () => {
  const RENDERER = join(APP_ROOT, 'src', 'renderer')
  // 불변식의 **주어** — 홀로 선 옛 제품명 단어. 새 표기 `Orcinus orca` 는 뒤 단어가 소문자라
  // 걸리지 않는다.
  const SUBJECT = new RegExp(`\\b${OLD_TITLE}\\b`)

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
      ['src', 'renderer', 'src', 'shared', 'ui', 'OoLogo.tsx'],
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

  // main 의 옛 표기 전수 스윕은 이름 검사기가 한다(0306). 여기서는 사용자 대면 7지점이 SSOT 를
  // 참조하는지를 양성 단언으로 잠근다.
  it('main 의 사용자 대면 문구 7지점이 SSOT 파생이다', () => {
    const sites: [string[], string][] = [
      [['src', 'main', 'app', 'bootstrap.ts'], '`${PRODUCT_DISPLAY_NAME} 스킬`'],
      [['src', 'main', 'app', 'bootstrap.ts'], '`${PRODUCT_DISPLAY_NAME} 설정 디렉터리 보장`'],
      [['src', 'main', 'app', 'bootstrap.ts'], '`${PRODUCT_SLUG}.json 로드`'],
      [
        ['src', 'main', 'features', 'extensions', 'claude', 'deployer.ts'],
        '`${PRODUCT_DISPLAY_NAME} 스킬`'
      ],
      [
        ['src', 'main', 'app', 'handlers', 'skills.ts'],
        '`${PRODUCT_DISPLAY_NAME} 스킬만 제거할 수 있습니다.`'
      ],
      [
        ['src', 'main', 'features', 'extensions', 'common', 'skills', 'sources.ts'],
        '`${PRODUCT_DISPLAY_NAME} 스킬 sources 안의 항목만 제거할 수 있습니다.`'
      ],
      [
        ['src', 'main', 'features', 'extensions', 'claude', 'plugin.ts'],
        '`${PRODUCT_DISPLAY_NAME}에서 구성된 skill 및 mcp`'
      ]
    ]
    for (const [parts, expected] of sites) {
      const source = read(...parts)
      expect(source, relative(join(APP_ROOT, ...parts))).toContain(expected)
    }
    expect(read('src', 'main', 'app', 'bootstrap.ts')).not.toContain(`'${OLD_TITLE} `)
    expect(read('src', 'main', 'features', 'extensions', 'claude', 'deployer.ts')).not.toContain(
      `'${OLD_TITLE} `
    )
    expect(read('src', 'main', 'app', 'bootstrap.ts')).not.toContain(`'${OLD}.json 로드'`)
  })
})

// ── ③ 옛 저장 경로 — 0308 EP-01 ───────────────────────────────────────────────
// 앱은 옛 이름 폴더를 읽지도 옮기지도 않는다(0308 D-002). 이관이 쓰던 심볼이 prod 소스에
// 되살아나면 그것이 곧 옛 경로를 다시 조립하는 코드다.
describe('옛 저장 경로 (0308 EP-01)', () => {
  const MIGRATION_SYMBOLS = new RegExp(
    [
      'migrate' + 'Legacy',
      'migration' + 'BlocksBoot',
      'Migration' + 'Report',
      'legacy' + 'Migration',
      'rebase' + 'StoredPaths',
      'repair' + 'MovedWorktrees',
      'rebase' + 'UnderRoot',
      'run' + 'StartupSequence',
      'legacy' + 'ConfigDir',
      'legacy' + 'UserDataDir',
      'LEGACY_' + 'PRODUCT_SLUG',
      'repair' + 'Worktree',
      'get' + 'DbConnection'
    ].join('|')
  )

  it('prod 소스에 이관 심볼이 없다 (음성 스윕)', () => {
    const files = walk(join(APP_ROOT, 'src'), PROD_SOURCE)
      .filter((file) => MIGRATION_SYMBOLS.test(readFileSync(file, 'utf8')))
      .map(relative)
    expect(files).toEqual([])
  })

  it('진입점이 로깅을 첫 배선으로 초기화한다 (양성 — 스윕이 보는 파일이 실제 진입점이다)', () => {
    const index = read('src', 'main', 'index.ts')
    const log = index.indexOf('= initLog()')
    expect(log).toBeGreaterThan(-1)
    expect(log).toBeLessThan(index.indexOf('installErrorReportSink()'))
    expect(index).toMatch(/new Bootstrap\(\s*createArtifactSenderCheck\([^;]*?\)\s*\)\n/)
  })

  it('부팅 단계가 DB 초기화 → 미완료 도구 호출 복구 → 핸들러 등록 순서이고 이관 단계가 없다', () => {
    const bootstrap = read('src', 'main', 'app', 'bootstrap.ts')
    const dbInit = bootstrap.indexOf("'db-init'")
    const recovery = bootstrap.indexOf("'chat-recovery'")
    const handlers = bootstrap.indexOf('registerChatHandlers({')
    expect(dbInit).toBeGreaterThan(-1)
    expect(recovery).toBeGreaterThan(dbInit)
    expect(handlers).toBeGreaterThan(recovery)
    expect(bootstrap).toMatch(/'db-init', \{ critical: true,/)
    expect(bootstrap).toMatch(/'chat-recovery',\s*\{ critical: true,/)
    expect(bootstrap).not.toContain("'legacy-" + "migration'")
    expect(bootstrap).not.toContain("'legacy-" + "paths'")
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
      `'${OLD}-settings'`
    ],
    [
      'secret-store',
      ['src', 'main', 'infra', 'config', 'secret-store.ts'],
      '`${PRODUCT_SLUG}-secrets`',
      `'${OLD}-secrets'`
    ],
    [
      'provider grants',
      ['src', 'main', 'features', 'auth', 'store-file.ts'],
      '`${PRODUCT_SLUG}-provider-grants`',
      `'${OLD}-provider-grants'`
    ],
    [
      'provider oauth',
      ['src', 'main', 'features', 'auth', 'store-file.ts'],
      '`${PRODUCT_SLUG}-provider-oauth`',
      `'${OLD}-provider-oauth'`
    ],
    [
      'deploy marker',
      ['src', 'main', 'features', 'extensions', 'claude', 'deployer.ts'],
      '`.${PRODUCT_SLUG}-deploy.json`',
      `'.${OLD}-deploy.json'`
    ],
    [
      'seed marker',
      ['src', 'main', 'features', 'extensions', 'common', 'skills', 'seed.ts'],
      '`.${PRODUCT_SLUG}-builtin.json`',
      `'.${OLD}-builtin.json'`
    ],
    ['db 파일', ['src', 'main', 'infra', 'db', 'index.ts'], '`${PRODUCT_SLUG}.db`', `'${OLD}.db'`],
    [
      'db 백업',
      ['src', 'main', 'infra', 'db', 'migrate.ts'],
      '`${PRODUCT_SLUG}.db.backup.before-',
      `'${OLD}.db.backup`
    ],
    [
      '로그 디렉토리',
      ['src', 'main', 'infra', 'log', 'index.ts'],
      "join(ooConfigDir(), 'logs')",
      `'.config', '${OLD}'`
    ],
    [
      'artifacts 루트',
      ['src', 'main', 'app', 'bootstrap.ts'],
      "join(ooConfigDir(), 'artifacts'",
      `'.config', '${OLD}'`
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
    const source = read('src', 'main', 'adapters', 'claude', 'plugin.ts')
    expect(source).toContain('export const OO_PLUGIN_NAME = PRODUCT_SLUG')
    expect(source).toContain("skill.sourceKind === 'orcinus-orca'")
  })
})

// ── ⑤ 이름 규칙 — 0306 §10 EP-02 · EP-03 · EP-06 · EP-07 ──────────────────────
// 0225 는 코드 식별자를 그대로 두기로 했고(D-012) 0306 이 그 결정을 뒤집었다. 옛 표기가 없다는 것은
// 이름 검사기가 보고, 여기서는 규칙 N1~N4 의 대표 자리가 **새 꼴로 있다**는 것을 본다 — 자리를 통째로
// 지우면 검사기는 green 이지만 이 블록이 red 다.
describe('이름 규칙 (0306)', () => {
  const ipc = read('src', 'shared', 'ipc.ts')
  const VALUE_PREFIX = PRODUCT_SLUG.toUpperCase().replace('-', '_')

  it('preload 가 전역 키 `oo` 로 API 를 노출하고 타입 선언이 같은 이름을 쓴다 (N3)', () => {
    expect(read('src', 'preload', 'index.ts')).toContain("exposeInMainWorld('oo', oo)")
    expect(read('src', 'preload', 'index.d.ts')).toContain('oo: OoApi')
  })

  it('IPC 채널이 전부 `oo:` 접두사이고 개수가 생성물과 일치한다 (N4)', () => {
    const channels = new Set(
      (ipc.match(/'oo:[a-zA-Z0-9:._-]+'/g) ?? []).map((raw) => raw.slice(1, -1))
    )
    expect(channels.size).toBeGreaterThan(0)
    const inventory = readFileSync(join(REPO_ROOT, 'docs', 'generated', 'inventory.md'), 'utf8')
    const recorded = /\| IPC 채널 \| \*\*(\d+)\*\* \|/.exec(inventory)?.[1]
    expect(Number(recorded)).toBe(channels.size)
    // CHANNELS 의 값은 전부 채널이다 — 다른 접두사를 가진 값이 섞이면 수가 어긋난다.
    const values = ipc.slice(ipc.indexOf('export const CHANNELS'), ipc.indexOf('} as const'))
    expect((values.match(/: '[^']+'/g) ?? []).length).toBe(channels.size)
  })

  it('프롬프트 표식 4군이 긴 꼴 접두사를 쓴다 (N2)', () => {
    expect(VALUE_PREFIX).toBe('ORCINUS_ORCA')
    const sources = walk(join(APP_ROOT, 'src'), PROD_SOURCE)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    for (const sentinel of [
      'ATTACHMENT_START',
      'DIFF_REQUIREMENT_START',
      'PLAN_COMMENT_START',
      'PLAN_FEEDBACK_START'
    ]) {
      expect(sources).toContain(`'${VALUE_PREFIX}_${sentinel}'`)
    }
  })

  it('출처 값이 슬러그다 — 생산 타입과 스캔 타입이 같은 유니온을 쓴다 (N2)', () => {
    const union = `sourceKind: '${PRODUCT_SLUG}' | 'adapter' | 'workspace'`
    expect(read('src', 'main', 'features', 'extensions', 'common', 'skills', 'scan.ts')).toContain(
      union
    )
    expect(ipc).toContain(union)
  })

  it('스킬 출처를 만드는 두 자리가 id 와 kind 를 슬러그로 낸다 (N2 — 소비 쪽 비교값과 같은 문자열)', () => {
    // `sourceId` 는 `string` 이라 타입 검사가 생산·소비의 어긋남을 못 본다. 설정 `skillEnabled` 의
    // 키 접두사이기도 하다(`skillEnabledKey`).
    for (const parts of [
      ['src', 'main', 'app', 'bootstrap.ts'],
      ['src', 'main', 'features', 'extensions', 'claude', 'deployer.ts']
    ]) {
      const source = read(...parts)
      expect(source, parts.at(-1)).toContain(`sourceId: '${PRODUCT_SLUG}',`)
      expect(source, parts.at(-1)).toContain(`sourceKind: '${PRODUCT_SLUG}',`)
    }
    expect(
      read('src', 'renderer', 'src', 'features', 'chat', 'lib', 'attachMenuModel.ts')
    ).toContain(`skill.sourceId === '${PRODUCT_SLUG}'`)
  })

  it('OpenCode 관리 MCP alias 가 snake 꼴 제품 접두사로 시작한다 (N2)', () => {
    const prefix = PRODUCT_SLUG.replace('-', '_')
    expect(read('src', 'main', 'adapters', 'opencode', 'v1', 'managed-mcp.ts')).toContain(
      `return \`${prefix}_\${kind === 'builtin' ? 'b' : 'u'}_`
    )
  })

  it('모델에 보내는 시스템 머리글이 표시명 SSOT 파생이다 (N1)', () => {
    const header = read('src', 'main', 'features', 'extensions', 'common', 'system-header.ts')
    expect(header).toContain('`# ${PRODUCT_DISPLAY_NAME}\\n')
    expect(header).toContain('${PRODUCT_DISPLAY_NAME} version: ')
  })

  // 현재 문서 — `docs/` 에서 지난 기록(0306 D-003)을 뺀 것과 에이전트 가이드. 일괄 치환은 문서 속
  // 코드 이름 인용을 긴 꼴로 바꾸기 쉽고, 그 결과는 옛 표기가 아니라 이름 검사기를 통과한다.
  const PAST_RECORDS = ['handoff', 'archive', 'decisions', 'etc'].map(
    (dir) => join(REPO_ROOT, 'docs', dir) + sep
  )
  const currentDocs = [
    ...walk(
      join(REPO_ROOT, 'docs'),
      (file) => file.endsWith('.md') && !PAST_RECORDS.some((dir) => file.startsWith(dir))
    ),
    join(REPO_ROOT, 'AGENTS.md'),
    join(APP_ROOT, 'AGENTS.md'),
    join(APP_ROOT, 'src', 'main', 'AGENTS.md'),
    join(APP_ROOT, 'src', 'renderer', 'AGENTS.md')
  ].map((file) => ({ file, text: readFileSync(file, 'utf8') }))

  it('현재 문서가 인용하는 preload 노출 키가 코드의 실제 키와 같다 (EP-10)', () => {
    const actual = /exposeInMainWorld\('([^']+)'/.exec(read('src', 'preload', 'index.ts'))?.[1]
    expect(actual).toBe('oo')
    const quoted = currentDocs.flatMap(({ file, text }) =>
      [...text.matchAll(/exposeInMainWorld\('([^']*)'/g)].map((match) => ({ file, key: match[1] }))
    )
    expect(quoted.length).toBeGreaterThanOrEqual(1)
    expect(quoted.filter(({ key }) => key !== actual)).toEqual([])
  })

  it('현재 문서에 슬러그를 접두사로 쓴 채널 꼴이 없다 — 채널 접두사는 `oo:` 다 (EP-10 · N4)', () => {
    const channelShape = new RegExp(`${PRODUCT_SLUG}:[a-zA-Z*{]+`, 'g')
    const found = currentDocs.flatMap(({ file, text }) =>
      (text.match(channelShape) ?? []).map((shape) => `${file}: ${shape}`)
    )
    expect(found).toEqual([])
  })
})

// ── ⑥ 운영 문서 — §10 EP-12 ───────────────────────────────────────────────────
describe('운영 문서 (EP-12)', () => {
  const doc = readFileSync(join(REPO_ROOT, 'docs', 'guides', 'release-operations.md'), 'utf8')

  it('새 산출물명과 새 데이터 경로를 서술한다', () => {
    expect(doc).toContain(`${PRODUCT_SLUG}-`)
    expect(doc).toContain(`%APPDATA%/${PRODUCT_SLUG}`)
    expect(doc).not.toContain(`%APPDATA%/${OLD}/`)
  })

  it('구버전 수동 제거 절차 문단을 갖는다 (D-013)', () => {
    expect(doc).toContain(`## 구버전(${OLD}) 수동 제거`)
  })

  it('자동 이관을 약속하지 않고 수동 이전 절을 갖는다 (0308 AC5)', () => {
    expect(doc).toContain('### 데이터 수동 이전')
    expect(doc).not.toContain('최초 실행이 새 자리로 옮기')
    expect(doc).toContain('자동으로 옮기지 않는다')
  })

  it('수동 이전이 옛 이름 → 새 이름 대응 7개를 적는다 (0308 AC5 — DB 3종 · store 4종)', () => {
    const renamed = [
      '.db',
      '.db-wal',
      '.db-shm',
      '-settings.json',
      '-secrets.json',
      '-provider-grants.json',
      '-provider-oauth.json'
    ]
    for (const suffix of renamed) {
      expect(doc).toContain(`\`${OLD}${suffix}\` → \`${PRODUCT_SLUG}${suffix}\``)
    }
  })

  it('저장소 Variables 의 새 이름 3개를 안내한다 (0306 AC7)', () => {
    const prefix = PRODUCT_SLUG.toUpperCase().replace('-', '_')
    for (const name of ['CI_TIMEOUT_MINUTES', 'RELEASE_TIMEOUT_MINUTES', 'TEST_TIME_SCALE']) {
      expect(doc).toContain(`\`${prefix}_${name}\``)
    }
  })
})
