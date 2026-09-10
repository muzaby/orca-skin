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
  extensions: { skills: [], hooks: { normalized: {} } }
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
async function run(script: Step[], request = req()): Promise<NormalizedEvent[][]> {
  h.state.script = script
  h.state.options = null
  const live = new ClaudeAdapter().sendMessage(request)
  const batches: NormalizedEvent[][] = []
  for await (const batch of live.eventBatches) batches.push(batch.events)
  return batches
}

const fireStop =
  (input: unknown = {}) =>
  async (): Promise<void> => {
    await stopCallback()(input, undefined, {})
  }

const firePrompt = (prompt: string) => async (): Promise<void> => {
  const callback = h.state.options?.hooks?.UserPromptSubmit?.[0]?.hooks[0]
  expect(callback, 'SDK가 숨기는 자동 입력을 받는 UserPromptSubmit hook').toBeDefined()
  await callback!({ hook_event_name: 'UserPromptSubmit', prompt }, undefined, {})
}

beforeEach(() => {
  h.queryMock.mockClear()
})

describe('ordinary output hook to response stream', () => {
  const outputStop = async (): Promise<void> => {
    for (const matcher of h.state.options?.hooks?.Stop ?? [])
      for (const hook of matcher.hooks)
        await hook(
          { hook_event_name: 'Stop', last_assistant_message: '[result](/tmp/result.md)' },
          undefined,
          {}
        )
  }
  const file = {
    publicationId: 'output-1',
    artifactFileId: 'file-1',
    title: 'Result',
    filename: 'result.md',
    kind: 'markdown' as const,
    category: 'file' as const,
    sizeBytes: 2,
    publishedAt: 1
  }
  const request = (): TurnRequest => ({
    ...req(),
    runtimeToolContext: {
      cwd: '/tmp',
      extraDirs: [],
      getSignal: () => new AbortController().signal,
      waitForSession: async () => 's1'
    },
    extensions: {
      ...req().extensions!,
      outputFiles: { directory: '/tmp', capture: vi.fn(async () => file) }
    }
  })
  it('drains Stop output after the response text and before its telemetry', async () => {
    const batches = await run([INIT, ASSISTANT, outputStop, RESULT], request())
    const flat = batches.flat()
    const outputIndex = flat.findIndex((event) => event.type === 'output.captured')
    expect(outputIndex).toBeGreaterThan(
      flat.findIndex((event) => event.type === 'message.completed')
    )
    expect(outputIndex).toBeLessThan(flat.findIndex((event) => event.type === 'telemetry'))
    expect(flat[outputIndex]).toEqual({ type: 'output.captured', sessionId: 's1', artifact: file })
  })
  it('retains a Write identity while waiting for the final response', async () => {
    const write = async (): Promise<void> => {
      for (const matcher of h.state.options?.hooks?.PostToolUse ?? [])
        for (const hook of matcher.hooks)
          await hook(
            {
              hook_event_name: 'PostToolUse',
              tool_name: 'Write',
              tool_use_id: 'write-original',
              tool_input: { file_path: '/tmp/result.md', content: 'ok' },
              tool_response: {}
            },
            'write-original',
            {}
          )
    }
    const batches = await run([INIT, write, ASSISTANT, RESULT], request())
    expect(batches.flat().filter((event) => event.type === 'output.captured')).toEqual([
      { type: 'output.captured', sessionId: 's1', artifact: file, toolRunId: 'write-original' }
    ])
  })
  it('does not assign a Stop capture without a result boundary to another response', async () => {
    const batches = await run([INIT, ASSISTANT, outputStop], request())
    expect(batches.flat().filter((event) => event.type === 'output.captured')).toEqual([])
  })
  it('does not attach a late Stop after a result to the next persistent response', async () => {
    const current = request()
    const batches = await run([INIT, ASSISTANT, RESULT, outputStop, ASSISTANT, RESULT], current)
    expect(current.extensions?.outputFiles?.capture).toHaveBeenCalledOnce()
    expect(batches.flat().filter((event) => event.type === 'output.captured')).toEqual([])
  })
  it('does not let background child text reopen the main response scope', async () => {
    const batches = await run(
      [
        INIT,
        ASSISTANT,
        RESULT,
        { ...ASSISTANT, parent_tool_use_id: 'background-task' },
        outputStop,
        ASSISTANT,
        RESULT
      ],
      request()
    )
    expect(batches.flat().filter((event) => event.type === 'output.captured')).toEqual([])
  })
  it('retains a Stop that races consumption of the initial assistant message', async () => {
    const batches = await run([INIT, outputStop, ASSISTANT, RESULT], request())
    expect(batches.flat().filter((event) => event.type === 'output.captured')).toHaveLength(1)
  })
  it('drops a capture interrupted after its hook completed and before the result', async () => {
    const controller = new AbortController()
    const current = request()
    current.runtimeToolContext = {
      ...current.runtimeToolContext!,
      getSignal: () => controller.signal
    }
    const batches = await run(
      [INIT, ASSISTANT, outputStop, async () => controller.abort(), RESULT],
      current
    )
    expect(current.extensions?.outputFiles?.capture).toHaveBeenCalledOnce()
    expect(batches.flat().filter((event) => event.type === 'output.captured')).toEqual([])
  })
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

  it('Stop 예약 스냅샷을 종료 배치의 telemetry보다 먼저 전달한다', async () => {
    const schedules = [
      { id: 'cron1', schedule: '*/5 * * * *', recurring: true, prompt: '빌드 확인' }
    ]
    const batches = await run([INIT, ASSISTANT, fireStop({ session_crons: schedules }), RESULT])
    const terminal = batches.at(-1)!

    expect(terminal[0]).toEqual({
      type: 'session.schedules',
      sessionId: 's1',
      schedules,
      pendingWakeup: false
    })
    expect(terminal.at(-1)).toEqual({ type: 'turn.ended', sessionId: 's1' })
    expect(terminal.some((event) => event.type === 'telemetry')).toBe(true)
  })

  it('명시적인 빈 예약 배열은 목록을 비우고, 누락/잘못된 배열은 목록을 지우지 않는다', async () => {
    const batches = await run([
      INIT,
      fireStop({ session_crons: [] }),
      RESULT,
      fireStop(),
      fireStop({ session_crons: [{ id: 'legacy', interval: '* * * * *' }] }),
      fireStop({ session_crons: null }),
      RESULT
    ])
    expect(batches.flat().filter((event) => event.type === 'session.schedules')).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules: [], pendingWakeup: false }
    ])
    expect(batches.flat().filter((event) => event.type === 'turn.ended')).toHaveLength(4)
  })

  it('마지막 SDK 메시지 이후의 Stop도 예약과 종료 신호를 함께 드레인한다', async () => {
    const schedules = [
      { id: 'loop1', schedule: '15 8 * * *', recurring: false, prompt: '/loop 확인' }
    ]
    const batches = await run([INIT, RESULT, fireStop({ session_crons: schedules })])
    expect(batches.at(-1)).toEqual([
      { type: 'session.schedules', sessionId: 's1', schedules, pendingWakeup: false },
      { type: 'turn.ended', sessionId: 's1' }
    ])
  })

  it.each([
    { schedules: undefined, stop: false },
    { schedules: undefined, stop: true },
    { schedules: [], stop: true },
    {
      schedules: [{ id: 'loop1', schedule: '15 8 * * *', recurring: false, prompt: '/loop 확인' }],
      stop: true
    }
  ])(
    '첫 wakeup 영수증은 Stop 전에 전달되고 유효한 전체 스냅샷만 대기 플래그를 해제한다 (%s)',
    async ({ schedules, stop }) => {
      const script: Step[] = [
        INIT,
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'wake1', name: 'ScheduleWakeup', input: { delaySeconds: 60 } }
            ]
          }
        },
        {
          type: 'user',
          tool_use_result: {
            scheduledFor: 1_900_000_000_000,
            clampedDelaySeconds: 60,
            wasClamped: false
          },
          message: {
            content: [{ type: 'tool_result', tool_use_id: 'wake1', content: 'scheduled' }]
          }
        },
        ...(!stop
          ? []
          : schedules !== undefined
            ? [fireStop({ session_crons: schedules })]
            : [fireStop({ session_crons: [{}] })]),
        RESULT,
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', id: 'delete1', name: 'CronDelete', input: { id: 'missing' } }
            ]
          }
        },
        {
          type: 'user',
          tool_use_result: { id: 'missing' },
          message: {
            content: [{ type: 'tool_result', tool_use_id: 'delete1', content: 'deleted' }]
          }
        }
      ]
      const batches = await run(script)
      expect(batches[2]).toContainEqual({
        type: 'session.schedules',
        sessionId: 's1',
        schedules: [],
        pendingWakeup: true
      })
      expect(batches.flat().filter((event) => event.type === 'session.schedules')).toEqual([
        { type: 'session.schedules', sessionId: 's1', schedules: [], pendingWakeup: true },
        ...(schedules !== undefined
          ? [{ type: 'session.schedules', sessionId: 's1', schedules, pendingWakeup: false }]
          : []),
        {
          type: 'session.schedules',
          sessionId: 's1',
          schedules: schedules ?? [],
          pendingWakeup: schedules === undefined
        }
      ])
    }
  )

  it.each([
    {
      name: 'ScheduleWakeup',
      input: { delaySeconds: 60 },
      output: { scheduledFor: 1_900_000_000_000 },
      terminal: true
    },
    {
      name: 'ScheduleWakeup',
      input: { delaySeconds: 60 },
      output: { scheduledFor: 1_900_000_000_000 },
      terminal: false
    },
    {
      name: 'CronCreate',
      input: { cron: '* * * * *', prompt: 'check' },
      output: { id: 'cron1', recurring: true },
      terminal: true
    },
    {
      name: 'CronCreate',
      input: { cron: '* * * * *', prompt: 'check' },
      output: { id: 'cron1', recurring: true },
      terminal: false
    }
  ])(
    'Stop callback이 $name 영수증 소비보다 앞서도 전체 목록이 마지막 정본이다 (terminal=$terminal)',
    async ({ name, input, output, terminal }) => {
      const batches = await run([
        INIT,
        {
          type: 'assistant',
          message: { content: [{ type: 'tool_use', id: 'pending1', name, input }] }
        },
        fireStop({ session_crons: [] }),
        {
          type: 'user',
          tool_use_result: output,
          message: {
            content: [{ type: 'tool_result', tool_use_id: 'pending1', content: 'scheduled' }]
          }
        },
        ...(terminal ? [RESULT] : [])
      ])
      const snapshots = batches.flat().filter((event) => event.type === 'session.schedules')
      expect(snapshots).toHaveLength(2)
      expect(snapshots.at(-1)).toEqual({
        type: 'session.schedules',
        sessionId: 's1',
        schedules: [],
        pendingWakeup: false
      })
      expect(batches.at(-1)?.[0]).toEqual(snapshots.at(-1))
      if (terminal) expect(batches.at(-1)?.at(-1)).toMatchObject({ type: 'telemetry' })
    }
  )

  it('Stop 스냅샷이 큐에 있는 채로 스트림이 실패해도 늦은 영수증 뒤에 정본을 적용한다', async () => {
    const batches = await run([
      INIT,
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'wake1', name: 'ScheduleWakeup', input: { delaySeconds: 60 } }
          ]
        }
      },
      fireStop({ session_crons: [] }),
      {
        type: 'user',
        tool_use_result: { scheduledFor: 1_900_000_000_000 },
        message: { content: [{ type: 'tool_result', tool_use_id: 'wake1', content: 'scheduled' }] }
      },
      async (): Promise<void> => {
        throw new Error('transport closed')
      }
    ])
    expect(batches.at(-1)?.[0]).toEqual({
      type: 'session.schedules',
      sessionId: 's1',
      schedules: [],
      pendingWakeup: false
    })
    expect(batches.at(-1)?.at(-1)).toMatchObject({ type: 'error' })
  })

  it('SDK가 user wire를 생략한 자동 입력도 첫 응답 전에 한 번 보존한다', async () => {
    const batches = await run([
      INIT,
      firePrompt('hello'),
      ASSISTANT,
      RESULT,
      firePrompt('정기 확인'),
      ASSISTANT,
      fireStop({ session_crons: [] }),
      RESULT
    ])
    const received = batches.flat().filter((event) => event.type === 'input.received')
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ text: '정기 확인', origin: { kind: 'automatic' } })
    expect(batches[3].map((event) => event.type)).toEqual(['input.received', 'message.completed'])
  })

  it('hook와 실제 channel wire를 합쳐 출처가 있는 메시지 하나만 보존한다', async () => {
    const batches = await run([
      INIT,
      firePrompt('hello'),
      ASSISTANT,
      RESULT,
      firePrompt('CI failed'),
      {
        type: 'user',
        message: { content: 'CI failed' },
        origin: { kind: 'channel', server: 'CI' },
        isReplay: true,
        uuid: 'channel-1'
      },
      ASSISTANT,
      RESULT
    ])
    expect(batches.flat().filter((event) => event.type === 'input.received')).toEqual([
      {
        type: 'input.received',
        sessionId: 's1',
        text: 'CI failed',
        origin: { kind: 'channel', label: 'CI' },
        uuid: 'channel-1'
      }
    ])
  })

  it('initial/prelude/후속/steer 실제 송신을 hook 자동수신에서 제외한다', async () => {
    h.state.script = [
      INIT,
      firePrompt('prelude\nhello'),
      ASSISTANT,
      RESULT,
      async () => {
        await live.pushTurn!({ ...req(), text: 'follow-up', promptUuid: 'follow' })
      },
      firePrompt('follow-up'),
      ASSISTANT,
      async () => {
        await h.state.options!.hooks!.PostToolBatch[0].hooks[0]({}, undefined, {})
      },
      firePrompt('steer'),
      ASSISTANT,
      RESULT,
      firePrompt('steer'),
      ASSISTANT,
      RESULT
    ]
    const live = new ClaudeAdapter().sendMessage({
      ...req(),
      preludes: [{ ids: ['p'], text: 'prelude', uuid: 'p', createdAt: 1 }],
      takeSteerFlush: () => ({ ids: ['s'], text: 'steer', uuid: 's', createdAt: 2 })
    })
    const events: NormalizedEvent[] = []
    for await (const batch of live.eventBatches) events.push(...batch.events)
    expect(events.filter((event) => event.type === 'error')).toEqual([])
    // 같은 문자열이 다음에 외부에서 재발화한 한 건만 남는다.
    expect(events.filter((event) => event.type === 'input.received')).toMatchObject([
      { text: 'steer', origin: { kind: 'automatic' } }
    ])
  })

  it('첫 모델 출력 전 provider 오류도 이미 수신한 자동 입력을 잃지 않는다', async () => {
    const batches = await run([
      INIT,
      firePrompt('외부 확인'),
      async () => {
        throw new Error('provider failed')
      }
    ])
    expect(batches.at(-1)?.map((event) => event.type)).toEqual(['input.received', 'error'])
  })
})
