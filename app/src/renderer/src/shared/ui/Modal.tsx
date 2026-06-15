import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  // 우상단 타이틀 옆 배지 (예: BETA).
  badge?: ReactNode
  // 하단 액션 바 (취소/확인 버튼 등).
  footer?: ReactNode
  // 패널 폭. 기본 560px.
  width?: number
}

// 맞춤설정 추가 플로우(스킬 지침 작성 · 스킬 업로드 · 커스텀 커넥터 추가)가 공유하는
// 모달 셸. AddMcpServerModal 의 fixed overlay 패턴을 일반화 — 백드롭/패널/타이틀/닫기 +
// Esc·백드롭 클릭 닫기를 일괄 처리. 닫힌 상태는 null 반환(언마운트=폼 리셋).
export function Modal({
  open,
  title,
  onClose,
  children,
  badge,
  footer,
  width = 560
}: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
      data-context="overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[88vh] w-full max-w-[92vw] overflow-y-auto rounded-r6 border border-border bg-panel p-5 shadow-xl"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="font-serif text-[18px] font-semibold text-ink">{title}</span>
          {badge}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {children}

        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// 모달 폼에서 재사용하는 라벨/인풋 클래스. AddMcpServerModal 과 시각 일치.
export const MODAL_LABEL = 'mb-1.5 block text-[12.5px] font-medium text-ink'
export const MODAL_INPUT =
  'w-full rounded-r4 border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink3 focus:border-border-strong'

// 모달 하단 액션 버튼 한 쌍.
export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = '취소',
  confirmDisabled = false
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  cancelLabel?: string
  confirmDisabled?: boolean
}): React.JSX.Element {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer rounded-r4 border border-border bg-panel px-3.5 py-1.5 text-[12.5px] text-ink2 hover:bg-fill-uncontained-hover"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="cursor-pointer rounded-r4 border-0 bg-rust px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-fill-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirmLabel}
      </button>
    </>
  )
}
