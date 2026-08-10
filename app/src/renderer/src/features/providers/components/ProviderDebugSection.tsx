import { useEffect } from 'react'
import { PanelSection, PanelToggle } from '../../../shared/ui/FloatingPanel'
import { useI18n } from '../../../shared/i18n'
import { bypassActions, useBypass } from '../store/bypassStore'
import { useProviderGate } from '../hooks/useProviderGate'

// 디버그 패널에 주입되는 "로그인" 그룹 (0181 — 0180 이 지운 `AuthDebugSection` 복원).
// app 레이어(`OverlayLayer`·`GateFrame`)가 `DebugPanel` 의 `providerSection` 슬롯으로 주입한다
// (features 교차 import 회피 — `UpdateDebugSection` 과 같은 패턴).
//
// **게이트 화면에도 뜬다.** 우회 토글이 메인 셸에만 있으면 정작 게이트에 막혔을 때 손이 닿지
// 않는다 — 구 `LoginFrame` 이 디버그 패널을 직접 마운트했던 이유가 그것이다.
export function ProviderDebugSection(): React.JSX.Element {
  const { tr } = useI18n()
  const bypass = useBypass()
  const gate = useProviderGate()

  useEffect(() => {
    bypassActions.hydrate()
  }, [])

  return (
    <>
      <PanelSection label={tr('gate.debug.section')} />
      <PanelToggle
        label={tr('gate.debug.bypass')}
        value={bypass ?? false}
        onChange={(next) => bypassActions.setBypass(next)}
      />
      {/* 지금 게이트가 어떤 상태인지 — 우회를 켰는데도 안 열리면 선언이 0개(required:false)인지
          로그인이 안 된 것인지 구분이 필요하다. */}
      <PanelSection
        label={tr('gate.debug.status', {
          status: gate.gate === null ? '…' : gateLabel(gate.gate, tr)
        })}
      />
    </>
  )
}

function gateLabel(
  gate: NonNullable<ReturnType<typeof useProviderGate>['gate']>,
  tr: (key: 'gate.debug.none' | 'gate.debug.passed' | 'gate.debug.blocked') => string
): string {
  if (!gate.required) return tr('gate.debug.none')
  return gate.passed ? tr('gate.debug.passed') : tr('gate.debug.blocked')
}
