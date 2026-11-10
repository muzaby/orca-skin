// 합성 사내 호스트 시스템 테스트 (0294 AC12·AC13).
//
// 사내 PC·self-hosted 러너는 Claude/OpenCode/Git 설정이 채워져 있다. 그 설정을 가진 HOME·환경
// 변수로 **자식 vitest** 를 띄워, 격리 없이는 실제로 깨지던 원인별 대표 테스트가 통과하고 그
// HOME 이 한 바이트도 바뀌지 않는지 본다. 격리(setup)를 지우면 이 테스트가 red 가 된다 —
// 대표 파일이 나중에 호스트와 무관해지면 다른 대표로 바꾼다(plan §7 주의사항).
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it, vi } from 'vitest'
import { scaledBudget } from '../../../scripts/test-time.mjs'

vi.setConfig(scaledBudget({ testTimeout: 180_000 }))

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
/** 원인별 대표 — 격리 없이 합성 호스트에서 실패하던 파일(plan §8). */
const REPRESENTATIVES = [
  'src/main/adapters/claude/adapter.context-policy.test.ts', // ANTHROPIC_MODEL · CLAUDE_CODE_DISABLE_1M_CONTEXT
  'src/main/adapters/claude/workspace-guard.test.ts', // CLAUDE_CONFIG_DIR
  'src/main/app/handlers/engine.import.test.ts', // CLAUDE_CONFIG_DIR
  'src/main/app/bootstrap.opencode-warmup.test.ts', // 전역 opencode mcp(enabled) · OPENCODE_CONFIG_DIR · 홈 쓰기
  'src/main/app/chat-turn/opencode-runtime.test.ts', // 전역 opencode mcp(disabled)
  'src/main/app/managed-mcp-lifecycle.test.ts', // OPENCODE_CONFIG
  'src/main/app/bootstrap.native-history.test.ts', // OPENCODE_DISABLE_PROJECT_CONFIG
  'src/main/infra/git/hermetic-config.test.ts', // ~/.gitconfig · GIT_CONFIG_SYSTEM · GIT_CONFIG_COUNT 서명 강제
  'src/main/features/plugins/confluence/connector.test.ts' // 실제 홈 쓰기
]

const root = mkdtempSync(join(tmpdir(), 'orcinus-orca-hostile-host-'))
afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 3 }))

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function tree(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((entry) => {
      const stat = statSync(join(dir, entry))
      return `${relative(dir, join(dir, entry))}\t${stat.isDirectory() ? 'd' : stat.size}\t${stat.mtimeMs}`
    })
    .sort()
}

it('합성 사내 호스트에서 대표 테스트가 통과하고 홈이 바뀌지 않는다', async () => {
  const home = join(root, 'home')
  const signing =
    '[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = /nonexistent/gpg\n[init]\n\tdefaultBranch = develop\n'
  write(join(home, '.gitconfig'), `[user]\n\tname = Corp\n\temail = corp@example.corp\n${signing}`)
  write(join(root, 'system-gitconfig'), signing)
  write(
    join(home, '.config', 'opencode', 'opencode.json'),
    JSON.stringify({
      mcp: {
        'corp-on': { type: 'local', command: ['corp-mcp'], enabled: true },
        'corp-off': { type: 'remote', url: 'https://mcp.example.corp', enabled: false }
      }
    })
  )
  write(
    join(root, 'corp-opencode.json'),
    JSON.stringify({ mcp: { 'corp-env': { type: 'local', command: ['x'] } } })
  )
  write(
    join(root, 'oc-dir', 'opencode.json'),
    JSON.stringify({ mcp: { 'corp-dir': { type: 'local', command: ['x'] } } })
  )
  write(join(root, 'claude-corp', 'settings.json'), JSON.stringify({ model: 'opus' }))
  write(
    join(home, '.config', 'orcinus-orca', 'orcinus-orca.json'),
    '{"version":1,"env":{"CORP":"1"}}'
  )
  const before = tree(home)

  // 격리가 없으면 새는 조건 — 바깥 setup 이 넣은 XDG·git 키를 빼고 호스트 값을 둔다.
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of [
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_CACHE_HOME',
    'XDG_STATE_HOME',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_NOSYSTEM'
  ])
    delete env[key]
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    ANTHROPIC_MODEL: 'corp-model',
    CLAUDE_CODE_DISABLE_1M_CONTEXT: '1',
    CLAUDE_CONFIG_DIR: join(root, 'claude-corp'),
    OPENCODE_CONFIG: join(root, 'corp-opencode.json'),
    OPENCODE_CONFIG_DIR: join(root, 'oc-dir'),
    OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
    GIT_CONFIG_SYSTEM: join(root, 'system-gitconfig'),
    // env 로 주입한 설정은 전역·시스템 파일 격리와 무관하게 이긴다 — `GIT_` 지움만 막는다.
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'commit.gpgsign',
    GIT_CONFIG_VALUE_0: 'true',
    GIT_CONFIG_KEY_1: 'gpg.program',
    GIT_CONFIG_VALUE_1: '/nonexistent/gpg'
  })

  const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
    execFile(
      process.execPath,
      [
        join(APP, 'node_modules', 'vitest', 'vitest.mjs'),
        'run',
        ...REPRESENTATIVES,
        '--reporter=dot'
      ],
      { cwd: APP, env, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) =>
        resolve({
          code: error ? ((error as { code?: number }).code ?? 1) : 0,
          output: `${stdout}\n${stderr}`
        })
    )
  })
  // 바깥 실행이 색을 켜 두면 자식 출력에 ANSI 코드가 섞인다.
  const output = result.output.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '')
  expect(result.code, output.slice(-4000)).toBe(0)
  expect(output).toMatch(new RegExp(`Test Files\\s+${REPRESENTATIVES.length} passed`))
  expect(tree(home)).toEqual(before)
})
