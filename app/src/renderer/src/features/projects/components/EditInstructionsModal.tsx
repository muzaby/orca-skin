import { useEffect, useRef, useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT } from '../../../shared/ui/Modal'
import { Trans } from 'react-i18next'
import { useI18n } from '../../../shared/i18n'

interface EditInstructionsModalProps {
  open: boolean
  initial: string
  projectName: string
  onClose: () => void
  onSave: (instructions: string) => Promise<void> | void
}

// 프로젝트 지침 편집 모달. 우측 패널의 "편집" 버튼에서 열림. 셸은 공용 Modal.
// 저장 시 ProjectDetail → useProjects.update → main DB 갱신. 다음 chat:send 부터
// 새 지침이 systemPrompt.append 로 즉시 반영된다 (캐시 없음).
// `!open` 시 컴포넌트가 unmount 되므로 재오픈 시 useState(initial) 가 새로 적용됨.
export function EditInstructionsModal(props: EditInstructionsModalProps): React.JSX.Element | null {
  if (!props.open) return null
  return (
    <EditInstructionsModalOpen
      initial={props.initial}
      projectName={props.projectName}
      onClose={props.onClose}
      onSave={props.onSave}
    />
  )
}

function EditInstructionsModalOpen({
  initial,
  projectName,
  onClose,
  onSave
}: Omit<EditInstructionsModalProps, 'open'>): React.JSX.Element {
  const { tr } = useI18n()
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    queueMicrotask(() => textareaRef.current?.focus())
  }, [])

  const save = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await onSave(value)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={tr('projects.editInstructions.title')}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel={tr('common.save')}
          confirmDisabled={busy}
          cancelDisabled={busy}
        />
      }
    >
      <div className="mb-3 text-[12px] text-ink3">
        {/* 카탈로그 값의 <mono> 태그가 프로젝트명 mono span 으로 치환된다. */}
        <Trans
          i18nKey="projects.editInstructions.body"
          values={{ name: projectName }}
          components={{ mono: <span className="font-mono" /> }}
        />
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={8000}
        rows={12}
        placeholder={tr('projects.editInstructions.placeholder')}
        className={`${MODAL_INPUT} resize-none leading-[1.6]`}
      />
      <div className="mt-1 text-right text-[10.5px] text-ink3">{value.length} / 8000</div>
    </Modal>
  )
}
