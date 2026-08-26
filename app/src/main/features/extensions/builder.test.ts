import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'
import { ExtensionBuilder } from './builder'
import type { McpStore } from './mcp/store'
import type { Settings } from '../../../shared/ipc'
import type { RuntimeToolSource } from '../../adapters/runtime-tools'

// builder 는 mcp.enabledConfig() 만 호출하고 skills getter 결과를 패스스루한다. 구조적 최소 fake.
const fakeMcp = { enabledConfig: () => ({}) } as unknown as McpStore

function makeSettings(over: Partial<Settings> = {}): Settings {
  return { language: '한국어', accountInstructions: '', ...over } as Settings
}

// 0001~0011 전체를 순서대로 적용 — DbQueries 생성자가 준비하는 statement 가 후기 마이그레이션
// 컬럼(provider_key=0008·cwd=0010 등)을 참조하므로 전부 필요하다.
function seedDb(): DbQueries {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return new DbQueries(db)
}

describe('ExtensionBuilder.systemPromptAppend', () => {
  it('resume 경로: 헤더(# Orca/# User/# Project) 뒤에 프로젝트 지침이 붙는다', () => {
    const db = seedDb()
    db.insertProject({
      id: 'p1',
      name: '센서 QA',
      instructions: '항상 근거를 붙여라',
      createdAt: 1
    })
    db.insertSession({ id: 's1', backend: 'claude', title: null, projectId: 'p1', createdAt: 1 })

    const builder = new ExtensionBuilder(
      db,
      fakeMcp,
      () => [],
      () => makeSettings({ accountInstructions: '간결하게' }),
      '1.0.0'
    )
    const { systemPromptAppend } = builder.build('s1', null)

    expect(systemPromptAppend).toContain('# Orca')
    expect(systemPromptAppend).toContain('Orca version: 1.0.0')
    expect(systemPromptAppend).toContain('Preferred language: 한국어')
    expect(systemPromptAppend).toContain('Account instructions: 간결하게')
    expect(systemPromptAppend).toContain('Active project: 센서 QA')
    // 프로젝트 지침은 '# Project' 섹션 안에 'Project instructions:' 로 포맷화되어 편입.
    expect(systemPromptAppend).toContain('Project instructions:\n항상 근거를 붙여라')
    expect(systemPromptAppend!.indexOf('# Project')).toBeLessThan(
      systemPromptAppend!.indexOf('항상 근거를 붙여라')
    )
  })

  it('새 채팅 경로(projectId): 세션 없이 프로젝트명/지침을 조회한다', () => {
    const db = seedDb()
    db.insertProject({ id: 'p2', name: 'Alpha', instructions: 'TDD 로 진행', createdAt: 1 })

    const builder = new ExtensionBuilder(
      db,
      fakeMcp,
      () => [],
      () => makeSettings(),
      '2.0.0'
    )
    const { systemPromptAppend } = builder.build(null, 'p2')

    expect(systemPromptAppend).toContain('Active project: Alpha')
    expect(systemPromptAppend).toContain('TDD 로 진행')
  })

  it('프로젝트 없는 세션: 헤더만(# Project 섹션·지침 없음)', () => {
    const db = seedDb()
    db.insertSession({ id: 's2', backend: 'claude', title: null, projectId: null, createdAt: 1 })

    const builder = new ExtensionBuilder(
      db,
      fakeMcp,
      () => [],
      () => makeSettings(),
      '1.0.0'
    )
    const { systemPromptAppend } = builder.build('s2', null)

    expect(systemPromptAppend).toContain('# Orca')
    expect(systemPromptAppend).toContain('Preferred language: 한국어')
    expect(systemPromptAppend).not.toContain('# Project')
  })
})

describe('ExtensionBuilder.runtimeTools', () => {
  it('forwards the injected empty registry snapshot with revision zero', () => {
    const source: RuntimeToolSource = {
      snapshot: () => ({ revision: 0, servers: new Map() })
    }
    const Builder = ExtensionBuilder as unknown as new (...args: unknown[]) => ExtensionBuilder
    const builder = new Builder(
      seedDb(),
      fakeMcp,
      () => [],
      () => makeSettings(),
      '1.0.0',
      undefined,
      source
    )

    expect(builder.build(null, null).runtimeTools).toEqual({ revision: 0, servers: new Map() })
  })
})
