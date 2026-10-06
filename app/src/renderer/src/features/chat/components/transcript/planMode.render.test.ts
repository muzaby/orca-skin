import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CanUseTool, HookCallback, Options } from '@anthropic-ai/claude-agent-sdk'

const { script } = vi.hoisted(() => ({
  script: { current: undefined as undefined | ((options: Options) => AsyncGenerator<unknown>) }
}))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: ({ options }: { options: Options }) => ({
    [Symbol.asyncIterator]: () => script.current!(options),
    setPermissionMode: vi.fn(),
    interrupt: vi.fn(),
    setModel: vi.fn(),
    close: vi.fn()
  })
}))

import { ClaudeAdapter } from '../../../../../../main/adapters/claude'
import type { LiveTurn } from '../../../../../../main/adapters/types'
import { HistoryWriter } from '../../../../../../main/features/history/writer'
import { partFromRow } from '../../../../../../main/infra/ipc/dto'
import { agentPermissionRequest } from '../../../../../../main/features/approvals/permission-bridge'
import type { DbQueries } from '../../../../../../main/infra/db'
import type { TurnContext } from '../../../../../../main/contracts/turn'
import type {
  AppMessagePart,
  LoadedSession,
  NormalizedEvent,
  PermissionAction
} from '../../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatState } from '../../reducer/chatReducer'
import { messageSegments, partsToolCalls } from '../../lib/parts'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { ToolCard } from './ToolCard'
import { WorkToolBody } from './WorkToolBody'

const roots: string[] = []
const lives: LiveTurn[] = []
afterEach(async () => {
  script.current = undefined
  for (const live of lives.splice(0)) live.close()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

const recv = (state: ChatState, event: NormalizedEvent): ChatState =>
  chatReducer(state, { type: 'RECV_EVENT', event })
const started = (id: string, input: unknown, toolName = 'ExitPlanMode'): NormalizedEvent => ({
  type: 'tool.call.started',
  sessionId: 'plan-session',
  toolRunId: id,
  toolName,
  args: input
})
const review = (
  input: Record<string, unknown>,
  source: Record<string, unknown> = {}
): Extract<NormalizedEvent, { type: 'permission.requested' }> => ({
  type: 'permission.requested',
  sessionId: 'plan-session',
  approvalId: 'approval',
  origin: 'agent',
  action: {
    kind: 'plan_review',
    request: { requestId: 'approval', plan: String(input.plan ?? '') },
    input,
    providerRequest: { requestId: 'control', toolUseId: 'exit', ...source }
  }
})
const initial = (): ChatState => ({ ...initialChatState, sessionId: 'plan-session' })

function expectCards(parts: AppMessagePart[], expected: Record<string, unknown>): void {
  const calls = partsToolCalls(parts)
  const call = calls.find((item) => item.toolUseId === 'exit')!
  expect(call.input).toEqual(expected)
  const segment = messageSegments(parts).find((item) => item.kind === 'tools')
  expect(segment?.kind).toBe('tools')
  if (segment?.kind !== 'tools') throw new Error('missing tool segment')
  expect(segment.calls.find((item) => item.toolUseId === 'exit')?.input).toEqual(expected)
  const code = load(
    renderToStaticMarkup(
      createElement(ToolCard, {
        call,
        presentation: 'detail-body',
        transcriptPolicy: agentUiPolicy('code').transcript
      })
    )
  )
  expect(code.text()).toContain(String(expected.plan))
  expect(code.text()).toContain(String(expected.planFilePath))
  expect(code.text()).toContain('allowedPrompts:')
  const work = load(renderToStaticMarkup(createElement(WorkToolBody, { call })))
  expect(JSON.parse(work('section').first().find('pre').text())).toEqual(expected)
}

async function hook(options: Options, event: 'PostToolUse' | 'Stop', file: string): Promise<void> {
  for (const matcher of options.hooks?.[event] ?? []) {
    if (matcher.matcher && !new RegExp(matcher.matcher).test('Write')) continue
    for (const callback of matcher.hooks as HookCallback[]) {
      await callback(
        {
          hook_event_name: event,
          tool_name: 'Write',
          tool_input: { file_path: file },
          tool_response: {}
        } as never,
        undefined,
        { signal: new AbortController().signal }
      )
    }
  }
}

describe('0249 ΔV3 VP-35 — 계획 입력의 라이브/재로드 도구 카드', () => {
  it.each(['started-first', 'approval-first'] as const)(
    '%s: 실제 adapter·history payload·decode·reducer에서 같은 승인 본문/경로를 표시한다',
    async (order) => {
      const root = await mkdtemp(path.resolve('orca-plan-card-'))
      roots.push(root)
      await mkdir(path.join(root, 'plans'))
      const file = path.join(root, 'plans', 'review.md')
      await writeFile(file, '# 시작 본문')
      const original = {
        allowedPrompts: [{ tool: 'Bash', prompt: '테스트를 실행한다' }],
        extra: 'keep'
      }
      const approved = { ...original, plan: '# 승인 시점 본문', planFilePath: file }
      const rows: Parameters<typeof partFromRow>[0][] = []
      const db = {
        appendMessage: () => 1,
        appendPart: (part: { type: string; payloadJson: string; toolRunId: string | null }) => {
          rows.push({
            type: part.type,
            payload_json: part.payloadJson,
            tool_run_id: part.toolRunId
          } as Parameters<typeof partFromRow>[0])
        },
        updateToolCallInput: (
          sessionId: string,
          messageId: number,
          toolUseId: string,
          toolName: string,
          input: unknown
        ) => {
          expect(sessionId).toBe('plan-session')
          expect(messageId).toBe(1)
          expect(toolName).toBe('ExitPlanMode')
          for (const row of rows) {
            const payload = JSON.parse(row.payload_json)
            if (row.tool_run_id === toolUseId && payload.toolName === 'ExitPlanMode')
              row.payload_json = JSON.stringify({ ...payload, args: input })
          }
        }
      }
      const writer = new HistoryWriter(db as unknown as DbQueries, () => false)
      const turn = {
        agentKind: 'code',
        dbSessionId: 'plan-session',
        currentAssistantMessageId: null,
        assistantText: ''
      } as TurnContext
      let state = initial()
      const actions: PermissionAction[] = []
      const results: Awaited<ReturnType<CanUseTool>>[] = []
      const deliver = (event: NormalizedEvent): void => {
        writer.persist(turn, event)
        state = recv(state, event)
      }
      const approve = async (options: Options): Promise<void> => {
        await writeFile(file, approved.plan)
        results.push(
          await options.canUseTool!('ExitPlanMode', original, {
            requestId: 'control',
            toolUseID: 'exit',
            signal: new AbortController().signal
          } as never)
        )
      }
      script.current = async function* (options) {
        yield {
          type: 'system',
          subtype: 'status',
          session_id: 'plan-session',
          permissionMode: 'plan'
        }
        await hook(options, 'PostToolUse', file)
        if (order === 'approval-first') {
          await approve(options)
          await hook(options, 'Stop', file)
          await writeFile(file, '# 승인 뒤 파일 변경')
        }
        yield {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'neighbor', name: 'Read', input: { file_path: 'other.md' } },
              { type: 'tool_use', id: 'exit', name: 'ExitPlanMode', input: original }
            ]
          }
        }
        if (order === 'started-first') await approve(options)
      }
      const live = new ClaudeAdapter().sendMessage({
        sessionId: 'plan-session',
        text: 'submit plan',
        cwd: root,
        env: { CLAUDE_CONFIG_DIR: root },
        extensions: { skills: [], hooks: { normalized: {} } },
        onPermissionModeChanged: (sessionId, mode) => {
          state = recv(state, {
            type: 'session.updated',
            sessionId,
            patch: { permissionMode: mode }
          })
        },
        requestApproval: async (action) => {
          actions.push(action)
          deliver(agentPermissionRequest('approval', action, 'plan-session'))
          return { behavior: 'allow' }
        }
      })
      lives.push(live)
      for await (const batch of live.eventBatches)
        for (const event of batch.events) if (event.type === 'tool.call.started') deliver(event)
      expect(actions[0]).toMatchObject({ input: approved, request: { plan: approved.plan } })
      expect(results[0]).toMatchObject({ behavior: 'allow', updatedInput: approved })
      expect(original).not.toHaveProperty('plan')
      expect(state.permissionMode).toBe('plan')
      expectCards(
        state.messages.flatMap((message) => message.parts),
        approved
      )
      const parts = rows.map(partFromRow)
      const reloaded = chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 'plan-session',
          messages: [{ role: 'assistant', createdAt: 1, parts }]
        } as LoadedSession
      })
      expectCards(
        reloaded.messages.flatMap((message) => message.parts),
        approved
      )
      expect(partsToolCalls(parts).find((call) => call.toolUseId === 'neighbor')?.input).toEqual({
        file_path: 'other.md'
      })
    }
  )

  it('기존 호출 교정은 이름·id·main·세션·현재 턴 경계를 지키고 이웃/결과를 보존한다', () => {
    const original = { allowedPrompts: [] }
    const input = { ...original, plan: '# 검토한 계획', planFilePath: 'C:\\plans\\a.md' }
    let state = initial()
    state = recv(state, started('exit', original))
    state = recv(state, started('other', original))
    state = recv(state, started('exit', { child: true }, 'Read'))
    state = recv(state, {
      ...started('exit', original),
      parentToolRunId: 'parent'
    } as NormalizedEvent)
    state = recv(state, {
      type: 'tool.call.completed',
      sessionId: 'plan-session',
      toolRunId: 'other',
      result: 'preserved result',
      isError: false
    })
    const before = state.messages[0].parts
    const after = recv(state, review(input)).messages[0].parts
    expect(after[0]).toMatchObject({ args: input })
    for (let index = 1; index < before.length; index++) expect(after[index]).toBe(before[index])
    for (const event of [
      review(input, { agentId: 'child' }),
      review(input, { toolUseId: 'missing' }),
      { ...review(input), sessionId: 'other-session' }
    ])
      expect(recv(state, event).messages).toBe(state.messages)
    const priorTurn = {
      ...state,
      messages: [...state.messages, { role: 'user' as const, createdAt: 2, parts: [] }]
    }
    expect(recv(priorTurn, review(input)).messages).toBe(priorTurn.messages)
  })

  it('permissionMode patch는 계획 카드·본문·입력을 보존하면서 실제 모드를 반영한다', () => {
    const input = { allowedPrompts: [], plan: '# 계획', planFilePath: 'C:\\plans\\a.md' }
    const state = recv(recv(initial(), started('exit', input)), review(input))
    const updated = recv(state, {
      type: 'session.updated',
      sessionId: 'plan-session',
      patch: { permissionMode: 'plan' }
    })
    expect(updated.permissionMode).toBe('plan')
    expect(updated.messages).toBe(state.messages)
    expect(updated.pendingPlanReview).toBe(state.pendingPlanReview)
    expect(updated.planContent).toBe(state.planContent)
    expectCards(
      updated.messages.flatMap((message) => message.parts),
      input
    )
  })
})
