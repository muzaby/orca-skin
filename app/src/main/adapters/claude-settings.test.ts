// claude provider settings 로더 테스트. sources settings flat-read + escalating defaultMode strip
// 만 적용해 verbatim 으로 돌려주는지 검증한다 (handoff 0028 — ${VAR} 확장·secret 주입 폐지,
// env 는 ~/.claude/settings.json 동일 취급으로 그대로 통과).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadClaudeProviderSettings } from './claude-settings'

let root: string

function writeFile(p: string, content: string): void {
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, content, 'utf8')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-claude-settings-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function args(
  overrides: Partial<Parameters<typeof loadClaudeProviderSettings>[0]> = {}
): Parameters<typeof loadClaudeProviderSettings>[0] {
  return {
    sourcesSettingsFile: join(root, 'sources', 'settings', 'claude', 'anthropic', 'settings.json'),
    ...overrides
  }
}

describe('loadClaudeProviderSettings — sources flat read (verbatim)', () => {
  it('sources settings 를 flat-read 해 verbatim 으로 돌려준다', async () => {
    writeFile(args().sourcesSettingsFile, '{"model":"from-sources"}')
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { model: 'from-sources' }
    })
  })

  it('파일 부재/손상은 경고 후 빈 settings 로 무시한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await loadClaudeProviderSettings(args())).toEqual({ settings: {} })
    writeFile(args().sourcesSettingsFile, '{broken')
    expect(await loadClaudeProviderSettings(args())).toEqual({ settings: {} })
  })

  it('escalating defaultMode 를 수동 제거한다 (filterEscalatingDefaultMode 동등)', async () => {
    writeFile(
      args().sourcesSettingsFile,
      JSON.stringify({ permissions: { defaultMode: 'bypassPermissions', allow: ['Read'] } })
    )
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { permissions: { allow: ['Read'] } }
    })
    // 비-escalating 모드는 보존.
    writeFile(args().sourcesSettingsFile, JSON.stringify({ permissions: { defaultMode: 'plan' } }))
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { permissions: { defaultMode: 'plan' } }
    })
  })

  it('env 는 ~/.claude/settings.json 동일 취급 — 평문/${VAR} 무변환으로 settings 안에 그대로 남는다', async () => {
    writeFile(
      args().sourcesSettingsFile,
      JSON.stringify({ env: { ANTHROPIC_API_KEY: 'plain-key', BASE: '${VAR}' }, model: 'm' })
    )
    // Orca 는 ${VAR} 확장도, secret-store 토큰 주입도 하지 않는다 — 입력 그대로.
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { env: { ANTHROPIC_API_KEY: 'plain-key', BASE: '${VAR}' }, model: 'm' }
    })
  })
})
