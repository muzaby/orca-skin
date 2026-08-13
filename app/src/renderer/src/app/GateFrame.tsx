import type { ProviderAuthKind, ProviderInfo, ProviderStepInfo } from '../../../shared/ipc'
import { FullFrameShell } from './FullFrameShell'
import { useI18n } from '../shared/i18n'
import { DebugPanel } from '../features/debug'
import { GateLogin, ProviderDebugSection } from '../features/providers'

// 로그인 게이트가 활성일 때 AppLayout 을 대체하는 화면 (구 `LoginFrame` 복원). 창 크롬은
// `FullFrameShell` 이 갖고, 여기는 본문(로그인 랜딩)만 채운다.
//
// **게이트 활성 조건**: DEV 는 항상(디버그 우회 토글로 통과), prod 는 `kind:'gate'` provider 가
// 선언된 폐쇄망 배포에서만 — 선언 0개 prod 는 게이트 없이 바로 진입한다.
//
// **디버그 패널을 여기서도 마운트한다**(DEV 한정, 구 `LoginFrame` 과 같은 이유): 로그인 우회
// 토글이 메인 셸(`OverlayLayer`)에만 있으면 정작 게이트에 막혔을 때 손이 닿지 않는다 — 우회가
// 필요한 상황이 곧 우회 스위치에 도달할 수 없는 상황이 된다. prod 에는 마운트하지 않는다
// (게이트에 백도어를 만들지 않는다).
export function GateFrame({
  providers,
  step,
  busy,
  onLogin,
  onSubmit
}: {
  providers: ProviderInfo[]
  step: ProviderStepInfo | null
  busy: boolean
  onLogin: (providerId: string, authKind?: ProviderAuthKind) => void
  onSubmit: (providerId: string, input: Record<string, string>) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <FullFrameShell
      screenLabel={`Orca · ${tr('gate.title')}`}
      context="provider-gate"
      footer={import.meta.env.DEV && <DebugPanel providerSection={<ProviderDebugSection />} />}
    >
      <GateLogin
        providers={providers}
        step={step}
        busy={busy}
        onLogin={onLogin}
        onSubmit={onSubmit}
      />
    </FullFrameShell>
  )
}
