# 0255 — 날짜 경계에서 기존 Auth 자연 만료를 관측한 증거

이 문서는 실제 production 반례와 재현 코드만 보존한다. Decision·AC·V·§10의 규범을 정정하지 않는다.
2026-10-07 사용자는 기존 자연 만료를 유지하고 일일 정책의 직접 변경·직접 방송으로 범위를 한정하는 계획 정정을 승인했다.
이 증거가 정정을 요구한 대상은 [plan.md](plan.md)의 V1 D-002·AC1·AC5·EP-01·EP-05다. 아래의 정정 전 엄격 단언2 red 관측과 원문 코드는 그대로 보존한다.

## 관측한 production 경로

createGate.lapseDay → BoundAuth.snapshot → AuthRuntime.snapshot → AuthStore.settleExpiry →
settleExpired → expired snapshot publish → 기존 createRuntimeModelAuthChangeHandler →
pushConnectionState·Plugin sync·Harness invalidate → 일일 정책의 직접 push 순이다.

실제 자리: app/src/main/features/gate/index.ts:131, features/auth/runtime.ts:126,
features/auth/store.ts:393·429, app/runtime-model-startup.ts:102·106·107.
Auth snapshot을 읽는 동안 자정과 자연 만료가 겹치면 기존 정착이 실행된다.

## 실제 관측

재현은 synthetic gate의 OAuth token 만료를 다음 로컬 자정으로 두고, 실제 AuthRuntime·createGate·
startDailyGate·기존 change handler를 연결했다. 서버 요청·authorize가 실행되면 던지는 포트를 주입했다.
관측 산출은 .tmp/daily-expiry-observation.json이다.

| 항목 | 관측 |
|---|---|
| 경계 전 snapshot | status valid · verified true · credentialRevision 0 |
| 경계 후 snapshot | status expired · verified false · credentialRevision 1 |
| 일일 정책의 직접 push | 1 |
| 전체 방송 | 2 — 자연 만료 Auth 방송1 + 일일 정책 방송1 |
| expired 이벤트 / credential-effective expired 이벤트 | 각각1 |
| grant 영속 save | 1 |
| Plugin sync / Harness invalidate | 각각1 |
| 각 방송의 dailyRelogin | 첫 방송 [] · 둘째 방송 ['gate'] |
| 순서 로그 | event:expired → push → sync → invalidate → reconcile → policy-push → push |

실행 결과는 3케이스 중 관측 케이스1 green·기존 AC의 직접 단언2 red다.
기존 AC5의 snapshot 동등 단언은 valid/true/rev0와 expired/false/rev1의 차이로 실패했고,
AC1의 전체 방송1 단언은 실제 방송2 때문에 실패했다. 의도한 반례이므로 exit1이 예상 결과다.

## 재현 절차

1. 해당 구현을 체크아웃한 저장소에서 app/node_modules가 준비됐는지 확인한다. .tmp는 gitignored라 새 checkout에 없을 수 있으므로 저장소 루트에서 New-Item -ItemType Directory -Path '.tmp' -Force를 실행한다.
2. 저장소 루트에서 Test-Path -LiteralPath 'app/src/main/app/daily-gate.expiry-probe.test.ts'를 실행한다. true면 기존 파일을 덮어쓰지 않고 중지하며, false일 때만 아래 TypeScript 원문을 그 임시 파일로 저장한다.
3. app 디렉터리에서 다음 필터를 실행한다: node node_modules/vitest/vitest.mjs run src/main/app/daily-gate.expiry-probe.test.ts
4. 관측1 pass·단언2 fail과 .tmp/daily-expiry-observation.json의 위 값을 확인한다. 임시 테스트의 목적은 충돌 관측이며 전체 앱 테스트의 실패 수에 섞지 않는다.
5. 저장소 루트에서 이번 재현으로 만든 임시 테스트만 정리한다: Remove-Item -LiteralPath 'app/src/main/app/daily-gate.expiry-probe.test.ts'

표식·만료 정착을 우회하거나 실제 production 파일을 고칠 필요는 없다.
원문은 아래 코드이며 .tmp 파일 없이도 분리 환경에서 다시 저장해 재현할 수 있다.

임시 테스트의 위치는 상대 import를 실제 main 모듈에 연결하는 app/src/main/app/이다.
원문의 writeFileSync는 import.meta.url 기준 '../../../../.tmp/daily-expiry-observation.json'을
그대로 사용한다. 이 테스트 파일 위치에서 상위 경로를 해석하면 저장소 루트의 .tmp가 되며,
app cwd의 단독 vitest 실행에서도 출력 위치는 테스트 모듈 URL을 기준으로 결정된다.

## TypeScript 원문

```ts
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AuthChange, AuthDefinition } from '../contracts/auth'
import { createVault } from '../infra/vault'
import { createMemoryGrantPersistence } from '../features/auth/store'
import { createAuthRuntime } from '../features/auth/runtime'
import { createGate } from '../features/gate'
import { createRuntimeModelAuthChangeHandler } from './runtime-model-startup'
import { startDailyGate } from './daily-gate'

async function probe() {
  let now = new Date(2026, 9, 7, 23, 59, 59).getTime()
  const midnight = new Date(2026, 9, 8).getTime()
  const secrets = new Map<string, string>()
  const vault = createVault({
    get: (key) => secrets.get(key),
    set: (key, value) => void secrets.set(key, value),
    delete: (key) => void secrets.delete(key)
  })
  vault.set('gate:token', 'seed-token', { kind: 'oauth', createdAt: now, expiresAt: midnight })
  const memoryPersistence = createMemoryGrantPersistence({
    gate: { kind: 'token', vaultKey: 'gate:token', authKind: 'oauth', createdAt: now, expiresAt: midnight }
  })
  let persistenceWrites = 0
  const definition: AuthDefinition = {
    id: 'gate', label: 'Gate', origin: 'https://gate.example.corp',
    probe: { onResume: true, execute: async () => ({ ok: true, rejected: false }) },
    methods: [{
      kind: 'oauth', label: 'OAuth',
      present: { location: 'header', name: 'Authorization', scheme: 'bearer' },
      authorize: async () => { throw new Error('probe must not authorize') }
    }]
  }
  const { runtime } = createAuthRuntime({
    definitions: [definition],
    persistence: {
      load: () => memoryPersistence.load(),
      save: (records) => { persistenceWrites++; return memoryPersistence.save(records) }
    },
    vault,
    clock: () => now,
    fetchImpl: (async () => { throw new Error('probe must not fetch') }) as typeof fetch
  })
  await runtime.resume('gate')
  const bound = runtime.bind('gate')
  const gate = createGate({ members: [bound], bypass: () => false })
  const beforeSnapshot = bound.snapshot()
  const beforeGate = gate.state()
  expect(beforeSnapshot).toMatchObject({ status: 'valid', verified: true, credentialRevision: 0 })
  expect(beforeGate.passed).toBe(true)
  persistenceWrites = 0
  const log: string[] = []
  const changes: AuthChange[] = []
  const broadcasts: ReturnType<typeof gate.state>[] = []
  const pushConnectionState = (): void => {
    log.push('push')
    broadcasts.push(gate.state())
  }
  const handler = createRuntimeModelAuthChangeHandler({
    recordGateLogin: (authId, revision) => { log.push('gate-login'); gate.noteLoginCommit(authId, revision) },
    pushConnectionState,
    syncPlugins: () => log.push('sync'),
    invalidateForAuth: () => log.push('invalidate'),
    reconcileSnapshot: () => log.push('reconcile')
  })
  const unsubscribe = runtime.subscribe((change) => {
    changes.push(change)
    if (change.kind === 'snapshot') log.push(`event:${change.cause}`)
    handler(change)
  })
  let timer: (() => void) | undefined
  let policyPushes = 0
  const daily = startDailyGate({
    gate,
    pushConnectionState: () => { policyPushes++; log.push('policy-push'); pushConnectionState() },
    now: () => now,
    setTimer: (callback) => { timer = callback; return 1 },
    clearTimer: () => { timer = undefined },
    subscribeWake: () => () => undefined
  })
  now = midnight
  timer!()
  const observation = {
    beforeSnapshot,
    afterSnapshot: bound.snapshot(),
    beforeGate,
    afterGate: gate.state(),
    broadcastCount: broadcasts.length,
    policyPushes,
    broadcasts,
    expiryEvents: changes.filter((change) => change.kind === 'snapshot' && change.cause === 'expired').length,
    effectiveExpiry: changes.filter((change) => change.kind === 'snapshot' && change.cause === 'expired' && change.credentialChanged).length,
    syncCount: log.filter((entry) => entry === 'sync').length,
    invalidateCount: log.filter((entry) => entry === 'invalidate').length,
    persistenceWrites,
    log
  }
  daily.dispose()
  unsubscribe()
  return observation
}

describe('daily boundary natural expiry counterexample', () => {
  it('observes existing expiry settlement, reentrant broadcast, and exactly one direct daily push', async () => {
    const observed = await probe()
    writeFileSync(new URL('../../../../.tmp/daily-expiry-observation.json', import.meta.url), JSON.stringify(observed, null, 2))
    expect(observed).toMatchObject({
      afterSnapshot: { status: 'expired', verified: false, credentialRevision: 1 },
      broadcastCount: 2,
      policyPushes: 1,
      expiryEvents: 1,
      effectiveExpiry: 1,
      syncCount: 1,
      invalidateCount: 1,
      persistenceWrites: 1,
      log: ['event:expired', 'push', 'sync', 'invalidate', 'reconcile', 'policy-push', 'push']
    })
    expect(observed.broadcasts.map((state) => state.dailyRelogin)).toEqual([[], ['gate']])
  })

  it('AC5 literal snapshot invariance is red when the same boundary first observes natural expiry', async () => {
    const observed = await probe()
    expect(observed.afterSnapshot).toEqual(observed.beforeSnapshot)
  })

  it('AC1 literal total broadcast count one is red because expiry publishes through the existing handler', async () => {
    const observed = await probe()
    expect(observed.broadcastCount).toBe(1)
  })
})

```
