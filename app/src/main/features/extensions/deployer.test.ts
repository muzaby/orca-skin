import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deploy } from './deployer'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-deploy-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeFile(p: string, content: string): void {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, content, 'utf8')
}

function seedSources(mcpJson = '{"mcpServers":{}}'): void {
  writeFile(join(root, 'sources', 'skills', 'demo', 'SKILL.md'), '# demo')
  writeFile(join(root, 'sources', 'agents', 'a.md'), 'agent')
  writeFile(join(root, 'sources', 'commands', 'c.md'), 'cmd')
  writeFile(join(root, 'sources', 'hooks', 'claude', 'h.txt'), 'hook')
  writeFile(join(root, 'sources', 'mcp', 'mcp.json'), mcpJson)
}

function seedProviderSettings(provider: string, settings = '{"env":{}}'): void {
  writeFile(join(root, 'sources', 'settings', 'claude', provider, 'settings.json'), settings)
}

const dist = (): string => join(root, 'dist', 'claude')

describe('deploy', () => {
  it('skills 와 mcp 를 Claude plugin 패키지로 렌더하고 구 dist 거울은 만들지 않는다', async () => {
    seedSources('{"mcpServers":{"gh":{"command":"${GH_MCP}"}}}')
    const r = await deploy('claude', {}, root)

    expect(r.dryRun).toBe(false)
    expect(r.validation.ok).toBe(true)
    expect(
      readFileSync(join(dist(), 'plugins', 'orca', 'skills', 'demo', 'SKILL.md'), 'utf8')
    ).toBe('# demo')
    expect(JSON.parse(readFileSync(join(dist(), 'plugins', 'orca', '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: { gh: { command: '${GH_MCP}' } }
    })
    expect(
      JSON.parse(
        readFileSync(join(dist(), 'plugins', 'orca', '.claude-plugin', 'plugin.json'), 'utf8')
      )
    ).toEqual({
      name: 'orca',
      description: 'orca에서 구성된 skill 및 mcp',
      version: '1.0.0'
    })
    expect(existsSync(join(dist(), '.claude'))).toBe(false)
    expect(existsSync(join(dist(), '.mcp.json'))).toBe(false)
    expect(existsSync(join(dist(), 'commands'))).toBe(false)
    expect(existsSync(join(dist(), '.orca-deploy.json'))).toBe(true)
  })

  it('provider settings 는 검증만 하고 dist 로 복사하지 않는다', async () => {
    seedSources()
    seedProviderSettings('anthropic', '{"env":{"A":"1"}}')
    seedProviderSettings('bedrock', '{"env":{"CLAUDE_CODE_USE_BEDROCK":"1"}}')

    const r = await deploy('claude', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(existsSync(join(dist(), 'anthropic'))).toBe(false)
    expect(existsSync(join(dist(), 'bedrock'))).toBe(false)
  })

  it('settings.json 파싱 실패는 해당 provider 만 에러로 보고하고 나머지는 배포한다', async () => {
    seedSources()
    seedProviderSettings('anthropic')
    seedProviderSettings('bedrock', '{broken')

    const r = await deploy('claude', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('settings/bedrock/settings.json')
    expect(existsSync(join(dist(), 'anthropic'))).toBe(false)
    expect(existsSync(join(dist(), 'bedrock'))).toBe(false)
  })

  it('잘못된 provider 디렉토리 이름을 검증 오류로 보고한다', async () => {
    seedSources()
    seedProviderSettings('bad name!')
    const r = await deploy('claude', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('bad name!')
  })

  it('settings.json 없는 provider 디렉토리는 dist 파일 없이 허용한다', async () => {
    seedSources()
    mkdirSync(join(root, 'sources', 'settings', 'claude', 'vertex'), { recursive: true })
    const r = await deploy('claude', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(r.actions.join(' ')).toContain('skip commands/settings dist copy')
    expect(existsSync(join(dist(), 'vertex'))).toBe(false)
  })

  it('dryRun 은 계획만 반환하고 dist 를 쓰지 않는다', async () => {
    seedSources()
    seedProviderSettings('anthropic')
    const r = await deploy('claude', { dryRun: true }, root)
    expect(r.dryRun).toBe(true)
    expect(r.actions.join(' ')).toContain('skip commands/settings dist copy')
    expect(existsSync(dist())).toBe(false)
  })

  it('잘못된 MCP 키 이름을 검증 오류로 보고한다', async () => {
    seedSources('{"mcpServers":{"bad name!":{"command":"x"}}}')
    const r = await deploy('claude', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('bad name!')
  })

  it('재배포 시 기존 dist 를 백업(.bak)하고 새로 쓴다 — provider 디렉토리 포함 루트 단위', async () => {
    seedSources()
    seedProviderSettings('anthropic')
    await deploy('claude', {}, root)
    const r2 = await deploy('claude', {}, root)
    expect(r2.backedUp).toBe(true)
    expect(existsSync(`${dist()}.bak`)).toBe(true)
    expect(existsSync(join(`${dist()}.bak`, 'plugins', 'orca', 'skills', 'demo', 'SKILL.md'))).toBe(
      true
    )
  })

  // 0157 (AC12) — .bak 은 배포 구조 롤백용이지 비밀 보관용이 아니다. dist 를 통째로 rename 하면
  // 해석된 MCP 비밀의 평문 사본이 무기한 남는다(보고서 위험 #2).
  it('백업에 해석된 MCP 비밀의 2차 사본을 남기지 않는다', async () => {
    seedSources()
    const opts = { mcpConfig: { wiki: { command: 'npx', env: { TOKEN: 'resolved-secret' } } } }
    await deploy('claude', opts, root)
    // 1차 배포본에는 값이 있다(claude CLI 가 읽어야 하는 문서화된 잔여 노출).
    const live = join(dist(), 'plugins', 'orca', '.mcp.json')
    expect(readFileSync(live, 'utf8')).toContain('resolved-secret')

    await deploy('claude', opts, root)

    // 백업으로 밀려난 사본은 제거된다.
    expect(existsSync(join(`${dist()}.bak`, 'plugins', 'orca', '.mcp.json'))).toBe(false)
    // 백업의 나머지 구조(롤백 목적)는 그대로 남는다.
    expect(existsSync(join(`${dist()}.bak`, 'plugins', 'orca', 'skills', 'demo', 'SKILL.md'))).toBe(
      true
    )
  })

  it('Orca 스킬은 enabled 와 무관하게 plugin 에 포함하고(활성 제어는 런타임 options.skills) MCP 는 mcpConfig 로 필터된다', async () => {
    seedSources('{"mcpServers":{"on":{"command":"npx"},"off":{"command":"node"}}}')
    writeFile(join(root, 'sources', 'skills', 'off', 'SKILL.md'), '# off')

    const r = await deploy('claude', { mcpConfig: { on: { command: 'npx' } } }, root)

    expect(r.validation.ok).toBe(true)
    // 비활성 스킬도 파일은 복사된다 — 활성/비활성은 어댑터의 options.skills 필터가 담당.
    expect(existsSync(join(dist(), 'plugins', 'orca', 'skills', 'demo', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(dist(), 'plugins', 'orca', 'skills', 'off', 'SKILL.md'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dist(), 'plugins', 'orca', '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: { on: { command: 'npx' } }
    })
  })

  it('adapter 스킬은 복사하지 않고 dist/plugins/claude 래퍼 플러그인(링크)으로 배포한다 (0117)', async () => {
    seedSources()
    writeFile(join(root, 'adapter-skills', 'native', 'SKILL.md'), '# native')

    const r = await deploy(
      'claude',
      {
        skillRoots: [
          {
            sourceId: 'orca',
            sourceLabel: 'Orca 스킬',
            sourceKind: 'orca',
            rootDir: join(root, 'sources', 'skills')
          },
          {
            sourceId: 'adapter:claude',
            sourceLabel: 'CLAUDE 스킬',
            sourceKind: 'adapter',
            rootDir: join(root, 'adapter-skills')
          }
        ]
      },
      root
    )

    expect(r.validation.ok).toBe(true)
    // Orca 스킬만 orca plugin 패키지에 포함, 어댑터 스킬은 제외(복사 없음).
    expect(existsSync(join(dist(), 'plugins', 'orca', 'skills', 'demo', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(dist(), 'plugins', 'orca', 'skills', 'native', 'SKILL.md'))).toBe(false)
    // 어댑터 스킬은 래퍼 플러그인(매니페스트 + skills 링크)으로 노출된다.
    expect(
      JSON.parse(
        readFileSync(join(dist(), 'plugins', 'claude', '.claude-plugin', 'plugin.json'), 'utf8')
      ).name
    ).toBe('claude')
    expect(lstatSync(join(dist(), 'plugins', 'claude', 'skills')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(dist(), 'plugins', 'claude', 'skills'))).toBe(
      join(root, 'adapter-skills')
    )
    expect(r.actions.join(' ')).toContain('render user-skills plugin')
  })

  it('adapter 스킬 루트 부재(기본 skillRoots) 시 래퍼 플러그인을 만들지 않는다', async () => {
    seedSources()
    const r = await deploy('claude', {}, root)
    expect(existsSync(join(dist(), 'plugins', 'claude'))).toBe(false)
    expect(r.actions.join(' ')).toContain('skip user-skills plugin')
  })

  it('재배포의 backup→rm 롤링이 래퍼 링크 대상(어댑터 스킬 원본)을 보존한다 (0117 AC#7)', async () => {
    seedSources()
    writeFile(join(root, 'adapter-skills', 'native', 'SKILL.md'), '# native')
    const opts = {
      skillRoots: [
        {
          sourceId: 'adapter:claude',
          sourceLabel: 'CLAUDE 스킬',
          sourceKind: 'adapter' as const,
          rootDir: join(root, 'adapter-skills')
        }
      ]
    }
    await deploy('claude', opts, root)
    await deploy('claude', opts, root) // rename → .bak
    await deploy('claude', opts, root) // rm .bak(링크 포함) → 재백업
    expect(readFileSync(join(root, 'adapter-skills', 'native', 'SKILL.md'), 'utf8')).toBe(
      '# native'
    )
    expect(readlinkSync(join(dist(), 'plugins', 'claude', 'skills'))).toBe(
      join(root, 'adapter-skills')
    )
  })

  it('sources 하위가 비어도 빈 plugin 디렉토리를 만든다', async () => {
    writeFile(join(root, 'sources', 'mcp', 'mcp.json'), '{"mcpServers":{}}')
    const r = await deploy('claude', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(existsSync(join(dist(), 'plugins', 'orca', 'skills'))).toBe(true)
  })
})
