import { useEffect, useRef, useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
import type { McpServer, McpTransport } from '../../../../../shared/ipc'
import { useI18n } from '../../../shared/i18n'

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
  const { tr } = useI18n()
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
      title={editing ? tr('skills.addServer.titleEdit') : tr('skills.addServer.titleAdd')}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel={editing ? tr('common.save') : tr('common.add')}
          confirmDisabled={!canSave}
          cancelDisabled={busy}
        />
      }
    >
      <label className="mb-3 block">
        <div className={MODAL_LABEL}>{tr('skills.addServer.name')}</div>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          placeholder={tr('skills.addServer.namePlaceholder')}
          className={MODAL_INPUT}
        />
        {name.trim() !== '' && !nameValid && (
          <div className="mt-1 text-[11px] text-bad">{tr('skills.addServer.nameFormatError')}</div>
        )}
      </label>

      <label className="mb-3 block">
        <div className={MODAL_LABEL}>{tr('skills.addServer.descOptional')}</div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder={tr('skills.addServer.descPlaceholder')}
          className={MODAL_INPUT}
        />
      </label>

      <div className="mb-3">
        <div className={MODAL_LABEL}>{tr('skills.addServer.transport')}</div>
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
              {tp === 'stdio'
                ? tr('skills.addServer.stdioOption')
                : tr('skills.addServer.httpOption')}
            </button>
          ))}
        </div>
      </div>

      {transport === 'stdio' ? (
        <>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>{tr('skills.addServer.command')}</div>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              maxLength={500}
              placeholder={tr('skills.addServer.commandPlaceholder')}
              className={`${MODAL_INPUT} font-mono`}
            />
          </label>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>{tr('skills.addServer.args')}</div>
            <textarea
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              rows={3}
              placeholder={'-y\n@modelcontextprotocol/server-filesystem\n~/'}
              className={`${MODAL_INPUT} resize-none font-mono text-[12.5px] leading-[1.6]`}
            />
          </label>
          <label className="mb-3 block">
            <div className={MODAL_LABEL}>{tr('skills.addServer.authEnvName')}</div>
            <input
              value={authEnvKey}
              onChange={(e) => setAuthEnvKey(e.target.value)}
              maxLength={128}
              placeholder={tr('skills.addServer.authEnvPlaceholder')}
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
            <div className={MODAL_LABEL}>{tr('skills.addServer.authEnvName')}</div>
            <input
              value={authEnvKey}
              onChange={(e) => setAuthEnvKey(e.target.value)}
              maxLength={128}
              placeholder={tr('skills.addServer.authEnvPlaceholderHttp')}
              className={`${MODAL_INPUT} font-mono`}
            />
          </label>
        </>
      )}

      <label className="block">
        <div className={MODAL_LABEL}>
          {transport === 'stdio'
            ? tr('skills.addServer.authKeyOptional')
            : tr('skills.addServer.authTokenOptional')}
        </div>
        <input
          type="password"
          value={auth}
          onChange={(e) => setAuth(e.target.value)}
          maxLength={4000}
          placeholder={
            editing && initial?.hasAuth
              ? tr('skills.addServer.keepEmptyToPreserve')
              : tr('skills.addServer.encryptedNote')
          }
          className={`${MODAL_INPUT} font-mono`}
        />
        {transport === 'http' && (
          <div className="mt-1 text-[10.5px] text-ink3">{tr('skills.addServer.bearerNote')}</div>
        )}
      </label>
    </Modal>
  )
}
