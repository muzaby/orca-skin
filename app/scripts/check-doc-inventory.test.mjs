import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

import {
  parseChannels,
  parseTopLevelKeys,
  parseUnionMembers,
  countInventory,
  renderInventory,
  scanProseText,
  scanProse,
  isExcluded,
  isHistoricalHandoff,
  parseRelativeLinks,
  checkLinks,
  runCli,
  normalizeEol,
  PROSE_EXCLUDED
} from './check-doc-inventory.mjs'

/** 임시 저장소 골격을 만든다. 반환값의 `appDir`/`rootDir` 는 실제 저장소와 같은 배치다. */
function makeFixture(files) {
  const rootDir = mkdtempSync(join(tmpdir(), 'doc-inventory-'))
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(rootDir, relPath)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return {
    rootDir,
    appDir: join(rootDir, 'app'),
    cleanup: () => rmSync(rootDir, { recursive: true, force: true })
  }
}

const IPC_STUB = `
export const CHANNELS = {
  CHAT_SEND: 'orca:chat:send',
  CHAT_EVENT: 'orca:chat:event',
  SESSION_LIST: 'orca:session:list'
} as const

export type NormalizedEvent =
  | { type: 'message.delta'; sessionId: string }
  | {
      type: 'message.completed'
      sessionId: string
      payload: { type: 'nested-should-not-count'; value: number }
    }
  | ChatActivitySnapshot

export type Other = string
`

const PROTOCOL_STUB = `
export const SettingsSchema = z.object({
  theme: z.enum(['white', 'dark']),
  nested: z.object({ shouldNotCount: z.string(), norThis: z.number() }),
  language: z.string()
})

export const SettingsPatchSchema = z.object({ theme: z.string() })
`

function fullFixture(extra = {}) {
  return makeFixture({
    'app/src/shared/ipc.ts': IPC_STUB,
    'app/src/shared/protocol.ts': PROTOCOL_STUB,
    'app/src/main/features/chat/index.ts': '',
    'app/src/main/features/sessions/index.ts': '',
    'app/src/main/contracts/turn.ts': '',
    'app/src/main/contracts/turn.test.ts': '',
    'app/src/main/app/handlers/boot.ts': '',
    'app/src/main/infra/db/migrations/0001_initial.sql': '',
    'app/src/renderer/src/features/chat/index.ts': '',
    ...extra
  })
}

describe('파서', () => {
  test('채널과 도메인 분포를 뽑는다', () => {
    const { channels, domains } = parseChannels(IPC_STUB)
    assert.deepEqual(channels, ['orca:chat:event', 'orca:chat:send', 'orca:session:list'])
    assert.deepEqual(domains, [
      ['chat', 2],
      ['session', 1]
    ])
  })

  test('중첩 오브젝트의 키는 settings 키로 세지 않는다', () => {
    const keys = parseTopLevelKeys(PROTOCOL_STUB, 'export const SettingsSchema = z.object(')
    assert.deepEqual(keys, ['theme', 'nested', 'language'])
    assert.ok(!keys.includes('shouldNotCount'), '중첩 키가 새면 수치가 조용히 부풀려진다')
  })

  test('union 은 인라인 멤버와 참조 멤버를 모두 센다', () => {
    const union = parseUnionMembers(IPC_STUB, 'export type NormalizedEvent =')
    assert.deepEqual(union.inline, ['message.delta', 'message.completed'])
    assert.deepEqual(union.referenced, ['ChatActivitySnapshot'])
    assert.equal(union.total, 3)
  })

  test('union 파싱이 다음 export 에서 멈춘다', () => {
    const union = parseUnionMembers(IPC_STUB, 'export type NormalizedEvent =')
    assert.ok(!union.referenced.includes('Other'))
  })
})

describe('인벤토리 집계', () => {
  test('9개 항목을 코드에서 센다', () => {
    const fx = fullFixture()
    try {
      const inventory = countInventory(fx.appDir)
      assert.equal(inventory.ipcChannels.count, 3)
      assert.equal(inventory.ipcDomains.count, 2)
      assert.equal(inventory.normalizedEventVariants.count, 3)
      assert.equal(inventory.settingsKeys.count, 3)
      assert.equal(inventory.mainSlices.count, 2)
      assert.equal(inventory.contractModules.count, 1, '.test.ts 는 모듈이 아니다')
      assert.equal(inventory.ipcHandlers.count, 1)
      assert.equal(inventory.migrations.count, 1)
      assert.equal(inventory.rendererFeatures.count, 1)
    } finally {
      fx.cleanup()
    }
  })

  test('생성 결과가 9개 항목과 정본 경로를 담는다', () => {
    const fx = fullFixture()
    try {
      const rendered = renderInventory(countInventory(fx.appDir))
      for (const label of [
        'IPC 채널',
        'IPC 도메인',
        'NormalizedEvent variant',
        'settings 키',
        'main 수직 슬라이스',
        'main contracts 모듈',
        'IPC 핸들러',
        'DB 마이그레이션',
        'renderer feature'
      ]) {
        assert.ok(rendered.includes(label), `${label} 행이 없다`)
      }
      assert.ok(rendered.includes('`app/src/shared/ipc.ts`'), '정본 경로가 없다')
      assert.ok(rendered.includes('직접 편집 금지'), '생성물 헤더가 없다')
    } finally {
      fx.cleanup()
    }
  })
})

describe('프로즈 스캐너', () => {
  test('인벤토리 수치 서술을 잡는다', () => {
    const hits = scanProseText(
      [
        '총 76 채널 · 22 도메인이다.',
        '슬라이스 11종으로 구성된다.',
        'contracts 7모듈을 공유한다.',
        'electron-store 영속화(18 키)',
        '마이그레이션 16종',
        'NormalizedEvent variant 21종',
        '`handlers/*`(도메인 IPC **13종** — boot·cost·engine)', // app/AGENTS.md:50 실물

        '채널 **77 → 76**, contracts **7→5모듈**, IPC **82 → 71 채널**' // 실물 3형태
      ].join('\n')
    )
    const ids = new Set(hits.map((hit) => hit.id))
    for (const id of [
      'ipcChannels',
      'ipcDomains',
      'mainSlices',
      'contractModules',
      'settingsKeys',
      'migrations',
      'normalizedEventVariants',
      'ipcHandlers',
      'transition'
    ]) {
      assert.ok(ids.has(id), `${id} 패턴이 잡히지 않았다`)
    }
  })

  test('정본 링크로 바꾼 문장은 잡지 않는다', () => {
    const hits = scanProseText(
      [
        '채널 수의 정본은 `app/src/shared/ipc.ts` 다 — 수치는 docs/generated/inventory.md 참조.',
        '슬라이스 매핑의 정본은 `app/src/main/AGENTS.md`.',
        '`0181` 에서 provider 축을 세웠다.',
        '키보드 단축키 3개를 지원한다.'
      ].join('\n')
    )
    assert.deepEqual(hits, [], `오탐: ${JSON.stringify(hits)}`)
  })

  test('맨숫자는 잡지 않는다 — 단위가 붙은 서술만 본다', () => {
    assert.deepEqual(scanProseText('76 과 9 와 21 은 숫자일 뿐이다.'), [])
  })
})

describe('제외 경로 (P30 방어)', () => {
  // 0177 의 실패 패턴 P30: 음성 grep 게이트가 이력을 배제하지 않으면 "게이트 통과" 가 문서를
  // 손상시킨다. 과거 사실로서의 수치는 보존 대상이므로 제외가 실제로 작동해야 한다.
  test('이력·생성물·외부 미러를 제외한다', () => {
    for (const path of [
      join('docs', 'archive', 'PHASES.md'),
      join('docs', 'generated', 'inventory.md'),
      join('docs', 'handoff', '0177-docs-agents-sync', 'plan.md'),
      join('docs', 'etc', 'study', 'opencode', '04-core-modules.md'),
      join('docs', 'spec', 'claude', 'headless.md'),
      join('.agents', 'skills', 'handoff-plan', 'references', 'failure-patterns.md'),
      join('chats', 'AGENTS.md')
    ]) {
      assert.ok(isExcluded(path), `${path} 가 제외되지 않았다`)
    }
  })

  test('current-state 문서는 제외하지 않는다', () => {
    for (const path of [
      join('docs', 'AGENTS.md'),
      join('docs', 'arch', 'backend', 'overview.md'),
      join('docs', 'IPC_CONTRACT.md'),
      'AGENTS.md',
      join('app', 'AGENTS.md')
    ]) {
      assert.ok(!isExcluded(path), `${path} 가 잘못 제외됐다`)
    }
  })

  test('제외 디렉토리 안의 수치는 스캔 결과에 나오지 않는다', () => {
    const fx = makeFixture({
      'docs/archive/PHASES.md': '총 86 채널 · 슬라이스 11종이었다.',
      'docs/AGENTS.md': '총 76 채널이다.'
    })
    try {
      const findings = scanProse(fx.rootDir, PROSE_EXCLUDED)
      assert.equal(findings.length, 1)
      assert.equal(findings[0].file, join('docs', 'AGENTS.md'))
    } finally {
      fx.cleanup()
    }
  })
})

describe('링크 체커', () => {
  test('사이트 절대경로와 외부 URL 은 상대링크가 아니다', () => {
    const links = parseRelativeLinks(
      '[a](./real.md) [b](/ko/agent-sdk/hooks) [c](https://x.dev) [d](#anchor) [e](../up.md#frag)'
    )
    assert.deepEqual(links, ['./real.md', '../up.md'])
  })

  test('과거 핸드오프는 링크 검사 대상이 아니다', () => {
    assert.ok(isHistoricalHandoff(join('docs', 'handoff', '0031-skills-mcp-wiring', 'plan.md')))
    assert.ok(!isHistoricalHandoff(join('docs', 'handoff', 'INDEX.md')))
    assert.ok(!isHistoricalHandoff(join('docs', 'handoff', 'AGENTS.md')))
  })

  test('살아 있는 문서의 파손 링크를 잡는다', () => {
    const fx = makeFixture({
      'docs/AGENTS.md': '[있음](./INDEX.md) · [없음](./gone.md)',
      'docs/INDEX.md': '# index',
      'docs/handoff/0001-old/plan.md': '[옛경로](./moved-away.md)'
    })
    try {
      const broken = checkLinks(fx.rootDir)
      assert.equal(broken.length, 1, `과거 핸드오프까지 잡으면 안 된다: ${JSON.stringify(broken)}`)
      assert.equal(broken[0].target, './gone.md')
    } finally {
      fx.cleanup()
    }
  })
})

describe('CLI', () => {
  test('생성 후 --check 가 통과한다', () => {
    const fx = fullFixture({ 'docs/AGENTS.md': '수치는 생성물이 갖는다.' })
    try {
      assert.equal(runCli([], fx.appDir), 0)
      assert.equal(runCli(['--check'], fx.appDir), 0)
    } finally {
      fx.cleanup()
    }
  })

  test('슬라이스 추가 시 --check 가 실패한다', () => {
    // 재발 방지가 *실제로 작동함*을 양성 단언한다 — 코드가 바뀌면 게이트가 반드시 걸려야 한다.
    const fx = fullFixture({ 'docs/AGENTS.md': '수치는 생성물이 갖는다.' })
    try {
      assert.equal(runCli([], fx.appDir), 0)
      mkdirSync(join(fx.appDir, 'src', 'main', 'features', 'newslice'), { recursive: true })
      assert.equal(runCli(['--check'], fx.appDir), 1, '코드가 앞서가면 게이트가 걸려야 한다')
    } finally {
      fx.cleanup()
    }
  })

  test('CRLF 체크아웃에서도 --check 가 통과한다', () => {
    // CI 는 windows-latest 이고 .gitattributes 가 없어 체크아웃이 CRLF 일 수 있다.
    const fx = fullFixture({ 'docs/AGENTS.md': '수치는 생성물이 갖는다.' })
    try {
      assert.equal(runCli([], fx.appDir), 0)
      const generated = join(fx.rootDir, 'docs', 'generated', 'inventory.md')
      const lf = readFileSync(generated, 'utf8')
      writeFileSync(generated, lf.replace(/\n/g, '\r\n'), 'utf8')
      assert.equal(runCli(['--check'], fx.appDir), 0, 'CRLF 로 게이트가 깨지면 안 된다')
      assert.equal(normalizeEol('a\r\nb'), 'a\nb')
    } finally {
      fx.cleanup()
    }
  })

  test('생성물을 손편집하면 --check 가 실패한다', () => {
    const fx = fullFixture({ 'docs/AGENTS.md': '수치는 생성물이 갖는다.' })
    try {
      assert.equal(runCli([], fx.appDir), 0)
      writeFileSync(join(fx.rootDir, 'docs', 'generated', 'inventory.md'), '# 손편집\n', 'utf8')
      assert.equal(runCli(['--check'], fx.appDir), 1)
    } finally {
      fx.cleanup()
    }
  })

  test('본문에 수치 서술이 남아 있으면 --check 가 실패한다', () => {
    const fx = fullFixture({ 'docs/AGENTS.md': '총 76 채널이다.' })
    try {
      assert.equal(runCli([], fx.appDir), 0)
      assert.equal(runCli(['--check'], fx.appDir), 1)
    } finally {
      fx.cleanup()
    }
  })

  test('링크가 깨지면 --check 가 실패한다', () => {
    const fx = fullFixture({ 'docs/AGENTS.md': '[없음](./gone.md)' })
    try {
      assert.equal(runCli([], fx.appDir), 0)
      assert.equal(runCli(['--check'], fx.appDir), 1)
    } finally {
      fx.cleanup()
    }
  })
})

// 0212 — **CLI 로 실행됐을 때 본문이 실제로 도는지.** 이 스위트의 나머지는 함수를 직접 import
// 해 테스트하므로 진입 가드를 한 번도 지나지 않았고, 그래서 가드가 깨진 것을 아무도 몰랐다.
//
// 깨진 형태: `import.meta.url === \`file://${process.argv[1]}\``. Windows 의 argv[1] 은
// `C:\a\b.mjs` 라 `file://C:\a\b.mjs` 가 되고 `import.meta.url` 은 `file:///C:/a/b.mjs` 다 —
// 절대 같지 않으므로 **본문이 실행되지 않은 채 exit 0** 이 나가고 게이트가 무음으로 통과한다.
// CI 는 windows-latest 이므로 이 게이트는 그 형태로는 한 번도 돈 적이 없다.
describe('CLI 진입 가드 (0212)', () => {
  const SCRIPTS = [
    'check-doc-inventory.mjs',
    'check-migrations-appendonly.mjs',
    'validate-release-version.mjs',
    'validate-dist.mjs',
    'ensure-sqlite-abi.mjs'
  ]

  test('스크립트를 직접 실행하면 CLI 본문이 돈다 — 무음 exit 0 이 아니다', () => {
    const appDir = join(import.meta.dirname, '..')
    for (const name of SCRIPTS) {
      const run = spawnSync(process.execPath, [join('scripts', name), '--check'], {
        cwd: appDir,
        encoding: 'utf8'
      })
      const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
      // 본문이 돌면 무엇이든 말한다(성공 로그·실패 사유·usage). 아무 말도 없으면 가드가
      // 막은 것이다 — 그 상태의 exit code 는 검증의 증거가 아니다.
      assert.ok(
        output.trim().length > 0,
        `${name}: CLI 가 아무것도 출력하지 않았다 — 진입 가드가 본문을 막았을 수 있다`
      )
    }
  })

  test('모듈로 import 하면 CLI 본문이 돌지 않는다 — 양성 짝', () => {
    const appDir = join(import.meta.dirname, '..')
    const run = spawnSync(
      process.execPath,
      ['-e', "import('./scripts/check-doc-inventory.mjs').then(() => process.exit(0))"],
      { cwd: appDir, encoding: 'utf8' }
    )
    // import 만으로는 게이트가 돌지 않아야 한다(부작용 없는 모듈). 출력이 비어 있는 것이 정상.
    assert.equal(run.status, 0)
    assert.equal(`${run.stdout ?? ''}${run.stderr ?? ''}`.trim(), '')
  })
})
