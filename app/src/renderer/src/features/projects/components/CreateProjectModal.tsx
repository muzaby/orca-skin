import { useEffect, useRef, useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT, MODAL_LABEL } from '../../../shared/ui/Modal'
import { useI18n } from '../../../shared/i18n'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, instructions: string) => Promise<void> | void
}

// 새 프로젝트 생성 모달 — name 필수 (1-120자), instructions 선택 (0-8000자).
// 셸(백드롭/패널/Esc/footer)은 공용 Modal. `!open` 시 컴포넌트가 unmount 되므로
// 재오픈 시 useState 초기값이 자동 reset 됨.
export function CreateProjectModal(props: CreateProjectModalProps): React.JSX.Element | null {
  if (!props.open) return null
  return <CreateProjectModalOpen onClose={props.onClose} onCreate={props.onCreate} />
}

function CreateProjectModalOpen({
  onClose,
  onCreate
}: Omit<CreateProjectModalProps, 'open'>): React.JSX.Element {
  const { tr } = useI18n()
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queueMicrotask(() => nameRef.current?.focus())
  }, [])

  const canSave = name.trim().length >= 1 && !busy

  const save = async (): Promise<void> => {
    if (!canSave) return
    setBusy(true)
    try {
      await onCreate(name.trim(), instructions)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={tr('projects.create.title')}
      onClose={onClose}
      width={520}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel={tr('common.create')}
          confirmDisabled={!canSave}
          cancelDisabled={busy}
        />
      }
    >
      <label className="mb-3 block">
        <div className={MODAL_LABEL}>{tr('projects.create.name')}</div>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && canSave) {
              e.preventDefault()
              void save()
            }
          }}
          maxLength={120}
          placeholder={tr('projects.create.namePlaceholder')}
          className={MODAL_INPUT}
        />
      </label>

      <label className="block">
        <div className={MODAL_LABEL}>{tr('projects.create.instructionsOptional')}</div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={8000}
          rows={6}
          placeholder={tr('projects.create.instructionsPlaceholder')}
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
        <div className="mt-1 text-right text-[10.5px] text-ink3">{instructions.length} / 8000</div>
      </label>
    </Modal>
  )
}
