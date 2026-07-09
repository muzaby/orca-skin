import { PanelSection, PanelToggle } from '../../../shared/ui/FloatingPanel'
import { updateActions, useUpdateDummy } from '../store/updateStore'

// 디버그 패널에 주입되는 "업데이트" 그룹. app 레이어(OverlayLayer)가 DebugPanel 의
// updateSection 슬롯으로 주입한다(features 교차 import 회피). 토글 on 시 실제 서버 없이
// mock `available` 을 주입해 헤더 다운로드 버튼·파란 뱃지·다운로드/설치 흐름을 재현한다.
export function UpdateDebugSection(): React.JSX.Element {
  const dummy = useUpdateDummy()
  return (
    <>
      <PanelSection label="업데이트" />
      <PanelToggle
        label="더미 업데이트"
        value={dummy}
        onChange={(v) => updateActions.setDummy(v)}
      />
    </>
  )
}
