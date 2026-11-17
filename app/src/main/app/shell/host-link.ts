// 호스트 → 셸 메시지의 수신 (0324 EP-10 · EP-11 · EP-14). 수명 이벤트는 `LifecycleState` 로, UI
// 언어는 셸 상태의 사본으로, 셸 서비스 요청은 서비스 서버로 간다. 스키마를 통과하지 못한 메시지는 버린다.

import { HostToShellSchema } from '../../../shared/host-protocol'
import type { LifecycleState } from './lifecycle-state'
import type { ServiceCall } from './services'

export interface HostLinkDeps {
  lifecycle: Pick<LifecycleState, 'apply'>
  mirrorUiLocale(uiLocale: 'ko' | 'en'): void
  // 호스트가 요청을 받을 수 있게 됐다.
  onReady?(): void
  // 데이터 호스트가 에이전트 호스트를 띄워 달라고 했다(D-044).
  onPeerEnsure?(): void
  // 데이터 호스트의 주기 업데이트 확인 잡 — 업데이트는 셸이 소유한다.
  onUpdateCheck?(): void
  // 셸 서비스 요청(EP-10) — `createShellServiceServer` 가 받는다.
  onServiceCall(call: ServiceCall): void
  onInvalid?(): void
}

export function createHostMessageSink(deps: HostLinkDeps): (raw: unknown) => void {
  return (raw) => {
    const parsed = HostToShellSchema.safeParse(raw)
    if (!parsed.success) {
      deps.onInvalid?.()
      return
    }
    const message = parsed.data
    switch (message.type) {
      case 'lifecycle':
        deps.lifecycle.apply(message.event)
        return
      case 'shell.mirror':
        deps.mirrorUiLocale(message.mirror.uiLocale)
        return
      case 'ready':
        // 호스트가 뜨기 전에 다른 경로로 바뀐 언어를 바로잡는다(B14). 데이터 호스트만 싣는다.
        if (message.mirror) deps.mirrorUiLocale(message.mirror.uiLocale)
        deps.onReady?.()
        return
      case 'peer.ensure':
        deps.onPeerEnsure?.()
        return
      case 'update.check':
        deps.onUpdateCheck?.()
        return
      case 'service.call':
        deps.onServiceCall(message)
        return
      case 'boot.step':
        // 감독자가 `hostStartStep` 으로 따로 읽는다(준비 마감의 멈춤·재개).
        return
    }
  }
}

// 기동 중 호스트가 알린 긴 단계의 시작·끝(D-055). 그 밖의 메시지는 undefined.
export function hostStartStep(raw: unknown): 'begin' | 'end' | undefined {
  const parsed = HostToShellSchema.safeParse(raw)
  return parsed.success && parsed.data.type === 'boot.step' ? parsed.data.state : undefined
}
