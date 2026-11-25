import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import type { AppMessagePart, LoadedMessage } from '../../../shared/ipc'
import {
  HISTORY_BODY_BYTES,
  HISTORY_PAGE_BYTES,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../shared/history-page'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { HistoryIndex } from './turn-index'
import { readHistoryPage } from './history-page'

describe('published panel summary replay', () => {
  it('isolates historical tasks, agents, processes and sources and reads only the selected detail', async () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys=ON')
    applyMigrations(sqlite)
    const db = new DbQueries(sqlite)
    const index = new HistoryIndex(db)
    function write(
      sessionId: string,
      role: LoadedMessage['role'],
      parts: AppMessagePart[]
    ): number {
      const messageId = db.appendMessage({
        sessionId,
        role,
        content: '',
        createdAt: 7,
        complete: 1
      })
      for (const part of parts)
        db.appendPart({
          messageId,
          type: part.type,
          toolRunId: 'toolRunId' in part ? (part.toolRunId ?? null) : null,
          payloadJson: JSON.stringify(part)
        })
      return messageId
    }
    const tool = (id: string, name: string, args: unknown): AppMessagePart => ({
      type: 'tool_call',
      toolRunId: id,
      toolName: name,
      args
    })
    const result = (
      id: string,
      structuredOutput: unknown,
      output: unknown = 'ok'
    ): AppMessagePart => ({
      type: 'tool_result',
      toolRunId: id,
      result: output,
      isError: false,
      structuredOutput
    })
    const big = '字'.repeat(90000)
    try {
      sqlite.transaction(() => {
        for (const s of ['S', 'T']) {
          db.insertSession({ id: s, backend: 'claude', title: null, projectId: null, createdAt: 1 })
          for (let turn = 1; turn <= 100; turn++) {
            write(s, 'user', [{ type: 'text', text: String(turn) }])
            const parts: AppMessagePart[] = []
            if (turn === 17) {
              parts.push(
                tool('create', 'TaskCreate', { subject: s, description: big }),
                result('create', { task: { id: '7', subject: s } })
              )
              for (let j = 0; j < 2; j++)
                parts.push(
                  tool('agent' + j, 'Agent', { description: s + j, prompt: big }),
                  { type: 'text', text: big, parentToolRunId: 'agent' + j },
                  result('agent' + j, undefined, 'settled')
                )
              for (let j = 0; j < 20; j++)
                parts.push(
                  tool('read' + j, 'Read', { file_path: '/src/' + s + j }),
                  result('read' + j, undefined)
                )
              for (let j = 0; j < 3; j++)
                parts.push(
                  tool('shell' + j, 'Bash', { command: s + j }),
                  result('shell' + j, undefined, big)
                )
            }
            if (turn === 41 && s === 'S')
              parts.push(
                tool('update', 'TaskUpdate', { taskId: '7', status: 'completed' }),
                result('update', { success: true, taskId: '7', updatedFields: ['status'] }),
                result('update', { success: true, taskId: '7', updatedFields: ['status'] })
              )
            write(s, 'assistant', parts)
          }
        }
      })()
      for (const sessionId of ['S', 'T']) {
        const generation = (await index.prepare(sessionId))!.generation
        const request = (query: HistoryQuery): HistoryPageReply =>
          readHistoryPage({ db, getCwd: () => '.' }, { ...query, requestId: 1 }, generation)
        const base = { sessionId, generation, openGeneration: 8 }
        const listed = (
          panel: 'tasks' | 'agents' | 'processes' | 'sources'
        ): Extract<HistoryPageReply, { status: 'panelSummary' }> => {
          const page = request({ ...base, kind: 'panelSummary', panel })
          if (page.status !== 'panelSummary') throw Error(page.status)
          expect(page.checkpoint).toBe(199)
          expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(HISTORY_PAGE_BYTES)
          expect(JSON.stringify(page)).not.toContain(big.slice(0, 100))
          expect(page.rows).toHaveLength(page.total)
          return page
        }
        const tasks = listed('tasks')
        expect(tasks.rows[0].value.item).toMatchObject({
          id: '7',
          subject: sessionId,
          status: sessionId === 'S' ? 'completed' : 'pending',
          description: null
        })
        const agents = listed('agents')
        expect(agents.rows.map((r) => r.key)).toEqual(['agent0', 'agent1'])
        expect(listed('sources').total).toBe(20)
        const processes = listed('processes')
        expect(processes.total).toBe(3)
        expect(processes.rows[0].value).toMatchObject({
          outputLength: big.length,
          item: { output: '', truncated: true, command: sessionId + '0' }
        })
        const detail = {
          ...base,
          kind: 'panelDetail' as const,
          panel: 'agents' as const,
          checkpoint: 199,
          itemKey: 'agent1'
        }
        const chunks: Buffer[] = []
        let offset = 0
        for (;;) {
          const reply = request({ ...detail, offset })
          if (reply.status !== 'panelDetail') throw Error(reply.status)
          const bytes = Buffer.from(reply.base64, 'base64')
          expect(bytes.length).toBeLessThanOrEqual(HISTORY_BODY_BYTES)
          chunks.push(bytes)
          offset += bytes.length
          if (reply.done) break
        }
        expect(JSON.parse(Buffer.concat(chunks).toString())).toMatchObject({
          kind: 'agents',
          item: { description: sessionId + '1', call: { input: { prompt: big } } },
          child: { parts: [{ type: 'text', text: big }] }
        })
        write(sessionId, 'assistant', [
          tool('gone', 'TaskGet', { taskId: '7' }),
          result('gone', { task: null })
        ])
        expect((await index.prepare(sessionId))?.generation).toBe(generation)
        expect(request({ ...detail, offset: 0 }).status).toBe('stale')
        expect(request({ ...base, kind: 'panelSummary', panel: 'tasks' })).toMatchObject({
          total: 0,
          checkpoint: 200
        })
        write(sessionId, 'assistant', [
          tool('seed', 'TaskCreate', {}),
          result('seed', { task: { id: '8', subject: 'removed by snapshot' } }),
          tool('list', 'TaskList', {}),
          result('list', { tasks: [{ id: '9', subject: 'only task', status: 'in_progress' }] })
        ])
        await index.prepare(sessionId)
        const replacement = request({ ...base, kind: 'panelSummary', panel: 'tasks' })
        expect(replacement.status === 'panelSummary' && replacement.rows.map((r) => r.key)).toEqual(
          ['agent:9']
        )
      }
    } finally {
      index.stop()
      sqlite.close()
    }
  })
})
