import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import migration0001 from '../../infra/db/migrations/0001_initial.sql?raw'
import migration0002 from '../../infra/db/migrations/0002_projects.sql?raw'
import migration0003 from '../../infra/db/migrations/0003_messages_fts.sql?raw'
import migration0004 from '../../infra/db/migrations/0004_message_parts.sql?raw'
import migration0005 from '../../infra/db/migrations/0005_usage_events.sql?raw'
import migration0006 from '../../infra/db/migrations/0006_turn_usage.sql?raw'
import migration0007 from '../../infra/db/migrations/0007_title_source.sql?raw'
import migration0008 from '../../infra/db/migrations/0008_provider_key.sql?raw'
import migration0009 from '../../infra/db/migrations/0009_message_complete.sql?raw'
import migration0010 from '../../infra/db/migrations/0010_session_cwd.sql?raw'
import migration0011 from '../../infra/db/migrations/0011_session_lineage.sql?raw'
import migration0014 from '../../infra/db/migrations/0014_provider_usage_report_cache.sql?raw'
import migration0015 from '../../infra/db/migrations/0015_pinned.sql?raw'
import migration0016 from '../../infra/db/migrations/0016_turn_model_context_window.sql?raw'
import migration0017 from '../../infra/db/migrations/0017_session_extra_dirs.sql?raw'
import migration0012 from '../../infra/db/migrations/0012_provider_limits.sql?raw'
import { DbQueries } from '../../infra/db/queries'
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
  for (const sql of [
    migration0001,
    migration0002,
    migration0003,
    migration0004,
    migration0005,
    migration0006,
    migration0007,
    migration0008,
    migration0009,
    migration0010,
    migration0011,
    migration0012,
    migration0014,
    migration0015,
    migration0016,
    migration0017
  ])
    db.exec(sql)
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
