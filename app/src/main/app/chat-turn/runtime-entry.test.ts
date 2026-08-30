// AC14 · WP-12 — **폴백이 살아 있는 채널을 실제로 내리는가.**
//
// `respawn-policy.test.ts` 는 판정 규칙을, `respawn-inputs.test.ts` 는 조립을, `send.worktree.test.ts`
// 는 send → `acquireTurnRuntime` 전달을 잠근다. 이 파일은 그 사슬의 **마지막 두 홉**이다 —
// 입력을 `respawnInputs` 에 싣는 자리(`runtime-entry.ts:88`)와 판정 결과로 `teardownChannel()` 을
// 부르는 자리(`:92`). verify r2 는 둘 다 지워도 `src/main` 1793 케이스가 전건 green 임을 관측했다
// (변이 M-E · M-F). cwd 는 spawn 인자라 채널을 안 내리면 다음 send 가 죽은 경로에서 계속 돈다.
//
// 다른 다섯 축(provider·model·settings·env·tools revision)은 **전부 unchanged** 로 고정한다 —
// 하나라도 흔들리면 teardown 이 그 축 때문에 일어난 것인지 이 축 때문인지 구별되지 않는다.

import { describe, expect, it, vi } from 'vitest'
import type { TurnContext } from '../../contracts/turn'
import type { TurnExtensions } from '../../adapters/turn'
import type { PreparedHarnessConfig } from '../../adapters/harness-config'
import { acquireTurnRuntime } from './runtime-entry'

const PROVIDER = 'claude:test'
const MODEL = 'sonnet'
const TOOLS_REVISION = 7

// `SessionRuntime` 을 구조적으로 만족하는 최소 fake. spawn 기록 5필드가 `respawnInputs` 의 입력이고
// `teardownChannel` 이 이 pair 의 관측점이다 — 실제로 채널이 내려간 것처럼 `channelAlive` 도 끈다.
function makeRuntime(): {
  channelAlive: boolean
  spawnedModel: string
  spawnedProviderSettings: undefined
  spawnedRuntimeEnvFingerprint: undefined
  spawnedRuntimeToolsRevision: number
  teardownChannel: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
} {
  const runtime = {
    channelAlive: true,
    spawnedModel: MODEL,
    spawnedProviderSettings: undefined,
    spawnedRuntimeEnvFingerprint: undefined,
    spawnedRuntimeToolsRevision: TOOLS_REVISION,
    teardownChannel: vi.fn(() => {
      runtime.channelAlive = false
    }),
    close: vi.fn()
  }
  return runtime
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeDeps(runtime: ReturnType<typeof makeRuntime>) {
  return {
    supervisor: {
      acquireRuntime: vi.fn(() => runtime),
      activateChain: vi.fn(() => true)
    },
    lease: { controller: new AbortController(), leaseId: 'lease-1', control: {} },
    adapter: {},
    buildExtensions: vi.fn(
      () => ({ runtimeTools: { revision: TOOLS_REVISION } }) as unknown as TurnExtensions
    ),
    settleDeadBackgroundTasks: vi.fn(async () => undefined),
    onRuntimeAcquired: vi.fn()
  }
}

const prepared = {
  providerSettings: undefined,
  runtimeEnvFingerprint: undefined
} as unknown as PreparedHarnessConfig

const turn = {} as unknown as TurnContext<never>

async function acquire(
  runtime: ReturnType<typeof makeRuntime>,
  extra: { executionCwdRecovered?: boolean }
): Promise<ReturnType<typeof makeDeps>> {
  const deps = makeDeps(runtime)
  await acquireTurnRuntime(deps as never, turn, {
    sessionId: 'session-1',
    resolved: { providerKey: PROVIDER, prepared, model: MODEL },
    sessionProviderKey: PROVIDER,
    ...extra
  })
  return deps
}

describe('acquireTurnRuntime — worktree 소실 폴백은 살아 있는 채널을 내린다 (AC14 · WP-12)', () => {
  it('폴백 턴이면 teardownChannel 을 정확히 한 번 부른다', async () => {
    const runtime = makeRuntime()

    const deps = await acquire(runtime, { executionCwdRecovered: true })

    expect(runtime.teardownChannel).toHaveBeenCalledOnce()
    expect(runtime.channelAlive).toBe(false)
    // 0136 — 콜드 spawn 경계에서 미정착 태스크를 정리한다. teardown 이 실제로 일어났다는
    // 하류 관측이기도 하다(spy 호출만 보면 채널 상태는 안 보인다).
    expect(deps.settleDeadBackgroundTasks).toHaveBeenCalledOnce()
  })

  it('폴백이 아니면 부르지 않는다 — 이 방향이 없으면 항상 내리는 구현도 초록이다', async () => {
    const runtime = makeRuntime()

    const deps = await acquire(runtime, { executionCwdRecovered: false })

    expect(runtime.teardownChannel).not.toHaveBeenCalled()
    expect(runtime.channelAlive).toBe(true)
    expect(deps.settleDeadBackgroundTasks).not.toHaveBeenCalled()
  })

  it('필드가 없으면 폴백이 아닌 것으로 읽는다 — 자동 연속 턴이 그 경로다', async () => {
    const runtime = makeRuntime()

    await acquire(runtime, {})

    expect(runtime.teardownChannel).not.toHaveBeenCalled()
  })
})
