import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { ProviderAuthKind, ProviderInfo, ProviderStepInfo } from '../../../shared/ipc'
import { WinControls } from './WinControls'
import { Button } from '../shared/ui/Button'
import { getPlatform } from '../shared/api/ipc'
import { useI18n } from '../shared/i18n'
import { DebugPanel } from '../features/debug'
import { ProviderDebugSection } from '../features/providers'

// React 의 CSSProperties 에는 WebkitAppRegion 이 없어 명시 캐스팅(Header 와 동일).
const DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const NO_DRAG_STYLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

// 로그인 게이트 풀-프레임 셸 (0181). `kind:'gate'` provider 가 선언된 빌드에서 **메인 UI 이전에**
// 뜬다. 선언이 0개면 이 화면 자체가 렌더되지 않는다(`RootGate` 가 게이트를 건너뛴다).
//
// **위치가 `app/` 인 이유**: `BootFailureFrame` 과 같은 급의 최상위 셸이고 `WinControls`(app)를
// 쓴다 — feature 에 두면 features → app 이라는 경계 역방향이 생긴다. 상태·액션은
// `features/providers/hooks/useProviderGate` 가 갖는다(app → features 는 허용 방향).
//
// **재시도 루프에 갇히지 않게** 타이틀바의 창 컨트롤(닫기 포함)을 항상 살려 둔다 — 로그인이
// 계속 실패하는 사용자가 앱을 끌 수 있어야 한다.
//
// **디버그 패널을 여기서도 마운트한다**(DEV 한정, 구 `LoginFrame` 과 같은 이유): 로그인 우회
// 토글이 메인 셸(`OverlayLayer`)에만 있으면 정작 게이트에 막혔을 때 손이 닿지 않는다 — 우회가
// 필요한 상황이 곧 우회 스위치에 도달할 수 없는 상황이 된다.
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
  const [values, setValues] = useState<Record<string, string>>({})
  const macOsPadLeft = getPlatform() === 'darwin' ? 'pl-[80px]' : 'pl-[14px]'

  // 선언 배열 순서로 순차 진행 — 아직 통과하지 못한 첫 provider 가 지금 할 일이다.
  const current = providers.find((provider) => provider.status !== 'valid') ?? providers[0]
  const failure = step?.kind === 'failed' ? step : null
  const form = step?.kind === 'input-required' && step.providerId === current?.id ? step : null

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
        <div className="flex w-full max-w-[360px] flex-col gap-4">
          <h1 className="m-0 text-center text-heading text-ink">{tr('gate.title')}</h1>
          <p className="m-0 text-center text-footnote text-ink3">{tr('gate.subtitle')}</p>

          {providers.length > 1 && (
            <ol className="m-0 flex list-none flex-col gap-g2 p-0 text-footnote">
              {providers.map((provider) => (
                <li key={provider.id} className="flex items-center gap-g3">
                  <span className={provider.status === 'valid' ? 'text-good' : 'text-ink3'}>
                    {provider.status === 'valid' ? '✓' : '·'}
                  </span>
                  <span className={provider.id === current?.id ? 'text-ink' : 'text-ink2'}>
                    {provider.label}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {form ? (
            <form
              className="flex flex-col gap-g4"
              onSubmit={(event) => {
                event.preventDefault()
                if (current) onSubmit(current.id, values)
                setValues({})
              }}
            >
              {form.fields.map((field) => (
                <label key={field.name} className="flex flex-col gap-g2 text-footnote">
                  <span className="text-ink3">{field.label}</span>
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    required={field.required}
                    autoComplete="off"
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      setValues((state) => ({ ...state, [field.name]: event.target.value }))
                    }
                    className="rounded-r4 border border-border bg-panel px-p4 py-p3 text-ink outline-none focus:border-ink3"
                  />
                </label>
              ))}
              {form.message !== undefined && (
                <p className="m-0 text-caption text-bad">{form.message}</p>
              )}
              <Button type="submit" variant="contained" disabled={busy}>
                {tr('gate.signIn')}
              </Button>
            </form>
          ) : (
            <Button
              variant="contained"
              disabled={busy || !current}
              onClick={() => current && onLogin(current.id)}
            >
              {busy ? tr('gate.signingIn') : tr('gate.signIn')}
            </Button>
          )}

          {failure && (
            <div
              role="alert"
              className="rounded-r4 border border-bad/30 bg-bad/10 p-3 text-center text-[12.5px] text-bad"
            >
              <p className="m-0 break-words">{failure.message}</p>
            </div>
          )}
        </div>
      </main>
      {import.meta.env.DEV && <DebugPanel providerSection={<ProviderDebugSection />} />}
    </div>
  )
}
