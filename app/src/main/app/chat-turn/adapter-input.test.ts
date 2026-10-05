// 0250 IT-02 — 실제 held 큐·main 요청 조립·runtime·Claude SDK 입력 사이의 배선을 본다.
// 테스트는 app 레이어에 두어 어댑터가 app/features를 참조하지 않도록 한다.
import { describe, expect, it, vi } from 'vitest'
import type { Options, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { WebContents } from 'electron'
import type { TurnContext } from '../../contracts/turn'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { buildTurnRequest } from './turn-request'

const sdk = vi.hoisted(() => ({
  prompt: null as AsyncIterable<SDKUserMessage> | null,
  options: null as Options | null,
  finish: null as (() => void) | null
}))

vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: { prompt: AsyncIterable<SDKUserMessage>; options: Options }) => {
    sdk.prompt = args.prompt
    sdk.options = args.options
    return {
      async *[Symbol.asyncIterator]() {
        yield { type: 'system', subtype: 'init', session_id: 's1', model: 'm' }
        yield {
          type: 'assistant',
          session_id: 's1',
          message: { content: [{ type: 'text', text: '응답 중' }] }
        }
        await new Promise<void>((resolve) => {
          sdk.finish = resolve
        })
      },
      setPermissionMode: vi.fn(async () => {}),
      setModel: vi.fn(async () => {}),
      interrupt: vi.fn(async () => undefined)
    }
  }
}))

import { ClaudeAdapter } from '../../adapters/claude'

describe('0250 IT-02 — 도구 경계 입력 무주입', () => {
  it('모든 PostToolBatch 훅을 반복해도 held 메시지는 SDK 입력으로 전송되지 않는다', async () => {
    const pendingMessages = new PendingMessageQueue()
    const turn = {
      dbSessionId: 's1',
      blockedSubagents: new Set<string>()
    } as TurnContext<WebContents>
    const request = buildTurnRequest(
      {
        wc: { isDestroyed: () => false, send: vi.fn() } as unknown as WebContents,
        pendingMessages,
        activity: {
          setResidualAttempts: vi.fn(),
          setSchedules: vi.fn()
        } as unknown as SessionActivityProjector,
        chainId: 'chain-1',
        queueKey: 's1',
        getActiveTurn: () => turn,
        getInitialBatches: () => [],
        settleDeadBackgroundTasks: async () => {}
      },
      {
        sessionId: 's1',
        text: 'initial',
        cwd: '/tmp',
        extensions: { skills: [], hooks: { normalized: {} } }
      }
    )
    const runtime = new SessionRuntime(new ClaudeAdapter())
    const response = (async () => {
      for await (const event of runtime.send(request)) void event
    })()
    await vi.waitFor(() => expect(sdk.finish).not.toBeNull())
    expect(runtime.responding).toBe(true)
    const input = sdk.prompt![Symbol.asyncIterator]()
    expect((await input.next()).value.message.content).toBe('initial')

    pendingMessages.enqueue('s1', { text: 'first' }, 1, 'first-id')
    pendingMessages.enqueue('s1', { text: 'second' }, 2, 'second-id')
    let heldIds: string[] = []
    try {
      for (let boundary = 0; boundary < 3; boundary += 1) {
        for (const matcher of sdk.options?.hooks?.PostToolBatch ?? []) {
          for (const hook of matcher.hooks) {
            await hook(
              {
                hook_event_name: 'PostToolBatch',
                session_id: 's1',
                transcript_path: '',
                cwd: '/tmp',
                tool_calls: []
              },
              undefined,
              { signal: new AbortController().signal }
            )
          }
        }
      }
      heldIds = pendingMessages.pending('s1').map((item) => item.id)
    } finally {
      runtime.close()
      sdk.finish?.()
      await response
    }
    // close 이후에도 스트림의 이미 적재된 입력은 drain되므로 무주입을 직접 관측할 수 있다.
    const additionalInputs: SDKUserMessage[] = []
    for (;;) {
      const next = await input.next()
      if (next.done) break
      additionalInputs.push(next.value)
    }
    expect(additionalInputs).toEqual([])
    expect(heldIds).toEqual(['first-id', 'second-id'])
  })
})
