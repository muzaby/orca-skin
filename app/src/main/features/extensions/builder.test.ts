import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'
import { ExtensionBuilder } from './builder'
import type { Settings, SkillInfo } from '../../../shared/ipc'
import type { RuntimeToolSource } from '../../adapters/runtime-tools'

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
  it('adds only the profile header/key and preserves the exact tool snapshot, plugins and skills', () => {
    const snapshot = { revision: 17, servers: new Map() }
    const skills: SkillInfo[] = []
    const builder = new ExtensionBuilder(
      seedDb(),
      () => skills,
      () => makeSettings(),
      '1',
      () => ['/plugins/existing'],
      { snapshot: () => snapshot }
    )
    const coding = builder.build(null, null)
    const work = builder.build(null, null, {
      agentInstructions: 'Work fixture',
      agentProfileKey: 'work:1'
    })
    expect(work.agentProfileKey).toBe('work:1')
    expect(coding).not.toHaveProperty('agentProfileKey')
    expect(work.runtimeTools).toBe(snapshot)
    expect(work.skills).toBe(skills)
    expect(work.pluginRoots).toEqual(coding.pluginRoots)
    expect(work.hooks).toEqual(coding.hooks)
    expect(work.systemPromptAppend?.replace('# Agent\nWork fixture\n\n', '')).toBe(
      coding.systemPromptAppend
    )
  })
  it('build는 plugin·skill·지침을 보존하면서 배포용 MCP 데이터를 만들지 않는다', () => {
    const skill: SkillInfo = {
      name: 'review',
      description: 'Review a result',
      sourceId: 'fixture',
      sourceLabel: 'Fixture',
      enabled: true,
      sourceKind: 'orca',
      canToggle: true,
      canRemove: true,
      skillPath: '/skills/review/SKILL.md',
      skillDir: '/skills/review'
    }
    const builder = new ExtensionBuilder(
      seedDb(),
      () => [skill],
      () => makeSettings(),
      '1.0.0',
      () => ['/plugins/orcinus-orca', '/plugins/user']
    )
    const extensions = builder.build(null, null)
    expect(extensions).not.toHaveProperty('mcp')
    expect(extensions.pluginRoots).toEqual(['/plugins/orcinus-orca', '/plugins/user'])
    expect(extensions.skills).toEqual([skill])
    expect(extensions.hooks).toEqual({ normalized: {} })
    expect(extensions.systemPromptAppend).toContain('Orca version: 1.0.0')
  })

  it('forwards the injected empty registry snapshot with revision zero', () => {
    const source: RuntimeToolSource = {
      snapshot: () => ({ revision: 0, servers: new Map() })
    }
    const builder = new ExtensionBuilder(
      seedDb(),
      () => [],
      () => makeSettings(),
      '1.0.0',
      undefined,
      source
    )

    expect(builder.build(null, null).runtimeTools).toEqual({ revision: 0, servers: new Map() })
  })
})
