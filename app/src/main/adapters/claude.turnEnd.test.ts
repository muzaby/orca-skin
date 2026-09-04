// 0211 라운드 5 — D25·D26 / VP-72 · §10 EP-46 ①②.
//
// `turn-end-hook.test.ts` 는 **팩토리**(`makeTurnEndHook`)만 잰다. 그래서 어댑터가 그 조각을
// `query` 옵션에 싣지 않아도(D25), 신호를 이벤트로 비우지 않아도(D26) 전 스위트가 초록이었다 —
// 계기의 시작점과 이벤트가 되는 자리가 무관측이었다.
//
// 여기서는 **claude.ts 자신**을 돌린다. fake SDK 스트림이 세 가지를 준다.
//   ① `query` 가 받은 실제 `options.hooks` — `Stop` 매처가 실렸는가(EP-46 ①).
//   ② 스트림 도중 `Stop` 발화 → 다음 SDK 메시지의 배치에 `turn.ended` 가 실리는가(EP-46 ②).
//   ③ 마지막 메시지 뒤 발화 → 꼬리 드레인이 그것을 흘리지 않는가(같은 지점의 형제 경로).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'

type HookCallback = (input: unknown, toolUseId: unknown, opts: unknown) => Promise<unknown>
type Step = Record<string, unknown> | (() => Promise<void>)

const h = vi.hoisted(() => {
  const state = {
    options: null as null | { hooks?: Record<string, { hooks: HookCallback[] }[]> },
    script: [] as Step[]
  }
  return {
    state,
    queryMock: vi.fn((args: { options?: Record<string, unknown> }) => {
      state.options = (args.options ?? {}) as (typeof state)['options']
      return {
        async *[Symbol.asyncIterator]() {
          for (const step of state.script) {
            if (typeof step === 'function') {
              await step()
              continue
            }
            yield step
          }
        },
        setPermissionMode: vi.fn(),
        interrupt: vi.fn(),
        setModel: vi.fn()
      }
    })
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: h.queryMock }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'

const INIT = { type: 'system', subtype: 'init', session_id: 's1', model: 'm' }
const ASSISTANT = {
  type: 'assistant',
  session_id: 's1',
  message: { content: [{ type: 'text', text: '안녕' }] }
}
const RESULT = {
  type: 'result',
  subtype: 'success',
  session_id: 's1',
  duration_ms: 10,
  is_error: false,
  num_turns: 1,
  usage: { input_tokens: 1, output_tokens: 1 }
}

const req = (): TurnRequest => ({
  sessionId: 's1',
  text: 'hello',
  cwd: '/tmp',
  extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
})

/** 어댑터가 SDK 에 **실제로 건넨** `Stop` 콜백. 배선이 없으면 여기서 이미 실패한다. */
function stopCallback(): HookCallback {
  const matchers = h.state.options?.hooks?.Stop
  expect(
    matchers,
    'query options 에 Stop 매처가 없다 — 계기의 시작점이 배선되지 않았다'
  ).toBeDefined()
  expect(matchers).toHaveLength(1)
  return matchers![0].hooks[0]
}

/** 한 턴을 끝까지 돌려 배치별 이벤트 타입을 모은다. */
async function run(script: Step[]): Promise<NormalizedEvent[][]> {
  h.state.script = script
  h.state.options = null
  const live = new ClaudeAdapter().sendMessage(req())
  const batches: NormalizedEvent[][] = []
  for await (const batch of live.eventBatches) batches.push(batch.events)
  return batches
}

const fireStop = () => async (): Promise<void> => {
  await stopCallback()({}, undefined, {})
}

beforeEach(() => {
  h.queryMock.mockClear()
})

describe('claude.ts 턴 종료 배선 (D25·D26 · VP-72 · EP-46 ①②)', () => {
  it('`query` 옵션에 `Stop` 매처를 싣는다 — 다른 hook 조각과 병합돼도 남는다', async () => {
    await run([INIT])

    const hooks = h.state.options?.hooks ?? {}
    // 형제 조각(PreToolUse 격리 가드)이 함께 실린다 — `Stop` 만 있는 조각을 통째로 잃은
    // 변이와 hooks 자체가 빈 변이를 구분한다.
    expect(Object.keys(hooks)).toContain('Stop')
    expect(Object.keys(hooks)).toContain('PreToolUse')
    expect(hooks.Stop).toHaveLength(1)
    expect(typeof hooks.Stop[0].hooks[0]).toBe('function')
  })

  it('스트림 도중 `Stop` 이 나면 **다음 배치**에 `turn.ended` 가 실린다', async () => {
    const batches = await run([INIT, ASSISTANT, fireStop(), RESULT])
    const types = batches.map((events) => events.map((event) => event.type))

    // 발화 전 배치에는 없고, 발화 뒤 첫 배치에 정확히 하나 있다.
    expect(types[1]).toEqual(['message.completed'])
    expect(types[2]).toContain('turn.ended')
    expect(types.flat().filter((type) => type === 'turn.ended')).toHaveLength(1)

    const ended = batches[2].find((event) => event.type === 'turn.ended')!
    // 세션 좌표가 붙는다 — 붙지 않으면 renderer 가 어느 세션의 계기인지 모른다.
    expect(ended).toEqual({ type: 'turn.ended', sessionId: 's1' })
  })

  it('마지막 메시지 뒤에 발화해도 꼬리 드레인이 흘리지 않는다', async () => {
    const batches = await run([INIT, RESULT, fireStop()])
    const flat = batches.flat()

    expect(flat.filter((event) => event.type === 'turn.ended')).toHaveLength(1)
    // 꼬리 배치는 별도 sequence 로 나온다 — result 배치에 끼워 넣은 것이 아니다.
    expect(batches[batches.length - 1].map((event) => event.type)).toEqual(['turn.ended'])
  })

  it('한 턴에 두 번 발화하면 계기도 둘이다 — 신호가 합쳐지지 않는다', async () => {
    const batches = await run([INIT, fireStop(), fireStop(), RESULT])

    expect(batches.flat().filter((event) => event.type === 'turn.ended')).toHaveLength(2)
  })
})
