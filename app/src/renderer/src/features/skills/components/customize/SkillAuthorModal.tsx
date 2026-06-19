import { useState } from 'react'
import { Modal, ModalActions, MODAL_LABEL, MODAL_INPUT } from '../../../../shared/ui/Modal'
import type { AuthorSkillRequest } from '../../../../../../shared/ipc'

export function SkillAuthorModal({
  open,
  onClose,
  onCreate
}: {
  open: boolean
  onClose: () => void
  onCreate: (req: AuthorSkillRequest) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameValid = /^[A-Za-z0-9_-]+$/.test(name.trim())
  const canCreate = nameValid && description.trim() !== '' && !saving
  const close = (): void => {
    setName('')
    setDescription('')
    setBody('')
    setError(null)
    setSaving(false)
    onClose()
  }
  const create = async (): Promise<void> => {
    if (!canCreate) return
    try {
      setSaving(true)
      await onCreate({ name: name.trim(), description: description.trim(), body })
      close()
    } catch (e) {
      setSaving(false)
      setError(e instanceof Error ? e.message : '스킬 생성에 실패했습니다.')
    }
  }
  return (
    <Modal open={open} title="스킬 지침 작성" onClose={close} width={640}>
      <label className="mb-4 block">
        <span className={MODAL_LABEL}>스킬 이름</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          placeholder="weekly-status-report"
          className={`${MODAL_INPUT} font-mono`}
        />
        {name.trim() !== '' && !nameValid && (
          <span className="mt-1 block text-[11px] text-rust">
            영숫자 · _ · - 만 사용할 수 있습니다.
          </span>
        )}
      </label>
      <label className="mb-4 block">
        <span className={MODAL_LABEL}>설명</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="최근 작업에서 주간 현황 보고서를 생성합니다."
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
      </label>
      <label className="block">
        <span className={MODAL_LABEL}>지침</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          placeholder="최근 작업을 성과, 장애 요인, 다음 단계의 세 섹션으로 요약해 주세요..."
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
      </label>
      {error && <div className="mt-2 text-[12px] text-rust">{error}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <ModalActions
          onCancel={close}
          onConfirm={() => void create()}
          confirmLabel={saving ? '저장 중…' : '만들기'}
          confirmDisabled={!canCreate}
        />
      </div>
    </Modal>
  )
}
