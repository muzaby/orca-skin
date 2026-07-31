import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/ui/Button'
import { MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
import { uiMessageText, useI18n } from '../../../shared/i18n'
import { authActions, useAuthStore } from '../store'
import orca from '../assets/orca-login.webp'

// 로그인 랜딩. 중앙 '로그인' 제목 자리를 오르카 이미지로 대체하고, 아래 카드에 현재
// AuthStep 이 요구한 입력 필드(store.fields — 제네릭 렌더링) + 검정 로그인 버튼을 둔다.
// 실패 시 버튼 위에 빨간 메시지(provider 원문 우선, 카탈로그 폴백), 수행 중에는 버튼이
// inflight(스피너+"로그인 중")로 바뀐다.
//
// 0157: 필드가 없어도 버튼은 항상 있다 — ADFS/WIA 같은 브라우저 플로우는 입력 없이 begin()
// 하나로 끝나기 때문이다. 필드 유무가 곧 플로우 종류다.
export function AuthView(): React.JSX.Element {
  const navigate = useNavigate()
  const { tr } = useI18n()
  const status = useAuthStore((s) => s.status)
  const errorMessage = useAuthStore((s) => s.errorMessage)
  const fields = useAuthStore((s) => s.fields)
  const [input, setInput] = useState<Record<string, string>>({})
  const inflight = status === 'inflight'
  const submit = (): void => void authActions.attemptLogin(navigate, input)

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
        {status === 'error' && errorMessage && (
          <p role="alert" className="mb-3 text-center text-[12.5px] text-bad">
            {uiMessageText(tr, errorMessage)}
          </p>
        )}
        {fields.length > 0 && (
          <form
            className="mb-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!inflight) submit()
            }}
          >
            {fields.map((field) => (
              <label key={field.name} className="mb-3 block">
                <div className={MODAL_LABEL}>{field.label}</div>
                <input
                  type={field.type}
                  value={input[field.name] ?? ''}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={inflight}
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
          busy={inflight}
          onClick={submit}
        >
          {inflight ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-bg/40 border-t-bg" />
              {tr('login.loggingIn')}
            </span>
          ) : (
            tr('login.authButton')
          )}
        </Button>
      </div>
    </div>
  )
}
