import { useState } from 'react'
import type {
  ProviderAuthKind,
  ProviderFieldInfo,
  ProviderInfo,
  ProviderStepInfo
} from '../../../../../shared/ipc'
import { Button } from '../../../shared/ui/Button'
import { MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
import { useI18n } from '../../../shared/i18n'
import { authChoices, needsAuthChoice } from '../../../shared/config/providerAuth'
import orca from '../assets/orca-login.webp'

// 로그인 랜딩 (0180 이 지운 구 `features/auth/AuthView` 복원 — 0181 의 provider 축에 맞춰 개정).
//
// 중앙에 Orca 제목 + 오르카 이미지, 아래 카드에 현재 step 이 요구한 입력 필드(제네릭 렌더링)와
// 검정 로그인 버튼을 둔다. 실패 시 버튼 위 빨간 메시지, 수행 중에는 버튼이 스피너로 바뀐다.
//
// **필드가 없어도 버튼은 항상 있다** — ADFS/WIA 같은 브라우저 플로우는 입력 없이 `login()` 하나로
// 끝나기 때문이다. 필드 유무가 곧 플로우 종류다(0157 의 규칙 유지).
//
// 게이트 provider 가 여럿이면 선언 순서대로 순차 진행한다. 입력 초기화는 `key={stepKey}` 로 폼을
// **remount** 해서 한다 — effect 안 setState 는 cascading render 라 lint 가 막고, 두 단계가 같은
// 필드 이름을 쓰면 초기화 없이는 앞 값이 남는다.
export function GateLogin({
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
  // 아직 통과하지 못한 첫 provider 가 지금 할 일이다.
  const current = providers.find((provider) => provider.status !== 'valid') ?? providers[0]
  const mine = step && current && step.providerId === current.id ? step : null
  const failure = mine?.kind === 'failed' ? mine : null
  const fields = mine?.kind === 'input-required' ? mine.fields : []
  // 부팅 자동 로그인이 도는 중 — 사용자가 누를 것은 없다. 확인이 끝나면 화면이 넘어가거나(성공)
  // 버튼이 살아난다(실패). 이 표시가 없으면 "왜 버튼이 멈춰 있나" 가 된다.
  const resuming = mine?.kind === 'resuming'
  const [authKind, setAuthKind] = useState<ProviderAuthKind | null>(null)

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-7 px-6">
      <h1 className="flex flex-col items-center gap-1 text-center leading-none">
        <span className="text-5xl font-bold tracking-tight text-ink">Orca</span>
        <span className="text-sm font-semibold uppercase tracking-[0.25em]">
          <span className="text-ink2">with </span>
          <span className="text-accent">Claude Code</span>
        </span>
      </h1>
      <img
        src={orca}
        alt="Orca"
        className="h-56 w-56 select-none object-contain"
        draggable={false}
      />
      <div className="w-full rounded-r6 border border-border bg-panel p-6 shadow-xl">
        {/* 게이트가 여럿이면 지금 몇 번째인지 알린다 — 알리지 않으면 1단계 성공 후 두 번째
            폼이 이유 없이 나타난다(0172 의 이유). */}
        {providers.length > 1 && current && (
          <p className="mb-3 text-center text-[12.5px] text-ink2">
            {tr('gate.chainProgress', {
              index: providers.indexOf(current) + 1,
              total: providers.length,
              label: current.label
            })}
          </p>
        )}
        {failure && (
          <p role="alert" className="mb-3 text-center text-[12.5px] text-bad">
            {failure.message}
          </p>
        )}
        {/* 게이트 provider 가 하나도 선언되지 않은 개발 빌드 — 로그인할 상대가 없으므로
            디버그 패널의 우회 토글로 넘어가야 한다. 그 사실을 화면이 말해 준다. */}
        {!current && (
          <p className="mb-3 text-center text-[12.5px] text-ink2">{tr('gate.noProviders')}</p>
        )}
        {current && needsAuthChoice(current) && (
          <div className="mb-4 flex flex-wrap justify-center gap-g3">
            {authChoices(current).map((spec) => (
              <button
                key={spec.kind}
                type="button"
                onClick={() => setAuthKind(spec.kind)}
                aria-pressed={authKind === spec.kind}
                className={`cursor-pointer rounded-r4 border px-3.5 py-p3 text-footnote ${
                  authKind === spec.kind
                    ? 'border-0 bg-ink text-bg'
                    : 'border-border bg-panel text-ink2 hover:bg-fill-uncontained-hover'
                }`}
              >
                {spec.label}
              </button>
            ))}
          </div>
        )}
        {resuming && (
          <p className="mb-3 text-center text-[12.5px] text-ink2">{tr('gate.resuming')}</p>
        )}
        <GateStepForm
          key={mine?.kind === 'input-required' ? `${current?.id}:${mine.authKind}` : 'start'}
          fields={fields}
          busy={busy || resuming}
          disabled={!current}
          onSubmit={(input) => {
            if (!current) return
            if (fields.length > 0) onSubmit(current.id, input)
            else onLogin(current.id, authKind ?? undefined)
          }}
        />
      </div>
    </div>
  )
}

function GateStepForm({
  fields,
  busy,
  disabled,
  onSubmit
}: {
  fields: ProviderFieldInfo[]
  busy: boolean
  disabled: boolean
  onSubmit: (input: Record<string, string>) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [input, setInput] = useState<Record<string, string>>({})
  const submit = (): void => onSubmit(input)

  return (
    <>
      {fields.length > 0 && (
        <form
          className="mb-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) submit()
          }}
        >
          {fields.map((field) => (
            <label key={field.name} className="mb-3 block">
              <div className={MODAL_LABEL}>{field.label}</div>
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                value={input[field.name] ?? ''}
                required={field.required}
                disabled={busy}
                autoComplete={field.type === 'password' ? 'current-password' : 'username'}
                onChange={(e) => setInput((prev) => ({ ...prev, [field.name]: e.target.value }))}
                className={MODAL_INPUT}
              />
            </label>
          ))}
          {/* Enter 제출용 — 시각 버튼은 아래 공용 버튼 하나만 둔다. */}
          <button type="submit" className="hidden" aria-hidden />
        </form>
      )}
      <Button
        variant="primary"
        size="large"
        className="h-12 w-full"
        busy={busy}
        disabled={disabled}
        onClick={submit}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg/40 border-t-bg" />
            {tr('gate.signingIn')}
          </span>
        ) : (
          tr('gate.signIn')
        )}
      </Button>
    </>
  )
}
