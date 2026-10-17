import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import type Database from 'better-sqlite3'
import type { openFileDatabase } from '../../../infra/db/file-database'
import { LEGACY_SCHEMA } from './legacy-schema'
import { nativeHistoryBusy, type NativeMessages } from './native-history'
import { sameNativePath } from './native-storage'
import {
  MigrationBlocked,
  inspectLegacyResources,
  copyLegacyResources,
  verifyLegacyResources
} from './legacy-resources'

type Row = Record<string, unknown>
export type MigrationResult =
  | { status: 'migrated' }
  | { status: 'missing' | 'unavailable' | 'busy' | 'migration-required'; message: string }
export interface LegacyMigrationOptions {
  legacyRoot: string
  openDatabase: typeof openFileDatabase
  /** Fault injection exercises real transactions; not used by the application. */
  phase?: (phase: 'resources' | 'messages' | 'pending-marker' | 'committed') => void | Promise<void>
}
export interface LegacyMigrationRequest {
  sessionId: string
  cwd: string
  targetDatabase: string
  nativeData: string
}
function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
function rows(db: Database.Database, table: string, column?: string, value?: unknown): Row[] {
  return db
    .prepare('SELECT * FROM "' + table + '"' + (column ? ' WHERE "' + column + '" = ?' : ''))
    .all(...(column ? [value] : [])) as Row[]
}
function validateSchema(db: Database.Database): void {
  for (const [table, expected] of Object.entries(LEGACY_SCHEMA)) {
    const columns = db
      .prepare('PRAGMA table_info("' + table + '")')
      .raw()
      .all()
    const foreignKeys = db
      .prepare('PRAGMA foreign_key_list("' + table + '")')
      .raw()
      .all()
    if (hash({ columns, foreignKeys }) !== expected)
      throw new MigrationBlocked('unsupported-schema:' + table)
  }
  const known = new Set(Object.keys(LEGACY_SCHEMA))
  for (const table of db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .pluck()
    .all() as string[]) {
    if (known.has(table)) continue
    const columns = db
      .prepare('PRAGMA table_info("' + table.replaceAll('"', '""') + '")')
      .all() as Array<{ name: string }>
    if (columns.some((column) => ['session_id', 'aggregate_id'].includes(column.name)))
      throw new MigrationBlocked('unsupported-schema:session-reference')
  }
}
function json(value: unknown): Row {
  if (typeof value !== 'string') throw new MigrationBlocked('invalid-json')
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new MigrationBlocked('invalid-json')
  return parsed as Row
}
function sessionTree(db: Database.Database, id: string): Row[] {
  let current = rows(db, 'session', 'id', id)[0]
  if (!current) return []
  const project = current.project_id
  const ancestors = new Set<string>()
  while (current.parent_id) {
    if (ancestors.has(String(current.id))) throw new MigrationBlocked('session-cycle')
    ancestors.add(String(current.id))
    const parent = rows(db, 'session', 'id', current.parent_id)[0]
    if (!parent || parent.project_id !== project) throw new MigrationBlocked('parent-project')
    current = parent
  }
  const result: Row[] = []
  const pending = [current]
  const seen = new Set<string>()
  while (pending.length) {
    const session = pending.shift()!
    const key = String(session.id)
    if (seen.has(key) || session.project_id !== project) throw new MigrationBlocked('session-tree')
    seen.add(key)
    result.push(session)
    pending.push(...rows(db, 'session', 'parent_id', key))
  }
  return result
}
function insert(db: Database.Database, table: string, row: Row): void {
  const columns = Object.keys(row)
  const quote = (name: string): string => '"' + name.replaceAll('"', '""') + '"'
  db.prepare(
    'INSERT INTO ' +
      quote(table) +
      ' (' +
      columns.map(quote).join(',') +
      ') VALUES (' +
      columns.map(() => '?').join(',') +
      ')'
  ).run(...columns.map((column) => row[column]))
}
function readMessages(messages: Row[], parts: Row[]): NativeMessages {
  return messages.map((message) => ({
    info: { ...json(message.data), id: message.id, sessionID: message.session_id },
    parts: parts
      .filter((part) => part.message_id === message.id)
      .map((part) => ({
        ...json(part.data),
        id: part.id,
        messageID: part.message_id,
        sessionID: part.session_id
      }))
  })) as NativeMessages
}

function validateRelations(collected: Map<string, Row[]>): void {
  const messages = new Map(collected.get('message')!.map((row) => [row.id, row]))
  const parts = new Map(collected.get('part')!.map((row) => [row.id, row]))
  const sessions = new Set(collected.get('session')!.map((row) => row.id))
  const matches = (data: Row, key: string, expected: unknown): void => {
    if (data[key] !== undefined && data[key] !== expected)
      throw new MigrationBlocked('identity-relation:' + key)
  }
  for (const row of messages.values()) {
    const data = json(row.data)
    matches(data, 'id', row.id)
    matches(data, 'sessionID', row.session_id)
    if (data.role !== 'user' && data.role !== 'assistant')
      throw new MigrationBlocked('message-role')
    if (data.role === 'assistant' && messages.get(data.parentID)?.session_id !== row.session_id)
      throw new MigrationBlocked('message-parent')
  }
  for (const row of parts.values()) {
    if (messages.get(row.message_id)?.session_id !== row.session_id)
      throw new MigrationBlocked('part-message-relation')
    const data = json(row.data)
    matches(data, 'id', row.id)
    matches(data, 'sessionID', row.session_id)
    matches(data, 'messageID', row.message_id)
  }
  for (const row of collected.get('event')!) {
    if (!sessions.has(row.aggregate_id)) throw new MigrationBlocked('event-session')
    const data = json(row.data)
    matches(data, 'sessionID', row.aggregate_id)
    const info = data.info && typeof data.info === 'object' ? (data.info as Row) : undefined
    if (info) {
      matches(info, 'sessionID', row.aggregate_id)
      if (
        String(row.type).startsWith('message.') &&
        messages.has(info.id) &&
        messages.get(info.id)?.session_id !== row.aggregate_id
      )
        throw new MigrationBlocked('event-message-relation')
      if (String(row.type).startsWith('session.')) matches(info, 'id', row.aggregate_id)
    }
    const part = data.part && typeof data.part === 'object' ? (data.part as Row) : undefined
    if (part) {
      matches(part, 'sessionID', row.aggregate_id)
      if (parts.has(part.id) && parts.get(part.id)?.session_id !== row.aggregate_id)
        throw new MigrationBlocked('event-part-relation')
    }
  }
}

export class LegacyStorageMigration {
  private readonly inFlight = new Map<string, Promise<MigrationResult>>()
  constructor(private readonly options: LegacyMigrationOptions) {}
  migrate(request: LegacyMigrationRequest): Promise<MigrationResult> {
    const key = request.targetDatabase
    const current = this.inFlight.get(key)
    if (current) return current.then(() => this.migrate(request))
    const task = this.run(request).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, task)
    return task
  }
  private async sourcePath(id: string): Promise<string | undefined> {
    const root = join(this.options.legacyRoot, 'data', 'opencode')
    let files: string[]
    try {
      files = await fs.readdir(root)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    const candidates: string[] = []
    for (const name of files.filter((name) => /^opencode(?:-[\w.-]+)?\.db$/.test(name))) {
      const path = join(root, name)
      const source = this.options.openDatabase(path, { fileMustExist: true, readonly: true })
      try {
        validateSchema(source)
        if (source.prepare('SELECT 1 FROM session WHERE id = ?').get(id)) candidates.push(path)
      } finally {
        source.close()
      }
    }
    if (candidates.length > 1) throw new MigrationBlocked('ambiguous-legacy-database')
    return candidates[0]
  }
  private async run(request: LegacyMigrationRequest): Promise<MigrationResult> {
    let source: Database.Database | undefined
    let target: Database.Database | undefined
    const marker = join(
      this.options.legacyRoot,
      'migration',
      hash([request.targetDatabase, request.sessionId]) + '.json'
    )
    let markerIds = [request.sessionId]
    let intent = false
    let committed = false
    const writeMarker = async (stage: string): Promise<void> => {
      await fs.mkdir(dirname(marker), { recursive: true })
      for (const id of markerIds) {
        const path = join(dirname(marker), hash([request.targetDatabase, id]) + '.json')
        const temp = path + '.tmp'
        await fs.writeFile(temp, JSON.stringify({ stage }))
        await fs.rename(temp, path)
        if (stage === 'pending') await this.options.phase?.('pending-marker')
      }
    }
    try {
      try {
        const saved: unknown = JSON.parse(await fs.readFile(marker, 'utf8'))
        if (saved && typeof saved === 'object' && 'stage' in saved) {
          if (saved.stage === 'committed')
            return {
              status: 'missing',
              message:
                '이전된 OpenCode 원본 세션이 더 이상 존재하지 않습니다. 보관 기록은 유지됩니다.'
            }
          if (saved.stage === 'pending') throw new MigrationBlocked('commit-state-unknown')
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const sourcePath = await this.sourcePath(request.sessionId)
      if (!sourcePath)
        return { status: 'missing', message: 'OpenCode 원본 세션을 찾을 수 없습니다.' }
      if (sameNativePath(await fs.realpath(sourcePath), await fs.realpath(request.targetDatabase)))
        return {
          status: 'migration-required',
          message: 'OpenCode 원본 경로가 같지만 세션 조회에 실패했습니다.'
        }
      source = this.options.openDatabase(sourcePath, { fileMustExist: true, timeout: 1000 })
      target = this.options.openDatabase(request.targetDatabase, {
        fileMustExist: true,
        timeout: 1000
      })
      validateSchema(source)
      validateSchema(target)
      source.exec('BEGIN IMMEDIATE')
      target.exec('BEGIN IMMEDIATE')
      // A native session created after the initial 404 wins. Do not merge or overwrite it.
      if (rows(target, 'session', 'id', request.sessionId).length) {
        target.exec('ROLLBACK')
        return { status: 'migrated' }
      }
      const sessions = sessionTree(source, request.sessionId)
      if (!sessions.length) throw new MigrationBlocked('missing-session')
      markerIds = sessions.map((row) => String(row.id))
      const requested = sessions.find((row) => row.id === request.sessionId)!
      if (
        typeof requested.directory !== 'string' ||
        !sameNativePath(requested.directory, request.cwd)
      )
        throw new MigrationBlocked('workdir-mismatch')
      const project = rows(source, 'project', 'id', requested.project_id)[0]
      if (!project || typeof project.worktree !== 'string')
        throw new MigrationBlocked('missing-project')
      await fs.access(project.worktree)
      const collected = new Map<string, Row[]>([['session', sessions]])
      for (const table of ['message', 'part', 'todo', 'event_sequence', 'event']) {
        const column = table.startsWith('event') ? 'aggregate_id' : 'session_id'
        collected.set(
          table,
          sessions.flatMap((session) => rows(source!, table, column, session.id))
        )
      }
      validateRelations(collected)
      for (const session of sessions) {
        if (typeof session.directory !== 'string') throw new MigrationBlocked('workdir-missing')
        await fs.access(session.directory)
        if (session.workspace_id || session.share_url)
          throw new MigrationBlocked('workspace-or-share')
        for (const table of [
          'session_input',
          'session_context_epoch',
          'session_message',
          'session_share'
        ])
          if (rows(source, table, 'session_id', session.id).length)
            throw new MigrationBlocked('unsupported-resource:' + table)
        if (rows(target, 'session', 'id', session.id).length)
          throw new MigrationBlocked('session-conflict')
        const messages = collected.get('message')!.filter((row) => row.session_id === session.id)
        const parts = collected.get('part')!.filter((row) => row.session_id === session.id)
        if (nativeHistoryBusy(readMessages(messages, parts)))
          throw new MigrationBlocked('session-busy', true)
      }
      if (collected.get('event_sequence')!.some((row) => row.owner_id))
        throw new MigrationBlocked('remote-journal-owner')
      for (const table of ['message', 'part', 'event', 'event_sequence']) {
        const key = table === 'event_sequence' ? 'aggregate_id' : 'id'
        for (const row of collected.get(table)!)
          if (rows(target, table, key, row[key]).length)
            throw new MigrationBlocked('identity-conflict:' + table)
      }
      const targetProject = rows(target, 'project', 'id', project.id)[0]
      if (
        targetProject &&
        (typeof targetProject.worktree !== 'string' ||
          !sameNativePath(targetProject.worktree, project.worktree))
      )
        throw new MigrationBlocked('project-conflict')
      const permissions = rows(source, 'permission', 'project_id', project.id)
      const targetPermissions = rows(target, 'permission', 'project_id', project.id)
      if (
        permissions.some(
          (row) =>
            !targetPermissions.some(
              (other) => other.action === row.action && other.resource === row.resource
            )
        )
      )
        throw new MigrationBlocked('permission-conflict')
      const raw = [
        ...sessions.map((session) => ({
          ...session,
          revert: session.revert ? json(session.revert) : null
        })),
        ...collected.get('message')!.map((row) => json(row.data)),
        ...collected.get('part')!.map((row) => json(row.data)),
        ...collected.get('event')!.map((row) => json(row.data))
      ]
      const resources = await inspectLegacyResources({
        raw,
        legacyRoot: this.options.legacyRoot,
        nativeData: request.nativeData,
        projectId: String(project.id),
        worktree: project.worktree,
        targetHasProjectSessions: rows(target, 'session', 'project_id', project.id).length > 0
      })
      await copyLegacyResources(resources)
      await this.options.phase?.('resources')
      if (!targetProject) insert(target, 'project', project)
      for (const row of rows(source, 'project_directory', 'project_id', project.id)) {
        const existing = target
          .prepare('SELECT * FROM project_directory WHERE project_id=? AND directory=?')
          .get(row.project_id, row.directory) as Row | undefined
        if (existing && (existing.type !== row.type || existing.strategy !== row.strategy))
          throw new MigrationBlocked('project-directory-conflict')
        if (!existing) insert(target, 'project_directory', row)
      }
      for (const table of ['session', 'message', 'part', 'todo', 'event_sequence', 'event']) {
        for (const row of collected.get(table)!) insert(target, table, row)
        if (table === 'message') await this.options.phase?.('messages')
      }
      if (target.prepare('PRAGMA foreign_key_check').all().length)
        throw new MigrationBlocked('foreign-key')
      await verifyLegacyResources(resources)
      intent = true
      await writeMarker('pending')
      target.exec('COMMIT')
      committed = true
      source.exec('ROLLBACK')
      await this.options.phase?.('committed')
      // Completion authority is the native re-read; this diagnostic marker is only advisory.
      await writeMarker('committed')
      return { status: 'migrated' }
    } catch (error) {
      if (intent && !committed && target?.inTransaction) {
        target.exec('ROLLBACK')
        // A proven rollback can retry. Failure to save this keeps the conservative pending marker.
        await writeMarker('rolled-back').catch(() => undefined)
      }
      if (error instanceof MigrationBlocked)
        return { status: error.busy ? 'busy' : 'migration-required', message: error.message }
      if ((error as { code?: string }).code === 'SQLITE_BUSY')
        return {
          status: 'busy',
          message: 'OpenCode 원본 저장소가 사용 중입니다. 잠시 후 다시 열어 주세요.'
        }
      return {
        status: 'migration-required',
        message:
          'OpenCode 기존 세션 전환을 완료하지 못했습니다 (storage-access). 원본은 보존되어 있습니다.'
      }
    } finally {
      if (target?.inTransaction) target.exec('ROLLBACK')
      if (source?.inTransaction) source.exec('ROLLBACK')
      target?.close()
      source?.close()
    }
  }
}
