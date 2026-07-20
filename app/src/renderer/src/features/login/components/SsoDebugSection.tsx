import { PanelButton, PanelSection, PanelToggle } from '../../../shared/ui/FloatingPanel'
import { loginActions, useLoginStore } from '../store'
import { useI18n } from '../../../shared/i18n'

// 디버그 패널 "SSO 개발 버튼" — 사용자의 로직 실험용 콘솔 프로브(구 sso.ts 스텁에서 이관).
function ssoDevProbe(): void {
  console.log('[sso-dev] SSO 개발 버튼 클릭 — 여기에 실험 로직을 배선하세요.')
}

// 디버그 패널에 주입되는 "SSO 로그인" 그룹. app 레이어(OverlayLayer·LoginFrame)가
// DebugPanel 의 ssoSection 슬롯으로 주입한다(features 교차 import 회피).
export function SsoDebugSection(): React.JSX.Element {
  const { tr } = useI18n()
  const bypass = useLoginStore((s) => s.bypass)
  return (
    <>
      <PanelSection label={tr('login.ssoSection')} />
      <PanelToggle
        label={tr('login.bypass')}
        value={bypass}
        onChange={(v) => loginActions.setBypass(v)}
      />
      <PanelButton label={tr('login.devButton')} onClick={ssoDevProbe} />
    </>
  )
}
