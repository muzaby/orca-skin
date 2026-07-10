// claude provider settings 로더 테스트. sources settings flat-read + escalating defaultMode strip
// 만 적용해 verbatim 으로 돌려주는지 검증한다 (handoff 0028 — ${VAR} 확장·secret 주입 폐지,
// env 는 ~/.claude/settings.json 동일 취급으로 그대로 통과).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  classifyClaudeEnv,
  loadClaudeProviderSettings,
  readUserClaudeSettings
} from './claude-settings'

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

describe('readUserClaudeSettings — 사용자 전역 settings.json 원문 (0090)', () => {
  it('존재하면 raw 원문을 exists:true 로 돌려준다 (검증 없음 — 손상 JSON 도 원문 그대로)', () => {
    const path = join(root, '.claude', 'settings.json')
    writeFile(path, '{ "env": { "A": "1" } }')
    expect(readUserClaudeSettings(path)).toEqual({
      exists: true,
      settingsJson: '{ "env": { "A": "1" } }'
    })
    writeFile(path, '{broken')
    expect(readUserClaudeSettings(path)).toEqual({ exists: true, settingsJson: '{broken' })
  })

  it('부재/읽기 실패는 exists:false + 빈 문자열', () => {
    expect(readUserClaudeSettings(join(root, 'nope', 'settings.json'))).toEqual({
      exists: false,
      settingsJson: ''
    })
  })
})

describe('classifyClaudeEnv — env 기반 provider 판별 (0090, TRD §6.8)', () => {
  it('CLAUDE_CODE_USE_BEDROCK → bedrock', () => {
    expect(classifyClaudeEnv({ env: { CLAUDE_CODE_USE_BEDROCK: '1' } })).toBe('bedrock')
  })

  it('CLAUDE_CODE_USE_VERTEX → vertex', () => {
    expect(classifyClaudeEnv({ env: { CLAUDE_CODE_USE_VERTEX: '1' } })).toBe('vertex')
  })

  it('ANTHROPIC_BASE_URL → custom (게이트웨이)', () => {
    expect(classifyClaudeEnv({ env: { ANTHROPIC_BASE_URL: 'https://gw.example.com' } })).toBe(
      'custom'
    )
  })

  it('그 외 / env 부재·비객체 → anthropic', () => {
    expect(classifyClaudeEnv({ env: { ANTHROPIC_API_KEY: 'k' } })).toBe('anthropic')
    expect(classifyClaudeEnv({})).toBe('anthropic')
    expect(classifyClaudeEnv({ env: 'not-an-object' })).toBe('anthropic')
    expect(classifyClaudeEnv({ env: ['a'] })).toBe('anthropic')
  })

  it("비활성 값('0'/''/null)은 판별 신호로 치지 않는다", () => {
    expect(classifyClaudeEnv({ env: { CLAUDE_CODE_USE_BEDROCK: '0' } })).toBe('anthropic')
    expect(classifyClaudeEnv({ env: { CLAUDE_CODE_USE_VERTEX: '' } })).toBe('anthropic')
    expect(classifyClaudeEnv({ env: { ANTHROPIC_BASE_URL: null } })).toBe('anthropic')
  })

  it('bedrock 이 vertex/custom 보다 우선한다 (레시피 표 순서)', () => {
    expect(
      classifyClaudeEnv({
        env: { CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CODE_USE_VERTEX: '1', ANTHROPIC_BASE_URL: 'x' }
      })
    ).toBe('bedrock')
  })
})
