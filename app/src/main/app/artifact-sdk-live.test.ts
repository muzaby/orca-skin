// Opt-in actual SDK/CLI evaluation. Ordinary tests never call a model.
// This composes the production publisher, MCP adapter, mapper, runtime and writer;
// it does not exercise the Electron renderer or the whole ClaudeAdapter query configuration.
import { expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import Database from 'better-sqlite3'
import { adaptRuntimeTools } from '../adapters/claude-runtime-tools'
import { createSessionInputStream } from '../adapters/streaming-input'
import { claudeToNormalized, type MapContext } from '../adapters/claude-map'
import type { RuntimeSessionAdapter } from '../contracts/ports'
import type { TurnContext } from '../contracts/turn'
import { SessionRuntime } from '../features/sessions/session-runtime'
import { HistoryWriter } from '../features/history/writer'
import { ArtifactService } from '../features/artifacts/service'
import { createArtifactToolServer } from '../features/artifacts/tool'
import { applyMigrations } from '../infra/db/migrate'
import { DbQueries } from '../infra/db/queries'
import { isWithinDir } from '../infra/config/paths'
import { makeClassifiedError } from '../infra/errors'

vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
vi.setConfig({ testTimeout: 120_000, hookTimeout: 30_000 })

function failureKind(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/EPERM|EACCES|permission denied/i.test(text)) return 'process-or-permission'
  if (/auth|login|401|403/i.test(text)) return 'authentication-or-access'
  if (/network|fetch|socket|ENOTFOUND|ECONN|certificate/i.test(text)) return 'network'
  if (/abort|cancel/i.test(text)) return 'cancelled'
  return 'sdk-or-execution'
}

it.skipIf(process.env.ORCA_ARTIFACT_LIVE !== '1')(
  'P02 real SDK preserves publisher receipt and original tool call identity',
  async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'orca-artifact-sdk-live-'))
    const cwd = join(fixtureRoot, 'workspace')
    const artifactRoot = join(fixtureRoot, 'published')
    await mkdir(cwd)
    await writeFile(
      join(cwd, 'meeting-notes.txt'),
      [
        '가상 프로젝트 회의 메모',
        'Alpha 센서 시험은 화요일에 재실행한다.',
        '민수: 합성 입력 fixture를 준비한다.',
        '지연: 결과 표를 검토한다.',
        '결정: 실패 기준은 오차 3% 초과이며 실제 고객 데이터는 사용하지 않는다.'
      ].join('\n')
    )
    const db = new Database(join(fixtureRoot, 'fixture.db'))
    applyMigrations(db)
    const queries = new DbQueries(db)
    const service = new ArtifactService({
      queries: queries.artifacts,
      rootDir: artifactRoot,
      trashItem: async () => {
        throw new Error('trash is outside this live fixture')
      }
    })
    const publishedIds: string[] = []
    const tool = createArtifactToolServer(service, (_sessionId, artifact) =>
      publishedIds.push(artifact.publicationId)
    )
    const tools = { revision: 1, servers: new Map([[tool.descriptor.id, tool]]) }
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 90_000)
    let model: string | undefined
    let sessionId: string | null = null
    let failure: string | null = null
    const calls: Array<{ id: string; path: unknown }> = []
    const linked: string[] = []
    const adapter: RuntimeSessionAdapter = {
      id: 'claude',
      complete: async () => '',
      classifyError: () =>
        makeClassifiedError('stream_error', 'live SDK failure', { retryable: false }),
      sendMessage(request) {
        const ctx: MapContext = { sessionId: '', cwd }
        const input = createSessionInputStream([{ content: request.text }])
        const handle = query({
          prompt: input.stream,
          options: {
            cwd,
            persistSession: false,
            settingSources: [],
            maxTurns: 8,
            tools: ['Read', 'Write'],
            permissionMode: 'acceptEdits',
            abortController: controller,
            systemPrompt: { type: 'preset', preset: 'claude_code' },
            ...adaptRuntimeTools(tools, request.runtimeToolContext),
            canUseTool: async (name, input) => {
              if (name === 'mcp__orca_artifacts__publish_artifact')
                return { behavior: 'allow', updatedInput: input }
              const path =
                typeof input.file_path === 'string' ? resolve(cwd, input.file_path) : null
              return (name === 'Read' || name === 'Write') && path && isWithinDir(path, cwd)
                ? { behavior: 'allow', updatedInput: input }
                : {
                    behavior: 'deny',
                    message: 'Only synthetic workspace Read/Write and the publisher are available.'
                  }
            }
          }
        })
        return {
          eventBatches: (async function* () {
            let sequence = 0
            for await (const message of handle) {
              if (message.type === 'system' && message.subtype === 'init') model = message.model
              const events = claudeToNormalized(message, ctx)
              if (events.length) yield { sequence: sequence++, events }
            }
          })(),
          close: () => {
            input.close()
            handle.close()
          },
          interrupt: async () => {
            await handle.interrupt()
            return undefined
          },
          setModel: async () => {},
          setPermissionMode: async () => {},
          stopTask: async () => {},
          backgroundTask: async () => false
        }
      }
    }
    const runtime = new SessionRuntime(adapter)
    const writer = new HistoryWriter(queries, undefined, queries.artifacts)
    const turn = {
      dbSessionId: null,
      currentAssistantMessageId: null,
      assistantText: '',
      askResolved: new Map(),
      titleAdapter: adapter,
      pendingUserText: null,
      pendingProjectId: null,
      providerKey: null,
      cwd,
      extraDirs: [],
      sessionBaseline: null,
      sessionBaselineRef: null,
      pendingAskAnswers: [],
      askPendingIds: [],
      stoppedSubagents: new Set(),
      blockedSubagents: new Set()
    } as unknown as TurnContext
    let generated: boolean | null = null
    let stored: number | null = null
    let cards: number | null = null
    let observationFailure: string | null = null
    try {
      for await (const event of runtime.send({
        sessionId: null,
        cwd,
        text: 'meeting-notes.txt의 회의 메모를 읽고 핵심 결정과 담당자별 실행 항목을 정리한 Markdown 문서 meeting-summary.md로 제공해 주세요.',
        extensions: { skills: [], hooks: { normalized: {} }, runtimeTools: tools }
      })) {
        if (
          event.type === 'tool.call.started' &&
          event.toolName === 'mcp__orca_artifacts__publish_artifact'
        ) {
          calls.push({ id: event.toolRunId, path: (event.args as { path?: unknown })?.path })
        }
        writer.persist(turn, event)
        if (event.type === 'session.updated') {
          sessionId = event.sessionId
          // The harness has no UI registry: the real DB insert above is the confirmation boundary.
          runtime.confirmRuntimeToolSession(sessionId)
        }
        if (event.type === 'tool.call.completed' && event.artifact)
          linked.push(event.artifact.publicationId)
        if (event.type === 'error') failure = 'model-or-sdk-error'
      }
    } catch (error) {
      failure = failureKind(error)
    } finally {
      clearTimeout(timeout)
      controller.abort()
      try {
        runtime.close()
        await service.close()
        // Observe even after timeout/cancellation, once publication preparations have settled.
        generated = await readFile(join(cwd, 'meeting-summary.md'), 'utf8').then(
          (text) => text.trim().length > 0,
          (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return false
            throw error
          }
        )
        stored = sessionId ? queries.artifacts.listLatest(sessionId).length : 0
        cards = sessionId
          ? queries.loadParts(sessionId).filter((part) => part.type === 'artifact').length
          : 0
      } catch (error) {
        observationFailure = failureKind(error)
      } finally {
        db.close()
        // Only this test's generated temporary root is removed; never the user's artifacts/config root.
        await rm(fixtureRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      }
    }
    process.stdout.write(
      JSON.stringify({
        scenario: 'P02',
        model,
        timedOut,
        failure,
        observationFailure,
        generated,
        publisherCalls: calls,
        publishedIds,
        linkedIds: linked,
        stored,
        cards,
        persistSession: false,
        inputMode: 'production-session-stream',
        allowedBuiltins: ['Read', 'Write']
      }) + '\n'
    )
    expect({ timedOut, failure }).toEqual({ timedOut: false, failure: null })
    expect(observationFailure).toBeNull()
    expect(generated).toBe(true)
    expect(calls.length).toBeGreaterThan(0)
    expect(publishedIds.length).toBeGreaterThan(0)
    expect(linked).toEqual(publishedIds)
    expect(stored).toBeGreaterThan(0)
    expect(cards).toBeGreaterThan(0)
  }
)
