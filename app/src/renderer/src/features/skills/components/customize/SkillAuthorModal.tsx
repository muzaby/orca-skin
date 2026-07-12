import { useState } from 'react'
import { Modal, ModalActions, MODAL_LABEL, MODAL_INPUT } from '../../../../shared/ui/Modal'
import type { AuthorSkillRequest } from '../../../../../../shared/ipc'
import { useI18n } from '../../../../shared/i18n'

export function SkillAuthorModal({
  open,
  onClose,
  onCreate
}: {
  open: boolean
  onClose: () => void
  onCreate: (req: AuthorSkillRequest) => Promise<void>
}): React.JSX.Element {
  const { tr } = useI18n()
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
      setError(e instanceof Error ? e.message : tr('skills.author.failed'))
    }
  }
  return (
    <Modal open={open} title={tr('skills.author.title')} onClose={close} width={640}>
      <label className="mb-4 block">
        <span className={MODAL_LABEL}>{tr('skills.author.name')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          placeholder="weekly-status-report"
          className={`${MODAL_INPUT} font-mono`}
        />
        {name.trim() !== '' && !nameValid && (
          <span className="mt-1 block text-[11px] text-bad">
            영숫자 · _ · - 만 사용할 수 있습니다.
          </span>
        )}
      </label>
      <label className="mb-4 block">
        <span className={MODAL_LABEL}>{tr('common.description')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={tr('skills.author.descPlaceholder')}
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
      </label>
      <label className="block">
        <span className={MODAL_LABEL}>{tr('skills.author.instructions')}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          placeholder={tr('skills.author.instructionsPlaceholder')}
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
      </label>
      {error && <div className="mt-2 text-[12px] text-bad">{error}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <ModalActions
          onCancel={close}
          onConfirm={() => void create()}
          confirmLabel={saving ? tr('skills.author.saving') : tr('common.create')}
          confirmDisabled={!canCreate}
        />
      </div>
    </Modal>
  )
}
