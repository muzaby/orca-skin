import { useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT } from '../../../../shared/ui/Modal'
import type { CreateMcpServerRequest } from '../../../../../../shared/ipc'

const PLACEHOLDER = `{
  "my-server": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
    "env": { "API_KEY": "${'${MY_TOKEN}'}" }
  }
}`

function parseInput(text: string): CreateMcpServerRequest {
  const parsed = JSON.parse(text) as unknown
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON 객체를 입력하세요.')
  }
  const obj = parsed as Record<string, unknown>
  const servers =
    'mcpServers' in obj && typeof obj.mcpServers === 'object' && obj.mcpServers !== null
      ? (obj.mcpServers as Record<string, unknown>)
      : obj
  const entries = Object.entries(servers)
  if (entries.length !== 1) throw new Error('MCP 서버 항목은 한 개만 입력하세요.')
  const [name, raw] = entries[0]
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('서버 이름은 영숫자 · _ · - 만 허용됩니다.')
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('서버 설정이 올바르지 않습니다.')
  const entry = raw as Record<string, unknown>
  if (entry.type === 'http' || entry.type === 'sse' || 'url' in entry) {
    const url = typeof entry.url === 'string' ? entry.url : ''
    return { name, description: '', transport: 'http', enabled: true, url }
  }
  const command = typeof entry.command === 'string' ? entry.command : ''
  const args = Array.isArray(entry.args)
    ? entry.args.filter((v): v is string => typeof v === 'string')
    : []
  const env =
    typeof entry.env === 'object' && entry.env !== null ? Object.keys(entry.env)[0] : undefined
  return {
    name,
    description: '',
    transport: 'stdio',
    enabled: true,
    command,
    args,
    ...(env ? { authEnvKey: env } : {})
  }
}

export function CustomMcpModal({
  open,
  onClose,
  onAdd
}: {
  open: boolean
  onClose: () => void
  onAdd: (req: CreateMcpServerRequest) => Promise<void>
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const close = (): void => {
    setText('')
    setError(null)
    setSaving(false)
    onClose()
  }

  const add = async (): Promise<void> => {
    try {
      setSaving(true)
      setError(null)
      await onAdd(parseInput(text))
      close()
    } catch (e) {
      setSaving(false)
      setError(e instanceof Error ? e.message : 'MCP 추가에 실패했습니다.')
    }
  }

  return (
    <Modal open={open} title="MCP 서버 추가" onClose={close} width={640}>
      <p className="mb-3 text-[12.5px] leading-[1.6] text-ink2">
        단일 MCP 서버 JSON 항목을 붙여넣으면 Orca sources mcp.json에 병합합니다.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder={PLACEHOLDER}
        className={`${MODAL_INPUT} resize-none font-mono text-[12px] leading-[1.55]`}
      />
      {error && <div className="mt-2 text-[12px] text-rust">{error}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <ModalActions
          onCancel={close}
          onConfirm={() => void add()}
          confirmLabel={saving ? '추가 중…' : '추가'}
          confirmDisabled={saving || text.trim() === ''}
        />
      </div>
    </Modal>
  )
}
