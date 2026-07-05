import { PanelButton, PanelSection, PanelToggle } from '../../../shared/ui/FloatingPanel'
import { loginActions, useLoginStore } from '../store'
import { ssoDevProbe } from '../sso'

// 디버그 패널에 주입되는 "SSO 로그인" 그룹. app 레이어(OverlayLayer·LoginFrame)가
// DebugPanel 의 ssoSection 슬롯으로 주입한다(features 교차 import 회피).
export function SsoDebugSection(): React.JSX.Element {
  const bypass = useLoginStore((s) => s.bypass)
  return (
    <>
      <PanelSection label="SSO 로그인" />
      <PanelToggle
        label="로그인 우회(bypass)"
        value={bypass}
        onChange={(v) => loginActions.setBypass(v)}
      />
      <PanelButton label="SSO 개발 버튼" onClick={ssoDevProbe} />
    </>
  )
}
