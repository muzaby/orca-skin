import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateConfigToSources } from './migrate-sources'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-migrate-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeFile(p: string, content: string): void {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, content, 'utf8')
}

describe('migrateConfigToSources', () => {
  it('구 루트 레이아웃을 sources/ 로 이전한다', () => {
    writeFile(join(root, 'skills', 'demo', 'SKILL.md'), '# demo')
    writeFile(join(root, 'agents', 'a.md'), 'agent')
    writeFile(join(root, 'commands', 'c.md'), 'cmd')
    writeFile(join(root, 'mcp.json'), '{"mcpServers":{}}')
    writeFile(join(root, '.claude-plugin', 'plugin.json'), '{}')

    migrateConfigToSources(root)

    expect(readFileSync(join(root, 'sources', 'skills', 'demo', 'SKILL.md'), 'utf8')).toBe('# demo')
    expect(readFileSync(join(root, 'sources', 'agents', 'a.md'), 'utf8')).toBe('agent')
    expect(readFileSync(join(root, 'sources', 'commands', 'c.md'), 'utf8')).toBe('cmd')
    expect(readFileSync(join(root, 'sources', 'mcp', 'mcp.json'), 'utf8')).toBe('{"mcpServers":{}}')
    // 구 위치 제거
    expect(existsSync(join(root, 'skills'))).toBe(false)
    expect(existsSync(join(root, 'mcp.json'))).toBe(false)
    expect(existsSync(join(root, '.claude-plugin'))).toBe(false)
  })

  it('멱등하다 — 두 번째 실행은 콘텐츠를 보존하고 throw 하지 않는다', () => {
    writeFile(join(root, 'skills', 'demo', 'SKILL.md'), '# demo')
    migrateConfigToSources(root)
    expect(() => migrateConfigToSources(root)).not.toThrow()
    expect(readFileSync(join(root, 'sources', 'skills', 'demo', 'SKILL.md'), 'utf8')).toBe('# demo')
  })

  it('dest 에 이미 있는 사용자 콘텐츠를 덮어쓰지 않고 병합한다', () => {
    writeFile(join(root, 'sources', 'skills', 'keep.md'), 'KEEP')
    writeFile(join(root, 'skills', 'legacy.md'), 'LEGACY')
    migrateConfigToSources(root)
    expect(readFileSync(join(root, 'sources', 'skills', 'keep.md'), 'utf8')).toBe('KEEP')
    expect(readFileSync(join(root, 'sources', 'skills', 'legacy.md'), 'utf8')).toBe('LEGACY')
  })

  it('이전할 구 콘텐츠가 없어도 골격 디렉토리를 만든다', () => {
    migrateConfigToSources(root)
    for (const d of ['instructions', 'skills', 'agents', 'commands', 'mcp']) {
      expect(existsSync(join(root, 'sources', d))).toBe(true)
    }
    expect(existsSync(join(root, 'sources', 'hooks', 'claude-code'))).toBe(true)
  })
})
