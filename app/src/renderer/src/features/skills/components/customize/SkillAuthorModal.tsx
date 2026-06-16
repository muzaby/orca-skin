import { useState } from 'react'
import { Modal, ModalActions, MODAL_LABEL, MODAL_INPUT } from '../../../../shared/ui/Modal'
import type { SkillItem } from './data'

// "스킬 지침 작성" — 직접 작성 플로우(첨부 2). 이름/설명/지침을 받아 스킬 항목을 만든다.
// 정적 스킨이므로 onCreate 는 부모의 로컬 목록에 메모리상 append(비영속).
export function SkillAuthorModal({
  open,
  onClose,
  onCreate
}: {
  open: boolean
  onClose: () => void
  onCreate: (skill: SkillItem) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [body, setBody] = useState('')

  const nameValid = /^[A-Za-z0-9_-]+$/.test(name.trim())
  const canCreate = nameValid && desc.trim() !== ''

  const reset = (): void => {
    setName('')
    setDesc('')
    setBody('')
  }
  const close = (): void => {
    reset()
    onClose()
  }
  const create = (): void => {
    if (!canCreate) return
    const trimmed = name.trim()
    onCreate({
      id: `${trimmed}-${Date.now()}`,
      name: trimmed,
      desc: desc.trim(),
      enabled: true,
      addedBy: '로컬 (직접 작성)',
      updatedAt: '방금',
      trigger: '슬래시 명령어',
      version: '0.1.0',
      triggers: trimmed,
      body: body.trim() || desc.trim()
    })
    close()
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
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="최근 작업에서 주간 현황 보고서를 생성합니다. 업데이트나 진행 상황 요약을 요청받았을 때 사용하세요."
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
      </label>

      <label className="block">
        <span className={MODAL_LABEL}>지침</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={9}
          placeholder="최근 작업을 성과, 장애 요인, 다음 단계의 세 섹션으로 요약해 주세요. 전문적이면서도 딱딱하지 않은 톤으로 작성해 주세요..."
          className={`${MODAL_INPUT} resize-none leading-[1.6]`}
        />
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <ModalActions
          onCancel={close}
          onConfirm={create}
          confirmLabel="만들기"
          confirmDisabled={!canCreate}
        />
      </div>
    </Modal>
  )
}
