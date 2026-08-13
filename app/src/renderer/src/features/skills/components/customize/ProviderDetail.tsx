import { useMemo, useState } from 'react'
import type { ProviderAuthKind, ProviderInfo, ProviderStepInfo } from '../../../../../../shared/ipc'
import { formatDateMedium, useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import { Dot } from '../../../../shared/ui/Status'
import { Button } from '../../../../shared/ui/Button'
import { AuthKindChoices } from '../../../../shared/ui/AuthKindChoices'
import {
  authChoices,
  initialAuthKind,
  needsAuthChoice
} from '../../../../shared/config/providerAuth'
import { canManageAuth, providerRowMeta } from '../../lib/providerRows'

const TONE = { valid: 'green', expired: 'amber', unknown: 'amber', none: 'slate' } as const

// provider 상세 — 상태·인증·재인증·해제. 앱 로그인(gate)과 사내 서비스(service)가 **같은
// 패널**을 쓴다(둘의 차이는 kind 뿐). 입력 폼은 main 이 내려준 `fields` 선언을 그대로
// 렌더링한다 — provider 가 만든 임의 UI 가 아니라 **신뢰된 prompt** 다.
export function ProviderDetail({
  provider,
  step,
  onLogin,
  onSubmit,
  onReauth,
  onRevoke
}: {
  provider: ProviderInfo
  step: ProviderStepInfo | null
  onLogin: (authKind?: ProviderAuthKind) => void
  onSubmit: (input: Record<string, string>) => void
  onReauth: (authKind?: ProviderAuthKind) => void
  onRevoke: () => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  const meta = providerRowMeta(provider)
  const choices = authChoices(provider)
  const [authKind, setAuthKind] = useState<ProviderAuthKind | null>(() => initialAuthKind(provider))
  const [values, setValues] = useState<Record<string, string>>({})

  // provider 를 갈아탈 때의 상태 초기화는 **부모가 `key={provider.id}` 로 리마운트**해서 한다
  // (effect 안 setState 는 캐스케이딩 렌더를 만든다). 남은 입력값이 다른 provider 의 폼에
  // 실려 보이는 사고를 리마운트가 구조적으로 막는다.
  const mine = step && step.providerId === provider.id ? step : null
  const fields = useMemo(() => (mine?.kind === 'input-required' ? mine.fields : []), [mine])

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
      <div className="flex items-center gap-g6">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-r4 bg-bg2 text-ink2">
          <Icon name="power" size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-heading text-ink">{provider.label}</h2>
          <div className="mt-g1 flex items-center gap-g3 text-footnote text-ink3">
            <span>{tr(meta.kindKey)}</span>
            <span>·</span>
            <Dot tone={TONE[provider.status]} />
            <span>{tr(meta.statusKey)}</span>
            {meta.activeLabel !== null && (
              <>
                <span>·</span>
                <span>{tr('skills.provider.connectedWith', { method: meta.activeLabel })}</span>
              </>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-none items-center gap-g3">
          {canManageAuth(provider) ? (
            <Button size="small" onClick={() => onReauth(authKind ?? undefined)}>
              {tr('skills.provider.reauth')}
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={() => onLogin(authKind ?? undefined)}>
              {tr('skills.provider.connect')}
            </Button>
          )}
          {canManageAuth(provider) && (
            <Button size="small" onClick={onRevoke}>
              {tr('skills.provider.revoke')}
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-p8 grid grid-cols-[auto_1fr] gap-x-g6 gap-y-g3 text-footnote">
        {/* id 는 vault 네임스페이스이자 도구 서버 이름(`<id>-tools`)의 뿌리다 — 선언과 어긋난
            호출을 사용자가 대조할 수 있어야 한다. */}
        <dt className="text-ink3">{tr('skills.provider.id')}</dt>
        <dd className="m-0 truncate font-mono text-ink2">{provider.id}</dd>
        <dt className="text-ink3">{tr('skills.provider.origin')}</dt>
        <dd className="m-0 truncate font-mono text-ink2">{provider.origin}</dd>
        {provider.principal !== null && (
          <>
            <dt className="text-ink3">{tr('skills.table.author')}</dt>
            <dd className="m-0 truncate text-ink2">{provider.principal}</dd>
          </>
        )}
        {provider.expiresAt !== null && (
          <>
            <dt className="text-ink3">{tr('skills.provider.expiresAt')}</dt>
            <dd className="m-0 text-ink2">{formatDateMedium(provider.expiresAt, locale)}</dd>
          </>
        )}
      </dl>

      {/* 모델이 실제로 부르는 이름 그대로 보여준다 — 승인 설정·프롬프트가 쓰는 것과 같은 값이다.
          등록은 연결 상태를 따라가고 다음 spawn 부터 반영되므로, 연결 전에는 안내를 함께 둔다. */}
      {provider.tools.length > 0 && (
        <section className="mt-p8">
          <h3 className="m-0 text-caption text-ink3">{tr('skills.provider.tools')}</h3>
          <ul className="mt-g2 flex list-none flex-col gap-g1 p-0">
            {provider.tools.map((name) => (
              <li key={name} className="truncate font-mono text-footnote text-ink2">
                {name}
              </li>
            ))}
          </ul>
          {provider.status !== 'valid' && (
            <p className="mt-g2 mb-0 text-caption text-ink3">
              {tr('skills.provider.toolsInactive')}
            </p>
          )}
        </section>
      )}

      {/* 선언이 둘 이상일 때만 선택 단계가 보인다 — 하나면 고를 것이 없다. */}
      {needsAuthChoice(provider) && (
        <fieldset className="mt-p8 rounded-r5 border border-border bg-bg2 p-p7">
          <legend className="px-p2 text-caption text-ink3">
            {tr('skills.provider.chooseMethod')}
          </legend>
          <AuthKindChoices
            choices={choices}
            value={authKind}
            onChange={setAuthKind}
            className="flex flex-wrap gap-g3"
          />
        </fieldset>
      )}

      {mine?.kind === 'input-required' && (
        <form
          className="mt-p8 flex flex-col gap-g4 rounded-r5 border border-border bg-bg2 p-p7"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(values)
            setValues({})
          }}
        >
          {fields.map((field) => (
            <label key={field.name} className="flex flex-col gap-g2 text-footnote">
              <span className="text-ink3">{field.label}</span>
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                required={field.required}
                value={values[field.name] ?? ''}
                autoComplete="off"
                onChange={(event) =>
                  setValues((state) => ({ ...state, [field.name]: event.target.value }))
                }
                className="rounded-r4 border border-border bg-panel px-p4 py-p3 text-ink outline-none focus:border-ink3"
              />
            </label>
          ))}
          {mine.message !== undefined && (
            <p className="m-0 text-caption text-bad">{mine.message}</p>
          )}
          <Button type="submit" variant="contained" size="small" className="self-start">
            {tr('skills.provider.submit')}
          </Button>
        </form>
      )}

      {/* OAuth `redirect:'manual'` — 브라우저에서 받은 code 를 사용자가 붙여 넣는다. */}
      {mine?.kind === 'code-required' && (
        <form
          className="mt-p8 flex flex-col gap-g4 rounded-r5 border border-border bg-bg2 p-p7"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit({ code: values.code ?? '' })
            setValues({})
          }}
        >
          <a
            href={mine.url}
            target="_blank"
            rel="noreferrer"
            className="text-footnote text-ink2 underline"
          >
            {tr('skills.provider.openBrowser')}
          </a>
          <label className="flex flex-col gap-g2 text-footnote">
            <span className="text-ink3">{tr('skills.provider.codeLabel')}</span>
            <input
              type="text"
              required
              autoComplete="off"
              value={values.code ?? ''}
              onChange={(event) => setValues((state) => ({ ...state, code: event.target.value }))}
              className="rounded-r4 border border-border bg-panel px-p4 py-p3 font-mono text-ink outline-none focus:border-ink3"
            />
            <span className="text-caption text-ink3">{tr('skills.provider.codeHint')}</span>
          </label>
          <Button type="submit" variant="contained" size="small" className="self-start">
            {tr('skills.provider.submit')}
          </Button>
        </form>
      )}

      {mine?.kind === 'failed' && <p className="mt-p7 text-footnote text-bad">{mine.message}</p>}
    </div>
  )
}
