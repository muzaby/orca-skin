// 0330 VP-21 — 측정 시드 DB(≤0035 스키마)를 현재 트리가 마이그레이션해 production 리더로 열면
// H1 대상(`targets`)이 가리키는 메시지가 그 ID·본문으로 나온다.
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HARNESSES, SEARCH_TEXT, seedSpec, writeSeed } from '../../../../scripts/history-seed.mjs'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { loadSession } from './reader'

const migrations = join(__dirname, '../../infra/db/migrations')
const roots: string[] = []
const handles: Database.Database[] = []
afterEach(() => {
  for (const handle of handles.splice(0)) handle.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function seeded(): { db: DbQueries; spec: ReturnType<typeof seedSpec>; cwd: string } {
  const root = mkdtempSync(join(tmpdir(), 'oo-seed-it-'))
  roots.push(root)
  const sqlite = new Database(join(root, 'seed.db'))
  handles.push(sqlite)
  sqlite.pragma('foreign_keys = ON')
  const spec = seedSpec({ turns: [1, 100], large: false, cwd: root })
  writeSeed(sqlite, spec, { migrationsDir: migrations })
  applyMigrations(sqlite)
  return { db: new DbQueries(sqlite), spec, cwd: root }
}

const bodyOf = (parts: { type: string; text?: string }[]): string =>
  parts.map((p) => p.text ?? '').join('')

describe('measurement seed opened by the production reader', () => {
  it('S-E1 targets are the last loaded message and keep harness identity', () => {
    const { db, spec, cwd } = seeded()
    // 하네스 정체성은 시드 표(`HARNESSES`)가 아니라 production 리더가 읽은 값으로 본다 — 리터럴 기대값.
    const identity: Record<string, [string, string]> = {
      'claude-code': ['claude', 'code'],
      'claude-work': ['claude', 'work'],
      opencode: ['opencode', 'code']
    }
    expect(Object.keys(HARNESSES)).toEqual(Object.keys(identity))
    for (const [harness, expected] of Object.entries(identity))
      for (const load of ['turns-1', 'turns-100']) {
        const target = spec.targets[`S-E1/${harness}/${load}`]
        const session = loadSession(db, target.sessionId, () => cwd)!
        expect([session.backend, session.agentKind]).toEqual(expected)
        const last = session.messages.at(-1)!
        expect(last.id).toBe(target.messageId)
        expect(bodyOf(last.parts)).toContain(target.expectText)
      }
  })

  it('S-E5 targets are the turn-63 hit in each harness', () => {
    const { db, spec, cwd } = seeded()
    for (const harness of Object.keys(HARNESSES)) {
      const target = spec.targets[`S-E5/${harness}/click`]
      const session = loadSession(db, target.sessionId, () => cwd)!
      const hit = session.messages.filter((m) => bodyOf(m.parts).includes('센서 A'))
      expect(hit.map((m) => m.id)).toEqual([target.messageId])
      expect(bodyOf(hit[0].parts)).toContain(SEARCH_TEXT)
    }
  })
})
