// Harness 실행 구성의 cache·세대 fence·single-flight (0188 AC11~AC14).
//
// 여기서 잠그는 것은 **조용히 깨지는 종류**의 계약이다:
//   · 정적 구성이 network 를 만들지 않는가 (매 턴 hot path)
//   · 무효화 중 완료된 옛 요청이 낡은 token 을 cache 로 되살리지 않는가
//   · 한 caller 의 취소가 다른 caller 를 끌고 죽지 않는가
//
// augmenter 를 **deferred** 로 주입해 "resolve 시작 → invalidate → 완료" 순서를 결정론적으로
// 만든다. 타이머·실시간 대기를 쓰지 않는다.

import { describe, expect, it, vi } from 'vitest'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'
import {
  createHarnessRuntimeConfigService,
  StaleHarnessConfigError,
  type HarnessModelProviderEntry,
  type HarnessSettingsPort,
  type RuntimeConfigAugmenter
} from './runtime-config'

const ENTRY: HarnessModelProviderEntry = {
  key: 'claude-corp',
  harnessId: 'claude',
  modelProviderId: 'corp'
}

function settingsPort(revision: () => string): HarnessSettingsPort & { calls: number } {
  const port = {
    calls: 0,
    async resolve(): Promise<ResolvedHarnessSettings> {
      port.calls += 1
      return {
        providerKey: ENTRY.key,
        provider: ENTRY.modelProviderId,
        settings: { model: 'm' },
        sourceRevision: revision()
      }
    }
  }
  return port
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('정적 구성 (AC11)', () => {
  it('augmenter 가 없으면 runtimeEnv 가 비고 network 도 vault 도 건드리지 않는다', async () => {
    const settings = settingsPort(() => 'rev-1')
    const service = createHarnessRuntimeConfigService({ settings })

    const config = await service.resolve(ENTRY)

    expect(config.runtimeEnv).toEqual({})
    expect(config.settings?.settings).toEqual({ model: 'm' })
    // 유일한 I/O 는 기존 settings 해석 하나다.
    expect(settings.calls).toBe(1)
  })

  it('warm cache 는 augmenter 를 다시 부르지 않는다', async () => {
    const augment = vi.fn(async () => ({ runtimeEnv: { A: '1' } }))
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: { [ENTRY.key]: { resolve: augment } }
    })

    await service.resolve(ENTRY)
    await service.resolve(ENTRY)

    expect(augment).toHaveBeenCalledTimes(1)
  })
})

// 구 `turn-setup.test.ts` 가 잠그던 "미인증이면 그 키를 드롭한다(빈 문자열 치환 금지)" 의
// 0188 판. 소유자가 `llmEnvFor` → augmenter 로 바뀌었고 실패 방식이 **드롭에서 throw 로**
// 강해졌다 — 반쯤 채워진 환경으로 spawn 하면 증상이 원인에서 멀어지기 때문이다.
describe('미인증·불완전 응답은 fail-closed', () => {
  it('augmenter 가 실패하면 resolve 가 실패하고 부분 env 를 cache 하지 않는다', async () => {
    let fail = true
    const augment = vi.fn(async () => {
      if (fail) throw new Error('corp model provider authentication required')
      return { runtimeEnv: { TOKEN: 'live' } }
    })
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: { [ENTRY.key]: { resolve: augment } }
    })

    await expect(service.resolve(ENTRY)).rejects.toThrow('authentication required')

    // 실패는 성공 cache 처럼 보관되지 않는다 — 인증되면 다음 resolve 가 곧바로 값을 얻는다.
    fail = false
    await expect(service.resolve(ENTRY)).resolves.toMatchObject({
      runtimeEnv: { TOKEN: 'live' }
    })
    expect(augment).toHaveBeenCalledTimes(2)
  })

  it('실패한 turn 은 빈 문자열이 아니라 오류로 끝난다 — 조용한 미인증 진행 금지', async () => {
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: {
        [ENTRY.key]: {
          resolve: async () => {
            throw new Error('llm config request failed: 401')
          }
        }
      }
    })

    // 빈 overlay 로 성공시키면 토큰 없는 요청이 나가고 서버가 401 대신 이상한 오류를 준다.
    await expect(service.resolve(ENTRY)).rejects.toThrow('401')
  })
})

describe('sourceRevision (AC12)', () => {
  it('settings 파일 외부 편집(mtime 변화)이 cache miss 로 이어진다', async () => {
    let revision = 'rev-1'
    const augment = vi.fn(async () => ({ runtimeEnv: { A: revision } }))
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => revision),
      augmenters: { [ENTRY.key]: { resolve: augment } }
    })

    const first = await service.resolve(ENTRY)
    revision = 'rev-2'
    const second = await service.resolve(ENTRY)

    expect(augment).toHaveBeenCalledTimes(2)
    expect(first.runtimeEnv).toEqual({ A: 'rev-1' })
    expect(second.runtimeEnv).toEqual({ A: 'rev-2' })
  })
})

describe('만료 (validUntil)', () => {
  it('만료된 결과는 cache hit 가 아니다 — clock skew 여유를 둔다', async () => {
    let now = 0
    const augment = vi.fn(async () => ({ runtimeEnv: { T: String(now) }, validUntil: 60_000 }))
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: { [ENTRY.key]: { resolve: augment } },
      clock: () => now
    })

    await service.resolve(ENTRY)
    // 여유(30초) 안쪽으로 들어오면 이미 만료로 본다.
    now = 40_000
    await service.resolve(ENTRY)

    expect(augment).toHaveBeenCalledTimes(2)
  })
})

describe('generation fence (AC13)', () => {
  it('무효화 중 완료된 옛 resolve 는 cache 에도 caller 에도 가지 않는다', async () => {
    const first = deferred<{ runtimeEnv: Record<string, string> }>()
    const entered = deferred<void>()
    const later: { runtimeEnv: Record<string, string> } = { runtimeEnv: { TOKEN: 'new' } }
    let call = 0
    const augmenter: RuntimeConfigAugmenter = {
      resolve: async () => {
        call += 1
        if (call > 1) return later
        entered.resolve()
        return first.promise
      }
    }
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: { [ENTRY.key]: augmenter }
    })

    const pending = service.resolve(ENTRY)
    // 요청이 실제로 원격에 나간 뒤에 재인증이 끼어든다 — 그 창이 fence 가 지키는 구간이다.
    await entered.promise
    service.invalidate(ENTRY.key, 'auth-change')
    // 그제서야 옛 요청이 끝난다.
    first.resolve({ runtimeEnv: { TOKEN: 'stale' } })

    // 낡은 token 이 돌아오지 않는다 — 최신 세대로 재시도한 결과를 받는다.
    await expect(pending).resolves.toMatchObject({ runtimeEnv: { TOKEN: 'new' } })
    // cache 에도 낡은 값이 없다.
    await expect(service.resolve(ENTRY)).resolves.toMatchObject({ runtimeEnv: { TOKEN: 'new' } })
  })

  it('재시도를 소진하면 조용히 옛 값을 주지 않고 명시적으로 실패한다', async () => {
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: {
        [ENTRY.key]: {
          resolve: async () => {
            // 매번 완료 직전에 세대가 바뀌는 상황(연속 재인증).
            service.invalidate(ENTRY.key, 'auth-change')
            return { runtimeEnv: { TOKEN: 'x' } }
          }
        }
      },
      logger: () => undefined
    })

    await expect(service.resolve(ENTRY)).rejects.toBeInstanceOf(StaleHarnessConfigError)
  })
})

describe('single-flight 와 caller 취소 (AC14)', () => {
  it('같은 key·generation·sourceRevision 의 동시 요청은 한 번만 부른다', async () => {
    const gate = deferred<{ runtimeEnv: Record<string, string> }>()
    const augment = vi.fn(async () => gate.promise)
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: { [ENTRY.key]: { resolve: augment } }
    })

    const a = service.resolve(ENTRY)
    const b = service.resolve(ENTRY)
    gate.resolve({ runtimeEnv: { A: '1' } })

    await expect(a).resolves.toMatchObject({ runtimeEnv: { A: '1' } })
    await expect(b).resolves.toMatchObject({ runtimeEnv: { A: '1' } })
    expect(augment).toHaveBeenCalledTimes(1)
  })

  it('한 caller 의 취소가 다른 caller 의 정상 resolve 를 끌고 죽지 않는다', async () => {
    const gate = deferred<{ runtimeEnv: Record<string, string> }>()
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: { [ENTRY.key]: { resolve: async () => gate.promise } }
    })

    const controller = new AbortController()
    const cancelled = service.resolve(ENTRY, controller.signal)
    const survivor = service.resolve(ENTRY)
    controller.abort(new Error('caller gone'))

    await expect(cancelled).rejects.toThrow('caller gone')
    gate.resolve({ runtimeEnv: { A: '1' } })
    await expect(survivor).resolves.toMatchObject({ runtimeEnv: { A: '1' } })
  })

  it('invalidation 은 공유 operation 의 signal 을 abort 한다', async () => {
    let observed: AbortSignal | undefined
    const gate = deferred<{ runtimeEnv: Record<string, string> }>()
    const service = createHarnessRuntimeConfigService({
      settings: settingsPort(() => 'rev-1'),
      augmenters: {
        [ENTRY.key]: {
          resolve: async (_input, signal) => {
            observed = signal
            return gate.promise
          }
        }
      }
    })

    const pending = service.resolve(ENTRY).catch(() => undefined)
    await Promise.resolve()
    service.invalidate(ENTRY.key, 'auth-change')

    expect(observed?.aborted).toBe(true)
    gate.resolve({ runtimeEnv: {} })
    await pending
  })
})
