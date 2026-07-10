import { useEffect, useRef, useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
import type { McpServer, McpTransport } from '../../../../../shared/ipc'

// 모달이 부모에 전달하는 폼 값. auth 는 undefined 면 미변경(수정 시 기존 비밀 유지),
// '' 면 비밀 제거, 그 외 문자열이면 새 비밀로 교체.
export interface McpFormValues {
  name: string
  description: string
  transport: McpTransport
  command: string
  args: string[]
  authEnvKey: string
  url: string
  auth: string | undefined
}

interface AddMcpServerModalProps {
  open: boolean
  // 편집 대상. 없으면 신규 추가 모드.
  initial?: McpServer
  onClose: () => void
  onSave: (values: McpFormValues) => Promise<void> | void
}

// MCP 서버 추가/편집 모달. 셸(백드롭/패널/Esc/footer)은 공용 Modal — open prop +
// unmount=reset 패턴. transport 토글로 stdio / streamable-http 입력을 전환.
export function AddMcpServerModal(props: AddMcpServerModalProps): React.JSX.Element | null {
  if (!props.open) return null
  return <AddMcpServerModalOpen {...props} />
}

function AddMcpServerModalOpen({
  initial,
  onClose,
  onSave
}: AddMcpServerModalProps): React.JSX.Element {
  const editing = initial != null
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [transport, setTransport] = useState<McpTransport>(initial?.transport ?? 'stdio')
  const [command, setCommand] = useState(initial?.command ?? '')
  const [argsText, setArgsText] = useState((initial?.args ?? []).join('\n'))
  const [authEnvKey, setAuthEnvKey] = useState(initial?.authEnvKey ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [auth, setAuth] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queueMicrotask(() => nameRef.current?.focus())
  }, [])

  const nameValid = /^[A-Za-z0-9_-]+$/.test(name.trim())
  const transportValid = transport === 'stdio' ? command.trim() !== '' : url.trim() !== ''
  const canSave = nameValid && transportValid && !busy

  const save = async (): Promise<void> => {
    if (!canSave) return
    setBusy(true)
    try {
      const args = argsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '')
      // 편집 중 비밀 입력칸이 비어 있으면 미변경(undefined). 신규면 빈 값 = 비밀 없음('').
      const authValue = editing && auth === '' ? undefined : auth
      await onSave({
        name: name.trim(),
        description: description.trim(),
        transport,
        command: command.trim(),
        args,
        authEnvKey: authEnvKey.trim(),
        url: url.trim(),
        auth: authValue
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={editing ? 'MCP 서버 편집' : 'MCP 서버 추가'}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel={editing ? '저장' : '추가'}
          confirmDisabled={!canSave}
          cancelDisabled={busy}
        />
      }
    >
      <label className="mb-3 block">
        <div className={MODAL_LABEL}>이름</div>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          placeholder="예: github"
          className={MODAL_INPUT}
        />
        {name.trim() !== '' && !nameValid && (
          <div className="mt-1 text-[11px] text-bad">영숫자 · _ · - 만 사용할 수 있습니다.</div>
        )}
      </label>

      <label className="mb-3 block">
        <div className={MODAL_LABEL}>설명 (선택)</div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="이 서버가 제공하는 도구 설명"
          className={MODAL_INPUT}
        />
      </label>

      <div className="mb-3">
        <div className={MODAL_LABEL}>전송 방식</div>
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {(['stdio', 'http'] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setTransport(tp)}
              className={`cursor-pointer border-0 px-3 py-1.5 text-[12.5px] ${
                transport === tp ? 'bg-t3 text-t8' : 'bg-panel text-ink2'
              }`}
            >
              {tp === 'stdio' ? 'stdio (로컬 프로세스)' : 'HTTP (streamable)'}
            </button>
          ))}
        </div>
      </div>

      {transport === 'stdio' ? (
        <>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>명령어 (command)</div>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              maxLength={500}
              placeholder="예: npx · python · node"
              className={`${MODAL_INPUT} font-mono`}
            />
          </label>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>인자 (args, 한 줄에 하나)</div>
            <textarea
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              rows={3}
              placeholder={'-y\n@modelcontextprotocol/server-filesystem\n~/'}
              className={`${MODAL_INPUT} resize-none font-mono text-[12.5px] leading-[1.6]`}
            />
          </label>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>인증 환경변수 이름 (선택)</div>
            <input
              value={authEnvKey}
              onChange={(e) => setAuthEnvKey(e.target.value)}
              maxLength={128}
              placeholder="예: GITHUB_TOKEN"
              className={`${MODAL_INPUT} font-mono`}
            />
          </label>
        </>
      ) : (
        <>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>URL</div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={2000}
              placeholder="https://example.com/mcp"
              className={`${MODAL_INPUT} font-mono`}
            />
          </label>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>인증 환경변수 이름 (선택)</div>
            <input
              value={authEnvKey}
              onChange={(e) => setAuthEnvKey(e.target.value)}
              maxLength={128}
              placeholder="예: API_TOKEN — 비워 두면 자동 생성"
              className={`${MODAL_INPUT} font-mono`}
            />
          </label>
        </>
      )}

      <label className="block">
        <div className={MODAL_LABEL}>
          {transport === 'stdio' ? '인증키 (선택)' : '인증 토큰 (선택)'}
        </div>
        <input
          type="password"
          value={auth}
          onChange={(e) => setAuth(e.target.value)}
          maxLength={4000}
          placeholder={
            editing && initial?.hasAuth
              ? '변경하지 않으려면 비워 두세요'
              : '안전하게 암호화 저장됩니다'
          }
          className={`${MODAL_INPUT} font-mono`}
        />
        {transport === 'http' && (
          <div className="mt-1 text-[10.5px] text-ink3">
            Authorization: Bearer 헤더로 전송됩니다.
          </div>
        )}
      </label>
    </Modal>
  )
}
