// 호스트 → 셸 알림의 원천 (0324 EP-11 · EP-14 · plan §7-D).
//
// 셸은 턴·세션 상태를 수명 이벤트 다섯 가지로만 안다. 원천은 버스가 아니다 — 오류로 끝난 턴의
// 합성 이벤트는 버스를 타지 않기 때문이다. 턴의 시작·종료는 재시작 게이트의 정본인 lease 집합의
// 변화에서 만들고, 나머지 셋은 각자의 진입점이 직접 알린다. UI 언어 사본 알림(D-032)도 여기서
// 보낸다(수명 이벤트는 아니다).

import type { HostToShell, ShellMirror } from '../../../shared/host-protocol'

export interface LeaseIdentity {
  readonly logicalKey: string
  // 세션이 확정되기 전에는 null 이다.
  readonly sessionId: string | null
}

export interface LifecycleEmitterDeps {
  // 지금 살아 있는 lease 전부.
  leases(): readonly LeaseIdentity[]
  emit(message: HostToShell): void
}

export interface LifecycleEmitter {
  // lease 가 획득·해제·승격될 때마다 부른다.
  leasesChanged(): void
  // 세션이 아직 확정되지 않은 턴(null)의 승인은 알리지 않는다 — 그 턴은 lease 로 이미 활성이다.
  approvalPending(sessionId: string | null | undefined): void
  sessionEnded(sessionId: string): void
  // 하네스 채널이 오류로 내려갔다.
  harnessExited(sessionId: string | null | undefined): void
  // 설정이 바뀌었다 — `uiLocale` 이 바뀐 경우에만 셸에 알린다.
  settingsPatched(next: ShellMirror, changedKeys: readonly string[]): void
}

export function createLifecycleEmitter(deps: LifecycleEmitterDeps): LifecycleEmitter {
  let active = new Set<string>()
  const lifecycle = (
    type: 'turn.started' | 'turn.ended' | 'approval.pending' | 'session.ended' | 'harness.exited',
    sessionId: string
  ): void => deps.emit({ type: 'lifecycle', event: { type, sessionId } })

  return {
    leasesChanged: () => {
      const next = new Set(deps.leases().map((lease) => lease.sessionId ?? lease.logicalKey))
      const previous = active
      active = next
      // 시작을 먼저 보낸다 — 승격(식별자 교체)에서 셸의 활성 수가 0 을 지나지 않는다.
      for (const id of next) if (!previous.has(id)) lifecycle('turn.started', id)
      for (const id of previous) if (!next.has(id)) lifecycle('turn.ended', id)
    },
    approvalPending: (sessionId) => {
      if (sessionId) lifecycle('approval.pending', sessionId)
    },
    sessionEnded: (sessionId) => lifecycle('session.ended', sessionId),
    harnessExited: (sessionId) => {
      if (sessionId) lifecycle('harness.exited', sessionId)
    },
    settingsPatched: (next, changedKeys) => {
      if (changedKeys.includes('uiLocale')) {
        deps.emit({ type: 'shell.mirror', mirror: { uiLocale: next.uiLocale } })
      }
    }
  }
}
