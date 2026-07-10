import { useEffect, useRef, useState } from 'react'
import { Modal, ModalActions, MODAL_INPUT } from '../../../shared/ui/Modal'

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
      title="지침 편집"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onConfirm={() => void save()}
          confirmLabel="저장"
          confirmDisabled={busy}
          cancelDisabled={busy}
        />
      }
    >
      <div className="mb-3 text-[12px] text-ink3">
        <span className="font-mono">{projectName}</span> 의 모든 새 메시지에 시스템 프롬프트로
        덧붙여집니다.
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={8000}
        rows={12}
        placeholder="예: 모든 응답을 한국어로, 코드 예시는 TypeScript 로. 검증 엔지니어 톤으로 간결하게."
        className={`${MODAL_INPUT} resize-none leading-[1.6]`}
      />
      <div className="mt-1 text-right text-[10.5px] text-ink3">{value.length} / 8000</div>
    </Modal>
  )
}
