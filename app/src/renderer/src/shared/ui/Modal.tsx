import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

const DEFAULT_PANEL =
  'max-h-[88vh] w-full max-w-[92vw] overflow-y-auto rounded-r6 border border-border bg-panel p-5 shadow-xl'

interface ModalProps {
  open: boolean
  // 헤더(타이틀 + 닫기 버튼) 렌더 여부. 생략하면 크롬 없는(About/버전 등) 다이얼로그.
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  // 우상단 타이틀 옆 배지 (예: BETA).
  badge?: ReactNode
  // 하단 액션 바 (취소/확인 버튼 등).
  footer?: ReactNode
  // 패널 폭. 기본 560px. panelClassName 을 넘기면 무시(폭을 클래스로 지정).
  width?: number
  // 백드롭 blur (About/버전 다이얼로그 등).
  blurBackdrop?: boolean
  // 패널 크롬 전체 override — 크롬리스/센터드 다이얼로그용. 넘기면 DEFAULT_PANEL·width 대체.
  panelClassName?: string
  // 크롬리스(제목 없는) 다이얼로그의 접근성 라벨.
  ariaLabel?: string
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
  width = 560,
  blurBackdrop = false,
  panelClassName,
  ariaLabel
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
      className={`fixed inset-0 z-50 grid place-items-center bg-black/40 p-4${blurBackdrop ? ' backdrop-blur-sm' : ''}`}
      onClick={onClose}
      data-context="overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title == null ? ariaLabel : undefined}
        className={panelClassName ?? DEFAULT_PANEL}
        style={panelClassName ? undefined : { width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title != null && (
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
        )}

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

// 모달 하단 액션 버튼 한 쌍. danger=true 는 파괴적 확정(삭제 등)에 rust 솔리드 버튼.
export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = '취소',
  confirmDisabled = false,
  cancelDisabled = false,
  danger = false
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  cancelLabel?: string
  confirmDisabled?: boolean
  // 저장 진행(busy) 중 취소 차단용.
  cancelDisabled?: boolean
  danger?: boolean
}): React.JSX.Element {
  const confirmTone = danger ? 'bg-rust hover:brightness-110' : 'bg-ink hover:bg-t8'
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={cancelDisabled}
        className="cursor-pointer rounded-r4 border border-border bg-panel px-3.5 py-1.5 text-[12.5px] text-ink2 hover:bg-fill-uncontained-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className={`cursor-pointer rounded-r4 border-0 px-3.5 py-1.5 text-[12.5px] font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40 ${confirmTone}`}
      >
        {confirmLabel}
      </button>
    </>
  )
}
