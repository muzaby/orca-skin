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

const dist = (): string => join(root, 'dist', 'claude-code')

describe('deploy', () => {
  it('sources/ 를 dist/<engine>/ 로 렌더한다(manifest + 복사)', () => {
    seedSources()
    const r = deploy('claude-code', {}, root)

    expect(r.dryRun).toBe(false)
    expect(r.validation.ok).toBe(true)
    expect(existsSync(join(dist(), '.claude-plugin', 'plugin.json'))).toBe(true)
    expect(readFileSync(join(dist(), 'skills', 'demo', 'SKILL.md'), 'utf8')).toBe('# demo')
    expect(readFileSync(join(dist(), 'agents', 'a.md'), 'utf8')).toBe('agent')
    expect(readFileSync(join(dist(), 'commands', 'c.md'), 'utf8')).toBe('cmd')
    expect(readFileSync(join(dist(), 'hooks', 'h.txt'), 'utf8')).toBe('hook')
    expect(existsSync(join(dist(), '.orca-deploy.json'))).toBe(true)
  })

  it('dryRun 은 계획만 반환하고 dist 를 쓰지 않는다', () => {
    seedSources()
    const r = deploy('claude-code', { dryRun: true }, root)
    expect(r.dryRun).toBe(true)
    expect(r.actions.length).toBeGreaterThan(0)
    expect(existsSync(dist())).toBe(false)
  })

  it('잘못된 MCP 키 이름을 검증 오류로 보고한다', () => {
    seedSources('{"mcpServers":{"bad name!":{"command":"x"}}}')
    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(false)
    expect(r.validation.errors.join(' ')).toContain('bad name!')
  })

  it('재배포 시 기존 dist 를 백업(.bak)하고 새로 쓴다', () => {
    seedSources()
    deploy('claude-code', {}, root)
    const r2 = deploy('claude-code', {}, root)
    expect(r2.backedUp).toBe(true)
    expect(existsSync(`${dist()}.bak`)).toBe(true)
  })

  it('sources 하위가 비어도 빈 dist 디렉토리를 만든다', () => {
    writeFile(join(root, 'sources', 'mcp', 'mcp.json'), '{"mcpServers":{}}')
    const r = deploy('claude-code', {}, root)
    expect(r.validation.ok).toBe(true)
    expect(existsSync(join(dist(), 'skills'))).toBe(true)
  })
})
