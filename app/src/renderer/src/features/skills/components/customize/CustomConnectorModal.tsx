import { useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT } from '../../../../shared/ui/Modal'
import { Icon } from '../../../../shared/ui/Icon'
import type { ConnectorItem } from './data'

// "커스텀 커넥터 추가" — 원격 MCP 커넥터 추가 플로우(첨부 4). 이름 + URL + 고급설정(OAuth).
// 정적 스킨이므로 onAdd 는 '연결되지 않음' 그룹에 메모리상 append.
export function CustomConnectorModal({
  open,
  onClose,
  onAdd
}: {
  open: boolean
  onClose: () => void
  onAdd: (connector: ConnectorItem) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')

  const canAdd = name.trim() !== '' && url.trim() !== ''

  const reset = (): void => {
    setName('')
    setUrl('')
    setAdvanced(false)
    setClientId('')
    setClientSecret('')
  }
  const close = (): void => {
    reset()
    onClose()
  }
  const add = (): void => {
    if (!canAdd) return
    const trimmed = name.trim()
    onAdd({
      id: `${trimmed}-${Date.now()}`,
      name: trimmed,
      icon: 'link',
      transport: 'http',
      desc: url.trim(),
      group: 'disconnected',
      bullets: [
        '원격 MCP — 등록된 URL 의 도구를 노출합니다.',
        clientId.trim() !== ''
          ? 'OAuth — 클라이언트 자격으로 인증합니다.'
          : '인증 — 연결 시 설정합니다.'
      ]
    })
    close()
  }

  const badge = (
    <span className="rounded bg-cream-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink3">
      BETA
    </span>
  )

  return (
    <Modal open={open} title="커스텀 커넥터 추가" badge={badge} onClose={close} width={560}>
      <p className="mb-4 text-[12.5px] leading-[1.6] text-ink2">
        Orca를 데이터와 도구에 연결하세요.{' '}
        <span className="cursor-pointer text-rust hover:underline">
          커넥터에 대해 자세히 알아보기
        </span>{' '}
        또는 <span className="cursor-pointer text-rust hover:underline">사전 구축된 커넥터</span>로
        시작하세요.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={64}
        placeholder="이름"
        className={`${MODAL_INPUT} mb-3`}
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        maxLength={2000}
        placeholder="원격 MCP 서버 URL"
        className={`${MODAL_INPUT} mb-3 font-mono`}
      />

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="mb-3 flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] text-ink2"
      >
        <Icon name={advanced ? 'chevD' : 'chevR'} size={13} />
        고급 설정
      </button>

      {advanced && (
        <div className="mb-3 space-y-3">
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="OAuth 클라이언트 ID (선택사항)"
            className={MODAL_INPUT}
          />
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="OAuth 클라이언트 시크릿 (선택사항)"
            className={MODAL_INPUT}
          />
        </div>
      )}

      <p className="mb-2 text-[11.5px] leading-[1.6] text-ink3">
        신뢰할 수 있는 개발자의 커넥터만 사용하세요. Orca는 개발자가 제공하는 도구를 제어하지
        않으며, 의도한 대로 작동하는지 또는 변경되지 않을지 확인할 수 없습니다.
      </p>
      <p className="mb-1 text-[11.5px] leading-[1.6] text-ink3">
        MCP 서버를 구축하고 계신가요?{' '}
        <span className="cursor-pointer text-rust hover:underline">
          여기에서 문제를 보고하고 업데이트를 구독하세요
        </span>
      </p>

      <div className="mt-5 flex justify-end gap-2">
        <ModalActions
          onCancel={close}
          onConfirm={add}
          confirmLabel="추가"
          confirmDisabled={!canAdd}
        />
      </div>
    </Modal>
  )
}
