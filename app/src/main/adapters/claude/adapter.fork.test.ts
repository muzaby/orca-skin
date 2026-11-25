import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { loadClaudeSdk } from './sdk'
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

import { ClaudeAdapter } from './adapter'
import type { TurnRequest } from '../common/turn'
import type { LiveTurn, ProviderMessageBatch } from '../common/types'
import type { NormalizedEvent, ProviderReportedTelemetry } from '../../../shared/ipc'
import { sendPrepared } from './prepared.testfixture'

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp',
  extensions: {
    skills: [],
    hooks: { normalized: {} }
  }
})

type QueryOptions = Pick<Options, 'resume' | 'forkSession' | 'sessionId' | 'hooks'>
const lastOptions = (): QueryOptions =>
  (queryMock.mock.calls.at(-1)?.[0] as { options: QueryOptions }).options

describe('ClaudeAdapter — forkFrom (0064)', () => {
  it('recreates an expired conversation with a new native UUID and hides archived context in its receipt', async () => {
    const adapter = new ClaudeAdapter()
    const sessionId = 'display-session'
    const { sessionId: nativeId, freshStart } = await adapter.recoverSession({
      sessionId,
      cwd: '/tmp'
    })
    expect(nativeId).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
    expect(nativeId).not.toBe(sessionId)
    expect(freshStart).toBe(true)
    const onPrompt = vi.fn()
    sdkMessages.queue = [
      {
        type: 'user',
        session_id: nativeId,
        uuid: 'recovery-prompt',
        message: { role: 'user', content: 'archived context + hello' }
      }
    ]
    const live = await sendPrepared(adapter, {
      ...baseReq(),
      sessionId,
      nativeSessionId: nativeId,
      promptUuid: 'recovery-prompt',
      recovery: { history: 'archived context', freshStart: true, onPrompt }
    })
    expect(lastOptions()).toMatchObject({ sessionId: nativeId })
    expect(lastOptions().resume).toBeUndefined()
    expect(onPrompt).toHaveBeenCalledWith('recovery-prompt')
    const prompt = (
      queryMock.mock.calls.at(-1)![0] as {
        prompt: AsyncIterable<{ message: { content: unknown } }>
      }
    ).prompt
    const first = await prompt[Symbol.asyncIterator]().next()
    expect(JSON.stringify(first.value.message.content)).toContain('archived context')
    const events: NormalizedEvent[] = []
    for await (const batch of live.eventBatches) events.push(...batch.events)
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'input.echo', text: 'hello', uuid: 'recovery-prompt' })
    )
    live.close()
  })
  it.each([false, true])(
    'routes resumed events, permissions and hooks to the display session (recovered=%s)',
    async (recovered) => {
      const sessionId = 'display-session'
      const nativeId = recovered ? '1858689d-6d68-4fc5-990c-54e81fe5e73d' : sessionId
      const permission = vi.fn()
      const hook = vi.fn(async () => ({}))
      sdkMessages.queue = [
        { type: 'system', subtype: 'init', session_id: nativeId, permissionMode: 'acceptEdits' },
        {
          type: 'system',
          subtype: 'task_started',
          session_id: nativeId,
          task_id: 'task',
          description: 'work'
        }
      ]
      const live = await sendPrepared(new ClaudeAdapter(), {
        ...baseReq(),
        sessionId,
        ...(recovered ? { nativeSessionId: nativeId } : {}),
        onPermissionModeChanged: permission,
        extensions: { skills: [], hooks: { normalized: { 'on-prompt': [hook] } } }
      })
      const options = lastOptions()
      expect(options.resume).toBe(nativeId)
      expect(options.sessionId).toBeUndefined()
      const callback = options.hooks!.UserPromptSubmit![0].hooks[0]
      for (const rawId of [nativeId, 'unrelated']) {
        await callback(
          { session_id: rawId, hook_event_name: 'UserPromptSubmit', prompt: 'test' } as Parameters<
            typeof callback
          >[0],
          undefined,
          { signal: new AbortController().signal }
        )
        expect(hook).toHaveBeenLastCalledWith(
          expect.objectContaining({
            sessionId: rawId === nativeId ? sessionId : rawId,
            raw: expect.objectContaining({ session_id: rawId })
          })
        )
      }
      const batches: ProviderMessageBatch[] = []
      for await (const batch of live.eventBatches) batches.push(batch)
      expect(batches.flatMap((b) => b.events)).toContainEqual(
        expect.objectContaining({ type: 'session.updated', sessionId })
      )
      const provider = batches.flatMap((b) => b.providerEvents ?? [])
      expect(provider).toContainEqual(
        expect.objectContaining({
          type: 'provider.message',
          sessionId,
          raw: expect.objectContaining({ subtype: 'task_started', session_id: nativeId })
        })
      )
      expect(provider.every((event) => event.sessionId === sessionId)).toBe(true)
      expect(permission).toHaveBeenCalledWith(sessionId, 'accept_edits')
      live.close()
    }
  )

  it('forkFrom 을 resume + forkSession:true 로 어댑트한다 (sessionId=null 새 세션 의미론)', async () => {
    const adapter = new ClaudeAdapter()
    await sendPrepared(adapter, { ...baseReq(), forkFrom: 'src-session' })
    expect(lastOptions().resume).toBe('src-session')
    expect(lastOptions().forkSession).toBe(true)
  })

  it('forkFrom 부재 시 기존 resume 경로 무회귀(forkSession 미주입)', async () => {
    const adapter = new ClaudeAdapter()
    await sendPrepared(adapter, { ...baseReq(), sessionId: 'resume-id' })
    expect(lastOptions().resume).toBe('resume-id')
    expect(lastOptions().forkSession).toBeUndefined()

    await sendPrepared(adapter, baseReq())
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

  it('handoff:true 는 query 옵션(resume+forkSession)을 바꾸지 않는다', async () => {
    const adapter = new ClaudeAdapter()
    await sendPrepared(adapter, { ...baseReq(), forkFrom: 'src-session', handoff: true })
    expect(lastOptions().resume).toBe('src-session')
    expect(lastOptions().forkSession).toBe(true)
  })

  it('handoff:true 면 MapContext(handoffArrival)로 전달돼 telemetry 컨텍스트 3종이 제거된다', async () => {
    const adapter = new ClaudeAdapter()
    sdkMessages.queue = inheritedContextStream()
    const usage = await telemetryOf(
      await sendPrepared(adapter, { ...baseReq(), forkFrom: 'src-session', handoff: true })
    )
    expect(usage?.inputTokens).toBeUndefined()
    expect(usage?.cacheReadTokens).toBeUndefined()
    expect(usage?.cacheCreationTokens).toBeUndefined()
    expect(usage?.costUsd).toBe(0.4)
  })

  it('handoff 미설정 fork 는 기존대로 컨텍스트 usage 를 승계한다 (무회귀)', async () => {
    const adapter = new ClaudeAdapter()
    sdkMessages.queue = inheritedContextStream()
    const usage = await telemetryOf(
      await sendPrepared(adapter, { ...baseReq(), forkFrom: 'src-session' })
    )
    expect(usage?.inputTokens).toBe(1200)
    expect(usage?.cacheReadTokens).toBe(150_000)
  })
})

// Exercise the warm channel path; sdk.test.ts covers the cold import boundary.
await loadClaudeSdk()
