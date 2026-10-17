import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { CHANNELS } from '../../../shared/ipc'
import { BackgroundController } from '../../features/chat/background-controller'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { BackgroundOutputStore } from '../../infra/background-output'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import type { RouterContext } from '../context'

const callbacks = vi.hoisted(
  () => new Map<string, (request: { sessionId: string }) => Promise<unknown>>()
)
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _mode: unknown,
    callback: (request: { sessionId: string }) => Promise<unknown>
  ) => callbacks.set(channel, callback),
  handlePlain: vi.fn()
}))
import { registerSessionHandlers } from './session'

const roots: string[] = []
const connections: Database.Database[] = []
afterEach(async () => {
  for (const db of connections.splice(0)) db.close()
  for (const root of roots.splice(0)) {
    const resolved = path.resolve(root)
    if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep))
      throw new Error('fixture root escaped temporary directory')
    await rm(resolved, { recursive: true, force: true })
  }
  callbacks.clear()
  vi.restoreAllMocks()
})

describe('session removal preserves native and archived files through the real handler', () => {
  it.each([false, true])(
    'keeps native, worktree and output files when runtime cleanup fails: %s',
    async (failCleanup) => {
      const root = await mkdtemp(path.join(tmpdir(), 'orca-session-remove-'))
      roots.push(root)
      const worktree = path.join(root, 'worktree')
      const nativeRoot = path.join(root, 'native')
      await mkdir(worktree)
      await mkdir(nativeRoot)
      const nativeFile = path.join(nativeRoot, 's1.jsonl')
      const workingFile = path.join(worktree, 'sample.md')
      const logFile = path.join(worktree, 'process.log')
      await writeFile(nativeFile, '{"sessionId":"s1","message":"native history"}\n')
      await writeFile(workingFile, '# Worktree stays\n')
      await writeFile(logFile, 'completed process output\n')
      const outputs = new BackgroundOutputStore(path.join(root, 'outputs'))
      const output = await outputs.capture(
        { id: 'output', field: 'output_file', value: logFile, kind: 'file' },
        [worktree]
      )
      const outputFile = path.join(root, 'outputs', output.id)
      const removeSnapshot = vi.spyOn(outputs, 'removeSnapshot')

      const db = new Database(':memory:')
      connections.push(db)
      db.pragma('foreign_keys = ON')
      applyMigrations(db)
      const queries = new DbQueries(db)
      queries.insertManagedWorktree({
        id: 'worktree',
        repoRoot: root,
        sourceCwd: root,
        worktreeRoot: worktree,
        branch: 'work/fixture',
        baseOid: 'a'.repeat(40),
        createdAt: 1
      })
      queries.insertSession({
        id: 's1',
        backend: 'opencode',
        title: 'Fixture',
        projectId: null,
        cwd: worktree,
        createdAt: 1
      })
      const messageId = queries.appendMessage({
        sessionId: 's1',
        role: 'assistant',
        content: 'archived answer',
        createdAt: 2
      })
      queries.appendPart({
        messageId,
        type: 'text',
        toolRunId: null,
        payloadJson: '{"text":"archived answer"}'
      })
      const source = { generation: 'g', sequence: 1, receivedAt: 1, replay: false }
      queries.background.append({
        type: 'background.task',
        sessionId: 's1',
        source,
        taskId: 'task',
        phase: 'notification',
        patch: { status: 'completed' }
      })
      queries.background.append({
        type: 'background.output',
        sessionId: 's1',
        source: { ...source, sequence: 2 },
        taskId: 'task',
        outputId: 'output',
        snapshot: output
      })
      const journal = queries.background.list('s1')
      const parts = queries.loadParts('s1')
      const binding = queries.getManagedWorktreeBySession('s1')
      expect(journal).toHaveLength(2)
      expect(parts).toHaveLength(1)
      expect(binding).toMatchObject({ id: 'worktree', worktree_root: worktree })
      const controller = new BackgroundController({
        tracker: new BackgroundTaskTracker(),
        load: (id) => queries.background.list(id),
        persist: (event, done) => {
          queries.background.append(event)
          done()
        },
        publish: vi.fn(),
        runtime: () => undefined,
        roots: () => [worktree],
        outputs
      })
      const patch = vi.fn()
      const runtimeCleanup = vi.fn(() => {
        if (failCleanup) throw new Error('fixture cleanup failure')
      })
      registerSessionHandlers(
        {
          db: queries,
          getCwd: () => worktree,
          settings: { getAll: () => ({ lastSessionId: 's1' }), patch }
        } as unknown as RouterContext,
        {
          onSessionDisposed: (id) => {
            controller.dispose(id, { preserveOutputSnapshots: true })
            runtimeCleanup()
          }
        }
      )

      const remove = callbacks.get(CHANNELS.sessionDelete)
      if (!remove) throw new Error('session delete was not registered')
      if (failCleanup) {
        await expect(remove({ sessionId: 's1' })).rejects.toThrow('fixture cleanup failure')
        expect(queries.listSessions()).toHaveLength(1)
        expect(queries.getSessionById('s1')).toBeDefined()
        expect(patch).not.toHaveBeenCalled()
      } else {
        await expect(remove({ sessionId: 's1' })).resolves.toEqual({ ok: true })
        expect(queries.listSessions()).toEqual([])
        expect(queries.getSessionById('s1')).toBeUndefined()
        expect(patch).toHaveBeenCalledWith({ lastSessionId: null })
      }
      expect(runtimeCleanup).toHaveBeenCalledOnce()
      expect(removeSnapshot).not.toHaveBeenCalled()
      expect(queries.background.list('s1')).toEqual(journal)
      expect(queries.loadParts('s1')).toEqual(parts)
      expect(queries.getManagedWorktreeBySession('s1')).toEqual(binding)
      expect(await readFile(nativeFile, 'utf8')).toBe(
        '{"sessionId":"s1","message":"native history"}\n'
      )
      expect((await stat(worktree)).isDirectory()).toBe(true)
      expect(await readFile(workingFile, 'utf8')).toBe('# Worktree stays\n')
      expect(await readFile(logFile, 'utf8')).toBe('completed process output\n')
      expect(await readFile(outputFile, 'utf8')).toBe('completed process output\n')
      expect(db.pragma('foreign_key_check')).toEqual([])
    }
  )
})
