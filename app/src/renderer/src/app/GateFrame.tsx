import type { CSSProperties } from 'react'
import type { ProviderAuthKind, ProviderInfo, ProviderStepInfo } from '../../../shared/ipc'
import { WinControls } from './WinControls'
import { Button } from '../shared/ui/Button'
import { getPlatform } from '../shared/api/ipc'
import { useI18n } from '../shared/i18n'
import { DebugPanel } from '../features/debug'
import { GateLogin, ProviderDebugSection } from '../features/providers'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅(Header 와 동일).
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// 로그인 게이트가 활성일 때 AppLayout 을 대체하는 풀-프레임 셸 (구 `LoginFrame` 복원).
// 사이드바/일반 헤더 없이 슬림 타이틀바(드래그 영역 + 햄버거 + WinControls)만 두고, 본문
// 중앙에 로그인 랜딩(`GateLogin`)을 둔다.
//
// **게이트 활성 조건**: DEV 는 항상(디버그 우회 토글로 통과), prod 는 `kind:'gate'` provider 가
// 선언된 폐쇄망 배포에서만 — 선언 0개 prod 는 게이트 없이 바로 진입한다.
//
// **재시도 루프에 갇히지 않게** 타이틀바의 창 컨트롤(닫기 포함)을 항상 살려 둔다 — 로그인이
// 계속 실패하는 사용자가 앱을 끌 수 있어야 한다.
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
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'
  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={`Orca · ${tr('gate.title')}`}
      data-context="provider-gate"
    >
      <header
        className={`app-frame-header relative flex h-9 flex-none select-none items-center bg-bg ${macOsPadLeft} pr-[10px]`}
      >
        <div
          className="absolute inset-0"
          style={DRAG_STYLE}
          data-behavior="drag-region"
          aria-hidden
        />
        <div
          className="relative z-[1] flex items-center"
          style={NO_DRAG_STYLE}
          data-behavior="no-drag"
        >
          <Button iconOnly size="small" leadingIcon="menu" aria-label={tr('common.menu')} />
        </div>
        <div className="relative z-[1] flex-1" aria-hidden />
        {/* 닫기 경로는 항상 살아 있다 — 로그인 실패가 앱을 가두면 안 된다. */}
        <div
          className="relative z-[1] flex items-center"
          style={NO_DRAG_STYLE}
          data-behavior="no-drag"
        >
          <WinControls />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center bg-bg px-6">
        <GateLogin
          providers={providers}
          step={step}
          busy={busy}
          onLogin={onLogin}
          onSubmit={onSubmit}
        />
      </main>
      {import.meta.env.DEV && <DebugPanel providerSection={<ProviderDebugSection />} />}
    </div>
  )
}
