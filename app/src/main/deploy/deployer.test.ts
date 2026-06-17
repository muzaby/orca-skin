import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
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
  writeFile(join(root, 'sources', 'hooks', 'claude-code', 'h.txt'), 'hook')
  writeFile(join(root, 'sources', 'mcp', 'mcp.json'), mcpJson)
}

function seedProviderSettings(provider: string, settings = '{"env":{}}'): void {
  writeFile(join(root, 'sources', 'settings', 'claude-code', provider, 'settings.json'), settings)
}

const dist = (): string => join(root, 'dist', 'claude-code')

describe('deploy', () => {
  it('skills 와 mcp 를 SDK 표준 dist 거울로 렌더하고 engine-specific 자산은 배포하지 않는다', () => {
    seedSources('{"mcpServers":{"gh":{"command":"${GH_MCP}"}}}')
    const r = deploy('claude-code', {}, root)

    expect(r.dryRun).toBe(false)
    expect(r.validation.ok).toBe(true)
    expect(readFileSync(join(dist(), '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8')).toBe(
      '# demo'
    )
    expect(JSON.parse(readFileSync(join(dist(), '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: { gh: { command: '${GH_MCP}' } }
    })
    expect(existsSync(join(dist(), 'plugin'))).toBe(false)
    expect(existsSync(join(dist(), 'agents'))).toBe(false)
    expect(existsSync(join(dist(), 'commands'))).toBe(false)
    expect(existsSync(join(dist(), 'hooks'))).toBe(false)
    expect(existsSync(join(dist(), '.orca-deploy.json'))).toBe(true)
  })

  it('provider settings 는 검증만 하고 dist 로 복사하지 않는다', () => {
    seedSources()
    seedProviderSettings('anthropic', '{"env":{"A":"1"}}')
    seedProviderSettings('bedrock', '{"env":{"CLAUDE_CODE_USE_BEDROCK":"1"}}')

    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(existsSync(join(dist(), 'anthropic'))).toBe(false)
    expect(existsSync(join(dist(), 'bedrock'))).toBe(false)
  })

  it('settings.json 파싱 실패는 해당 provider 만 에러로 보고하고 나머지는 배포한다', () => {
    seedSources()
    seedProviderSettings('anthropic')
    seedProviderSettings('bedrock', '{broken')

    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('settings/bedrock/settings.json')
    expect(existsSync(join(dist(), 'anthropic'))).toBe(false)
    expect(existsSync(join(dist(), 'bedrock'))).toBe(false)
  })

  it('잘못된 provider 디렉토리 이름을 검증 오류로 보고한다', () => {
    seedSources()
    seedProviderSettings('bad name!')
    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('bad name!')
  })

  it('settings.json 없는 provider 디렉토리는 dist 파일 없이 허용한다', () => {
    seedSources()
    mkdirSync(join(root, 'sources', 'settings', 'claude-code', 'vertex'), { recursive: true })
    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(r.actions.join(' ')).toContain('skip agents/commands/hooks/plugin/settings dist copy')
    expect(existsSync(join(dist(), 'vertex'))).toBe(false)
  })

  it('dryRun 은 계획만 반환하고 dist 를 쓰지 않는다', () => {
    seedSources()
    seedProviderSettings('anthropic')
    const r = deploy('claude-code', { dryRun: true }, root)
    expect(r.dryRun).toBe(true)
    expect(r.actions.join(' ')).toContain('skip agents/commands/hooks/plugin/settings dist copy')
    expect(existsSync(dist())).toBe(false)
  })

  it('잘못된 MCP 키 이름을 검증 오류로 보고한다', () => {
    seedSources('{"mcpServers":{"bad name!":{"command":"x"}}}')
    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('bad name!')
  })

  it('재배포 시 기존 dist 를 백업(.bak)하고 새로 쓴다 — provider 디렉토리 포함 루트 단위', () => {
    seedSources()
    seedProviderSettings('anthropic')
    deploy('claude-code', {}, root)
    const r2 = deploy('claude-code', {}, root)
    expect(r2.backedUp).toBe(true)
    expect(existsSync(`${dist()}.bak`)).toBe(true)
    expect(existsSync(join(`${dist()}.bak`, '.claude', 'skills', 'demo', 'SKILL.md'))).toBe(true)
  })

  it('sources 하위가 비어도 빈 plugin 디렉토리를 만든다', () => {
    writeFile(join(root, 'sources', 'mcp', 'mcp.json'), '{"mcpServers":{}}')
    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(existsSync(join(dist(), '.claude', 'skills'))).toBe(true)
  })
})
