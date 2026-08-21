import { useEffect } from 'react'
import { AppLayout } from './AppLayout'
import { BootFailureFrame } from './BootFailureFrame'
import { GateFrame } from './GateFrame'
import { BootScreen } from './boot/BootScreen'
import { bootActions, useBootStore } from './boot/bootStore'
import { useProviderGate } from '../features/providers/hooks/useProviderGate'
import { rootFrame } from './rootFrame'

// 앱 최상위 게이트. renderer 부트 오케스트레이터를 실행하고 그 단계에 따라 화면을 고른다.
//
// 0181 에서 **로그인 게이트가 부팅 위에 한 층 얹혔다**. 순서가 중요하다:
//   1. 부팅 실패    — 게이트보다 먼저다(main 이 죽었으면 로그인할 상대가 없다)
//   2. 부팅 미완료  — 부팅 화면
//   3. 게이트 미판정/미통과 — 로그인 화면. **판정 전(gate=null)에는 통과시키지 않는다**(fail-closed):
//      main 이 잠깐 응답하지 못하는 사이 로그인 강제 빌드가 무인증으로 열리면 안 된다.
//   4. 복원 진행 중 — 대기 화면 (0194). 여기서 넘겨 보내면 나머지 Auth 의 재로그인 창이
//      **메인 UI 뒤에서** 뜬다.
//   5. 통과 + 복원 종료 — 메인 UI
//
// 판정 자체는 `rootFrame()` (순수)이 갖는다 — 이 컴포넌트는 그리기만 한다.
//
// 게이트 provider 선언이 0개면 main 이 `required:false, passed:true` 를 주므로 3번은 즉시
// 지나간다 — dev/OSS 빌드가 로그인 화면에 갇히지 않는다(AC14).
export function RootGate(): React.JSX.Element {
  const bootPhase = useBootStore((s) => s.phase)
  const bootError = useBootStore((s) => s.errorMessage)
  const gate = useProviderGate()

  useEffect(() => {
    if (bootPhase === 'idle') void bootActions.runBoot()
  }, [bootPhase])

  // 판정은 순수 셀렉터가 갖는다 — 여기는 고른 프레임을 그리기만 한다.
  const frame = rootFrame({ bootPhase, gate: gate.gate, resuming: gate.resuming })
  if (frame === 'boot-failure') {
    return <BootFailureFrame bootError={bootError} onRetryBoot={() => void bootActions.runBoot()} />
  }
  if (frame === 'waiting') return <BootScreen />
  // 게이트 통과 후의 대기는 **복원 중**이라고 말한다 — 같은 스피너지만 사용자가 기다리는 대상이
  // 다르다(부팅 준비 vs 사내 연결 복원). 어느 쪽인지는 셀렉터가 이미 골랐다.
  if (frame === 'waiting-resume') return <BootScreen label="resuming" />
  if (frame === 'gate') {
    return (
      <GateFrame
        providers={gate.providers}
        step={gate.step}
        busy={gate.busy}
        onLogin={(providerId, authKind) => void gate.login(providerId, authKind)}
        onSubmit={(providerId, input) => void gate.submit(providerId, input)}
      />
    )
  }
  return <AppLayout />
}
