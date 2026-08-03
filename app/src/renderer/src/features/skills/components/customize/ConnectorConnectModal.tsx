// Connector 연결 모달 (0160) — 인증 방식 선택 + 자격증명 입력.
//
// **서버 주소 입력 필드가 없다.** 주소는 코드 레벨(`modules/confluence/servers.ts`)에서 오고
// 여기서는 읽기 전용으로 보여주기만 한다(사용자 결정 2026-08-03). 도달 불가 오류가 나도
// 사용자가 고칠 수 없으므로 안내 문구가 "관리자 문의" 방향이다.
//
// 자격증명 필드는 `AuthStepInfo.fields` 선언에서 제네릭 렌더링한다 — `AuthView` 와 같은 패턴이라
// provider 를 추가해도 이 파일을 고치지 않는다.

import { useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Modal, MODAL_INPUT, MODAL_LABEL } from '../../../../shared/ui/Modal'
import { useI18n } from '../../../../shared/i18n'
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../../shared/ipc'
import { useConnectorConnect } from '../../hooks/useConnectorConnect'
import { buildConnectOptions, type ConnectFailure } from '../../lib/connectorConnect'

// `as const` 가 필요하다 — `Record<_, string>` 으로 넓히면 tr() 의 키 리터럴 타입 검사가 죽는다.
const FAILURE_KEY = {
  invalid_credentials: 'skills.connect.failInvalid',
  unreachable: 'skills.connect.failUnreachable',
  already_connected: 'skills.connect.failAlreadyConnected',
  cancelled: 'skills.connect.failCancelled',
  unknown: 'skills.connect.failUnknown'
} as const satisfies Record<ConnectFailure, string>

export function ConnectorConnectModal({
  open,
  connector,
  providers,
  onClose,
  onConnected
}: {
  open: boolean
  connector: PluginConnectorInfo
  providers: AuthProviderInfo[]
  onClose: () => void
  onConnected: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [input, setInput] = useState<Record<string, string>>({})
  const controller = useConnectorConnect(connector, onConnected)
  const { options, unavailableReason } = buildConnectOptions(connector, providers)
  const busy = controller.phase === 'inflight'

  const close = (): void => {
    controller.reset()
    setInput({})
    onClose()
  }

  const submit = (): void => {
    void controller.submit(input).then((ok) => {
      if (ok) {
        setInput({})
        onClose()
      }
    })
  }

  return (
    <Modal
      open={open}
      title={tr('skills.connect.title', { name: connector.label })}
      onClose={close}
      busy={busy}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="uncontained" onClick={close} disabled={busy}>
            {tr('common.cancel')}
          </Button>
          {controller.phase === 'collecting' && (
            <Button variant="primary" onClick={submit} busy={busy}>
              {tr('skills.connect.submit')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 주소는 표시값이다 — 입력 필드가 아니다. */}
        <div>
          <div className={MODAL_LABEL}>{tr('skills.connect.server')}</div>
          <div className="truncate rounded-r4 border border-border bg-t2 px-3 py-2 text-footnote text-ink2">
            {connector.origin}
          </div>
          <p className="mt-g1 text-caption text-ink3">{tr('skills.connect.serverHint')}</p>
        </div>

        {unavailableReason !== null ? (
          <p role="alert" className="text-footnote text-bad">
            {tr('skills.connect.noProvider')}
          </p>
        ) : (
          <div>
            <div className={MODAL_LABEL}>{tr('skills.connect.method')}</div>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <Button
                  key={option.providerId}
                  variant={
                    controller.providerId === option.providerId ? 'contained' : 'uncontained'
                  }
                  disabled={busy}
                  onClick={() => {
                    setInput({})
                    void controller.choose(option.providerId)
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {controller.phase === 'collecting' && controller.fields.length > 0 && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!busy) submit()
            }}
          >
            {controller.fields.map((field) => (
              <label key={field.name} className="mb-3 block">
                <div className={MODAL_LABEL}>{field.label}</div>
                <input
                  type={field.type}
                  value={input[field.name] ?? ''}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={busy}
                  autoComplete={field.type === 'password' ? 'current-password' : 'username'}
                  onChange={(event) =>
                    setInput((prev) => ({ ...prev, [field.name]: event.target.value }))
                  }
                  className={MODAL_INPUT}
                />
              </label>
            ))}
            {/* Enter 제출용 — 시각 버튼은 footer 하나만 둔다. */}
            <button type="submit" className="hidden" aria-hidden />
          </form>
        )}

        {controller.failure !== null && (
          <p role="alert" className="text-footnote text-bad">
            {tr(FAILURE_KEY[controller.failure])}
          </p>
        )}
      </div>
    </Modal>
  )
}
