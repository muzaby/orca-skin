import { Button } from '../../../shared/ui/Button'
import { useEscToClose } from '../../../shared/hooks/useEscToClose'
import { useI18n } from '../../../shared/i18n'

interface AuthExpiredModalProps {
  open: boolean
  onNewChat: () => void
  onDismiss: () => void
}

export function AuthExpiredModal({
  open,
  onNewChat,
  onDismiss
}: AuthExpiredModalProps): React.JSX.Element | null {
  const { tr } = useI18n()
  // Esc·바깥 클릭 = 닫기 버튼과 동일한 dismiss (handoff 0121 닫기 UX 통일).
  useEscToClose(open, onDismiss)
  if (!open) return null
  const cmd = 'claude /login'
  // backdrop 은 #app-frame-overlay 가 담당. panel 만 grid cell 중앙에.
  return (
    <div
      className="grid h-full w-full place-items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr('backend.authExpired.title')}
        className="w-[440px] max-w-[92vw] rounded-r6 border border-border bg-panel p-5 shadow-xl"
      >
        <div className="mb-2 font-serif text-[18px] font-semibold text-ink">
          {tr('backend.authExpired.title')}
        </div>
        <div className="mb-3 text-[12.5px] text-ink2">{tr('backend.authExpired.body')}</div>
        <div className="mb-3 flex items-center gap-2 rounded-r4 border border-border bg-bg px-2.5 py-1.5">
          <code className="flex-1 font-mono text-[12px] text-ink">{cmd}</code>
          <Button
            variant="contained"
            size="small"
            onClick={() => void navigator.clipboard.writeText(cmd)}
          >
            {tr('common.copy')}
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="contained" size="small" onClick={onDismiss}>
            {tr('common.close')}
          </Button>
          <Button variant="primary" size="small" onClick={onNewChat}>
            {tr('common.newChat')}
          </Button>
        </div>
      </div>
    </div>
  )
}
