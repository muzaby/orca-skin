// claude provider settings 로더 테스트. sources settings flat-read 경로와 env 후처리(${VAR} 확장·secret 주입·escalating 모드 제거)를 검증한다.

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
    providerKey: 'claude-code-anthropic',
    provider: 'anthropic',
    sourcesSettingsFile: join(
      root,
      'sources',
      'settings',
      'claude-code',
      'anthropic',
      'settings.json'
    ),
    resolve: () => undefined as string | undefined,
    ...overrides
  }
}

describe('loadClaudeProviderSettings — sources flat read', () => {
  it('sources settings 를 flat-read 한다 ({settings, env} 분리)', async () => {
    writeFile(args().sourcesSettingsFile, '{"model":"from-sources"}')
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { model: 'from-sources' },
      env: {}
    })
  })

  it('둘 다 없으면 빈 settings, 손상 파일은 경고 후 무시한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await loadClaudeProviderSettings(args())).toEqual({ settings: {}, env: {} })
    writeFile(args().sourcesSettingsFile, '{broken')
    expect(await loadClaudeProviderSettings(args())).toEqual({ settings: {}, env: {} })
  })

  it('escalating defaultMode 를 수동 제거한다 (filterEscalatingDefaultMode 동등)', async () => {
    writeFile(
      args().sourcesSettingsFile,
      JSON.stringify({ permissions: { defaultMode: 'bypassPermissions', allow: ['Read'] } })
    )
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { permissions: { allow: ['Read'] } },
      env: {}
    })
    // 비-escalating 모드는 보존.
    writeFile(args().sourcesSettingsFile, JSON.stringify({ permissions: { defaultMode: 'plan' } }))
    expect(await loadClaudeProviderSettings(args())).toEqual({
      settings: { permissions: { defaultMode: 'plan' } },
      env: {}
    })
  })

  it('env 값의 ${VAR} 를 확장해 env 로 분리하고 미해결 키는 드롭한다 (settings.env 유출 0)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    writeFile(
      args().sourcesSettingsFile,
      JSON.stringify({ env: { A: '${OK}', B: '${MISSING}' }, model: 'm' })
    )
    const out = await loadClaudeProviderSettings(
      args({ resolve: (name: string) => (name === 'OK' ? 'v' : undefined) })
    )
    // env 는 분리 반환, settings 에는 env 가 남지 않는다 (미확장 ${VAR} 유출 차단).
    expect(out).toEqual({ settings: { model: 'm' }, env: { A: 'v' } })
  })

  it('secret-store 토큰(provider:<key>)을 env.ANTHROPIC_API_KEY 로 주입한다 (0010 규약 유지)', async () => {
    writeFile(args().sourcesSettingsFile, JSON.stringify({ env: { A: '1' } }))
    const out = await loadClaudeProviderSettings(
      args({
        secrets: {
          get: (name: string) =>
            name === 'provider:claude-code-anthropic' ? 'secret-token' : undefined
        }
      })
    )
    expect(out).toEqual({ settings: {}, env: { A: '1', ANTHROPIC_API_KEY: 'secret-token' } })
  })

  it('env 가 전부 드롭되면 env 는 빈 객체, settings 에 env 키가 남지 않는다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    writeFile(args().sourcesSettingsFile, JSON.stringify({ env: { B: '${MISSING}' }, model: 'm' }))
    expect(await loadClaudeProviderSettings(args())).toEqual({ settings: { model: 'm' }, env: {} })
  })
})
