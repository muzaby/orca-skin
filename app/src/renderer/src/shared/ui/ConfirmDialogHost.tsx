import { Modal } from './Modal'
import { useConfirmStore } from './confirmDialogStore'

// 범용 확인 다이얼로그 호스트 — 셸(OverlayLayer)에 1회 마운트. Modal 이 포털/백드롭/
// Esc/footer 를 제공하므로 여기서는 store 구독 + 버튼 쌍만 얹는다.
const CANCEL_BTN =
  'cursor-pointer rounded-r4 border border-border bg-panel px-3.5 py-1.5 text-[12.5px] text-ink2 hover:bg-fill-uncontained-hover'
// danger: rust 솔리드 + 반전 텍스트(앱 primary 버튼 관례) + 호버 시 살짝 밝게.
const CONFIRM_DANGER_BTN =
  'cursor-pointer rounded-r4 border-0 bg-rust px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:brightness-110'
const CONFIRM_NEUTRAL_BTN =
  'cursor-pointer rounded-r4 border-0 bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-t8'

export function ConfirmDialogHost(): React.JSX.Element | null {
  const request = useConfirmStore((s) => s.request)
  const close = useConfirmStore((s) => s.close)

  if (!request) return null

  const handleConfirm = (): void => {
    request.onConfirm()
    close()
  }

  return (
    <Modal
      open
      title={request.title}
      onClose={close}
      width={400}
      footer={
        <>
          <button type="button" onClick={close} className={CANCEL_BTN}>
            {request.cancelLabel ?? '취소'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={request.danger ? CONFIRM_DANGER_BTN : CONFIRM_NEUTRAL_BTN}
          >
            {request.confirmLabel ?? '확인'}
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink2">{request.message}</p>
    </Modal>
  )
}
