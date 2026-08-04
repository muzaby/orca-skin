// 0064 continuity — TurnRequest.forkFrom 이 SDK query 옵션(resume+forkSession)으로
// 어댑트되는지 배선 단위 검증(claude.effort.test.ts 패턴).
import { describe, it, expect, vi } from 'vitest'

const { queryMock, sdkMessages } = vi.hoisted(() => {
  // 테스트가 밀어넣는 SDK 출력 스트림(호출마다 스냅샷 소비) — 기본 빈 배열(기존 케이스 무영향).
  const sdkMessages: { queue: unknown[] } = { queue: [] }
  return {
    sdkMessages,
    queryMock: vi.fn((req: unknown) => {
      void req
      const batch = sdkMessages.queue
      sdkMessages.queue = []
      let i = 0
      const iterable = {
        [Symbol.asyncIterator](): AsyncIterator<unknown> {
          return {
            next: async () =>
              i < batch.length
                ? { done: false, value: batch[i++] }
                : { done: true, value: undefined }
          }
        }
      } as AsyncIterable<unknown> & {
        setPermissionMode: () => void
        interrupt: () => void
        setModel: () => void
      }
      iterable.setPermissionMode = vi.fn()
      iterable.interrupt = vi.fn()
      iterable.setModel = vi.fn()
      return iterable
    })
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock
}))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'
import type { LiveTurn } from './types'
import type { ProviderReportedTelemetry } from '../../shared/ipc'

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp',
  extensions: {
    mcp: {},
    skills: [],
    hooks: { normalized: {} }
  }
})

type QueryOptions = { resume?: string; forkSession?: boolean }
const lastOptions = (): QueryOptions =>
  (queryMock.mock.calls.at(-1)?.[0] as { options: QueryOptions }).options

describe('ClaudeAdapter — forkFrom (0064)', () => {
  it('forkFrom 을 resume + forkSession:true 로 어댑트한다 (sessionId=null 새 세션 의미론)', () => {
    const adapter = new ClaudeAdapter()
    adapter.sendMessage({ ...baseReq(), forkFrom: 'src-session' })
    expect(lastOptions().resume).toBe('src-session')
    expect(lastOptions().forkSession).toBe(true)
  })

  it('forkFrom 부재 시 기존 resume 경로 무회귀(forkSession 미주입)', () => {
    const adapter = new ClaudeAdapter()
    adapter.sendMessage({ ...baseReq(), sessionId: 'resume-id' })
    expect(lastOptions().resume).toBe('resume-id')
    expect(lastOptions().forkSession).toBeUndefined()

    adapter.sendMessage(baseReq())
    expect(lastOptions().resume).toBeUndefined()
    expect(lastOptions().forkSession).toBeUndefined()
  })
})

describe('ClaudeAdapter — handoff 도착 턴 (0127)', () => {
  // 승계 컨텍스트(150k)가 실린 assistant + result — 핸드오프 telemetry 오염 재현 입력.
  const inheritedContextStream = (): unknown[] => [
    {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'summary...' }],
        usage: { input_tokens: 1200, output_tokens: 3000, cache_read_input_tokens: 150_000 }
      }
    },
    {
      type: 'result',
      total_cost_usd: 0.4,
      usage: { input_tokens: 1200, output_tokens: 3000, cache_read_input_tokens: 150_000 }
    }
  ]

  const telemetryOf = async (live: LiveTurn): Promise<ProviderReportedTelemetry | undefined> => {
    for await (const batch of live.eventBatches) {
      const telemetry = batch.events.find((ev) => ev.type === 'telemetry')
      if (telemetry?.type === 'telemetry') return telemetry.usage
    }
    return undefined
  }

  it('handoff:true 는 query 옵션(resume+forkSession)을 바꾸지 않는다', () => {
    const adapter = new ClaudeAdapter()
    adapter.sendMessage({ ...baseReq(), forkFrom: 'src-session', handoff: true })
    expect(lastOptions().resume).toBe('src-session')
    expect(lastOptions().forkSession).toBe(true)
  })

  it('handoff:true 면 MapContext(handoffArrival)로 전달돼 telemetry 컨텍스트 3종이 제거된다', async () => {
    const adapter = new ClaudeAdapter()
    sdkMessages.queue = inheritedContextStream()
    const usage = await telemetryOf(
      adapter.sendMessage({ ...baseReq(), forkFrom: 'src-session', handoff: true })
    )
    expect(usage?.inputTokens).toBeUndefined()
    expect(usage?.cacheReadTokens).toBeUndefined()
    expect(usage?.cacheCreationTokens).toBeUndefined()
    expect(usage?.costUsd).toBe(0.4)
  })

  it('handoff 미설정 fork 는 기존대로 컨텍스트 usage 를 승계한다 (무회귀)', async () => {
    const adapter = new ClaudeAdapter()
    sdkMessages.queue = inheritedContextStream()
    const usage = await telemetryOf(adapter.sendMessage({ ...baseReq(), forkFrom: 'src-session' }))
    expect(usage?.inputTokens).toBe(1200)
    expect(usage?.cacheReadTokens).toBe(150_000)
  })
})
