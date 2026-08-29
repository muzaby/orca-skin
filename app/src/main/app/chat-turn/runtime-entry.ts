// 런타임 확보 · respawn 판정 (0179 에서 분해).
//
// 세션 채널은 장수명이 기본이다(0067) — idle 핸들이 살아 있으면 재사용하고, 아니면 새로 연다.
// 다만 **살아 있는 채널을 그대로 쓰면 안 되는 경우가 넷** 있어서 여기서 한 번에 판정한다.
// 판정 자체는 순수 모듈(`features/sessions/respawn-policy`)이 갖고, 여기는 입력 수집과 실행만.

import type { WebContents } from 'electron'
import type { TurnContext } from '../../contracts/turn'
import type { TurnExtensions } from '../../adapters/turn'
import type { PreparedHarnessConfig } from '../../adapters/harness-config'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import { decideRespawn } from '../../features/sessions/respawn-policy'
import { SessionRuntime } from '../../features/sessions/session-runtime'
import { respawnInputs } from './respawn-inputs'
import type { SessionChainLease } from '../../features/sessions/session-chain-lease'
import type { RuntimeSupervisor } from '../../features/sessions/supervisor'

interface RuntimeEntryDeps {
  supervisor: RuntimeSupervisor<WebContents>
  lease: SessionChainLease<WebContents>
  adapter: RuntimeSessionAdapter
  buildExtensions: () => TurnExtensions
  settleDeadBackgroundTasks: (turn: TurnContext<WebContents>, sessionId: string) => Promise<void>
  // 핸들을 **인출한 순간** 호출자에게 공개한다. 반환값으로만 넘기면 이 함수가 그 뒤에서
  // throw 할 때(확장 조립·미정착 태스크 정착) 호출자의 finally 가 닫을 대상을 못 본다.
  // `leaderTurn` 과 같은 축이다 — 등록·인출과 반납 조건 대입이 한 지점이어야 한다.
  onRuntimeAcquired?: (runtime: SessionRuntime) => void
}

// `runtime` 은 **호출자가 계속 소유하는 핸들**이다 — 실패해도 돌려주는 이유는 그 때문이다.
//  · `ok:true`  — 정상. `extensions` 가 함께 온다.
//  · `ok:false` + `runtime:null` — 아직 안 만들었거나(중단) 활성화에 실패해 **여기서 close 완료**.
//  · `ok:false` + `runtime` 있음 — 활성화까지 마친 뒤 중단됐다. 호출자의 finally 가 반납해야 한다.
type RuntimeEntry =
  | { ok: true; runtime: SessionRuntime; extensions: TurnExtensions }
  | { ok: false; runtime: SessionRuntime | null }

export async function acquireTurnRuntime(
  deps: RuntimeEntryDeps,
  turn: TurnContext<WebContents>,
  input: {
    sessionId: string | null
    resolved: {
      providerKey: string | null
      prepared: PreparedHarnessConfig
      model?: string
    }
    sessionProviderKey: string | null | undefined
  }
): Promise<RuntimeEntry> {
  const { supervisor, lease } = deps
  if (lease.controller.signal.aborted) return { ok: false, runtime: null }

  // Persistent 채널이 세션 키의 idle 핸들로 살아있으면 재사용, 아니면 fresh(0067 — pushTurn
  // 미지원 어댑터는 SessionRuntime 이 턴-스코프 폴백). 반납은 호출자의 finally.
  const runtime = supervisor.acquireRuntime(input.sessionId, () => new SessionRuntime(deps.adapter))
  deps.onRuntimeAcquired?.(runtime)
  if (!supervisor.activateChain(lease.leaseId, runtime, input.resolved.providerKey, turn)) {
    runtime.close()
    return { ok: false, runtime: null }
  }

  const extensions = deps.buildExtensions()

  // 살아 있는 채널을 내려야 하는 다섯:
  //  0118 provider 경계 — pushTurn 은 env/providerSettings 를 재주입하지 않는다.
  //  0125 settings 제자리 수정(토큰 로테이션·base URL 교체) — spawn 시 주입본과 내용이 달라짐.
  //  0188 env 변경 — settings 는 같은데 `options.env` 의 토큰·URL·모델 변수만 바뀐 경우.
  //       settings blob 비교만으로는 안 잡힌다(그 값은 env 채널로만 간다). 두 판정은 서로
  //       겹치지 않는 축을 하나씩 본다.
  //  0128 같은 provider 안의 모델 변경 — 라이브 setModel(/model)은 이미 스폰된 서브프로세스의
  //       실제 생성 모델을 바꾸지 못한다(실측: /model 후에도 생성이 스폰 모델에 과금).
  //  런타임 도구 revision 변경 — 스폰 시 스냅샷과 어긋나면 도구 목록이 낡는다.
  // 내리면 channelAlive=false 가 되어 프렐류드의 takeForRespawn 이월이 자연 동작한다.
  if (
    input.sessionId &&
    decideRespawn(
      respawnInputs({
        runtime,
        prepared: input.resolved.prepared,
        previousProviderKey: input.sessionProviderKey,
        nextProviderKey: input.resolved.providerKey,
        model: input.resolved.model,
        runtimeToolsRevision: extensions.runtimeTools?.revision
      })
    )
  ) {
    runtime.teardownChannel()
  }

  // 0136 — 콜드 spawn 경계 = in-process 백그라운드 태스크 소멸. 이전 채널이 남긴 미정착
  // 태스크를 정착·정리해 렌더 '실행 중' 고착과 무의미한 listen 턴 개시를 막는다.
  if (input.sessionId && !runtime.channelAlive) {
    await deps.settleDeadBackgroundTasks(turn, input.sessionId)
    // 활성화는 이미 끝났으므로 핸들을 돌려준다 — 호출자의 finally 가 반납한다.
    if (lease.controller.signal.aborted) return { ok: false, runtime }
  }

  return { ok: true, runtime, extensions }
}
