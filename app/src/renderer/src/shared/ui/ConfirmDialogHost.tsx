import { Modal, ModalActions } from './Modal'
import { useConfirmStore } from './confirmDialogStore'
import { useI18n } from '../i18n'

// 범용 확인 다이얼로그 호스트 — 셸(OverlayLayer)에 1회 마운트. Modal 이 포털/백드롭/
// Esc/footer 를, ModalActions 가 취소·확정 버튼 쌍(danger 포함)을 제공하므로 여기서는
// store 구독 + 배선만 얹는다.
export function ConfirmDialogHost(): React.JSX.Element | null {
  const request = useConfirmStore((s) => s.request)
  const close = useConfirmStore((s) => s.close)
  const { tr } = useI18n()

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
        <ModalActions
          onCancel={close}
          onConfirm={handleConfirm}
          confirmLabel={request.confirmLabel ?? tr('common.confirm')}
          cancelLabel={request.cancelLabel ?? tr('common.cancel')}
          danger={request.danger}
        />
      }
    >
      <p className="text-[13px] leading-relaxed text-ink2">{request.message}</p>
    </Modal>
  )
}
